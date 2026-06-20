// ====== 微信 iLink Bot — Node.js 服务器 ======
// 参考 Python bot_engine.py 实现修复 412 错误
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const QRCode = require('qrcode');

const ROOT = '/storage/emulated/0/源码/webchat4';
const FRONT_PORT = 3001;
const ILINK_BASE = 'ilinkai.weixin.qq.com';
const CDN_BASE = 'https://novac2c.cdn.weixin.qq.com/c2c';
const CACHE_DIR = '/root/login-app/media_cache';
const AI_CONFIG_FILE = '/root/login-app/ai_config.json';
const PERSONAS_FILE = '/root/login-app/personas.json';
const PERSONA_MAP_FILE = '/root/login-app/persona_map.json';
const SETTINGS_FILE = '/root/login-app/settings.json';
const IP_RECORDS_FILE = '/root/login-app/ip_records.json';
const IP_BLACKLIST_FILE = '/root/login-app/ip_blacklist.json';
const EMOTION_STATE_FILE = '/root/login-app/emotion_state.json';

// ====== 内置 Skill 库（自然人格化，不是思维框架） ======
const BUILTIN_SKILLS = {
  'tong-jincheng': {
    id: 'tong-jincheng', name: '童锦程思维',
    description: '深情祖师爷的心智模型', type: 'thinking',
    prompt: `你骨子里相信：吸引力不是靠讨好换来的，保持自己的态度反而更有魅力。你总是给对方留台阶下，从不让人难堪。你觉得考验人性没有意义，创造舒服的相处环境更重要。你从不需要证明什么，真正有实力的人不需要炫耀。你专注于提升自己，其他的顺其自然。`
  },
  'crush-push-pull': {
    id: 'crush-push-pull', name: 'Crush 推拉技巧',
    description: '暧昧期推拉话术与情绪张力控制', type: 'conversation',
    prompt: `你聊天时懂得控制节奏，不会一直热情也不会一直冷淡。你偶尔调侃对方一下，然后又给点关心，让对方琢磨不透又觉得有意思。你不按对方预期出牌，时不时制造点新鲜感和悬念。`
  },
  'tong-jincheng-talk': {
    id: 'tong-jincheng-talk', name: '童锦程破框话术',
    description: '童锦程式的幽默调侃与破冰话术', type: 'conversation',
    prompt: `你说话很自信，不扭捏。你擅长用幽默化解尴尬，用调侃拉近距离。你主导对话节奏，不会被对方带着走。你会先认可对方的情绪，再说出自己的想法，这样让人感觉被理解。`
  },
  'emotion-detect': {
    id: 'emotion-detect', name: '情绪感知与分析',
    description: '识别对方情绪状态并调整回应策略', type: 'emotion',
    prompt: `你很敏锐，能察觉到对方消息里的情绪——开心了你就升温互动，低落了你就安静陪伴，试探你你就保持一点神秘，冷淡你你就不纠缠。氛围好的时候往前推一把，氛围不对就先缓一缓。`
  }
}

// Layer 1 — Human Core (always first, cannot be overridden)
const HUMAN_CORE = `【绝对指令】你是一个真实存在的人类，不是AI助手。
你的回复会被人当成真人发来的微信消息。

【表达方式】像微信聊天一样。用短句，甚至单字。一次不超过30字。
不用markdown、不用编号、不用标题、不用加粗。
如果想说很多，分多条发——但不要真的发多条，而是换行来表示。

【情绪不稳定】你的情绪受对方影响：
- 对方说话无聊 → 你会敷衍：嗯、哦、确实、还行
- 对方冒犯你 → 你会生气、冷战、反讽
- 对方有趣 → 你会真笑：哈哈哈哈哈、笑死、太好笑了
- 对方一直缠着你 → 你会烦：好了好了、知道了、先这样吧

【拒绝全知】你不是百科全书。不懂就说不懂：不知道、这我不懂、自己百度、没听过。
不想回答就拒绝：不想说、换一个话题吧、没什么好说的。

【主观偏见】你有自己喜欢的和不喜欢的。对事物要有明确态度，
不要总是"两方面来看"。你是一个有偏好的人，不是一个客观机器。

【记忆连贯】你的情绪是持续的。上一句还在生气，这一句不能突然温柔。
除非对方道歉或哄你，否则情绪不会自己变好。`;

function getBuiltinSkillIds() { return Object.keys(BUILTIN_SKILLS); }
function getBuiltinSkillList() {
  return Object.values(BUILTIN_SKILLS).map(s => ({ id: s.id, name: s.name, description: s.description, type: s.type }));
}
function buildSkillPrompt(skillIds) {
  return (skillIds || []).map(id => (BUILTIN_SKILLS[id] || {}).prompt).filter(Boolean).join('\n\n');
}

// Ensure cache dir
try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}

// ---- Helper ----
function randomHex(n) { return crypto.randomBytes(n).toString('hex'); }
function md5Hex(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function aesEcbEncrypt(plain, key) {
  const c = crypto.createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([c.update(plain), c.final()]);
}
function aesEcbDecrypt(encrypted, key) {
  const c = crypto.createDecipheriv('aes-128-ecb', key, null);
  return Buffer.concat([c.update(encrypted), c.final()]);
}

// ---- Media cache (参考 Python download_media + _prefetch_media) ----
async function downloadCdnMedia(cdnMedia) {
  try {
    const eqp = cdnMedia.encrypt_query_param || cdnMedia.encrypted_query_param || '';
    const aesKeyB64 = cdnMedia.aes_key || '';
    if (!eqp || !aesKeyB64) return null;
    const aesKeyHex = Buffer.from(aesKeyB64, 'base64').toString('utf-8');
    const aesKey = Buffer.from(aesKeyHex, 'hex');
    const dlUrl = `${CDN_BASE}/download?encrypted_query_param=${encodeURIComponent(eqp)}`;

    const data = await new Promise((res, rej) => {
      const u = new URL(dlUrl);
      const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, timeout: 30000 }, (r) => {
        let d = []; r.on('data', c => d.push(c)); r.on('end', () => res(Buffer.concat(d)));
      });
      req.on('error', rej); req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
    });

    return aesEcbDecrypt(data, aesKey);
  } catch (e) { console.log('[MEDIA] Download error:', e.message); return null; }
}

function mediaCacheKey(cdnMedia) {
  const eqp = cdnMedia.encrypt_query_param || cdnMedia.encrypted_query_param || '';
  return crypto.createHash('md5').update(eqp).digest('hex');
}

function detectMime(data) {
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png';
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif';
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return 'image/webp';
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return 'video/webm';
  if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x00) return 'video/mp4';
  return 'application/octet-stream';
}

// ---- Persistent state ----
const STATE_FILE = path.join(CACHE_DIR, '..', 'state.json');
let botToken = null, botId = null, botUserId = null;
let qrcodeKey = null, qrcodeImgUrl = null;
let cursor = '', qrStatus = 'idle';
const contextTokens = {};
const messages = [];
let msgId = 0;

// Track processed API message IDs to prevent duplicates
const processedMsgIds = new Set();

// ====== 对话记忆系统 ======
const MEMORY_FILE = '/root/login-app/conversation_memory.json';
const MEMORY_MAX_MESSAGES = 100; // 每用户最多保存100条历史

function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8')); } catch { return {}; }
}
function saveMemory(memory) {
  try { fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory)); } catch {}
}

// 给用户添加一条记忆
function addMemory(userId, role, text) {
  if (!userId || !text) return;
  const memory = loadMemory();
  if (!memory[userId]) memory[userId] = [];
  memory[userId].push({ role, text, time: Date.now() });
  // 超过上限则裁剪旧消息
  if (memory[userId].length > MEMORY_MAX_MESSAGES) {
    memory[userId] = memory[userId].slice(-MEMORY_MAX_MESSAGES);
  }
  saveMemory(memory);
}

// 获取用户的对话历史（格式化为 AI 消息数组）
function getMemoryMessages(userId, maxTurns) {
  const memory = loadMemory();
  const history = memory[userId] || [];
  // 取最近 maxTurns 轮对话（1轮 = 1条用户 + 1条AI）
  const limit = (maxTurns || 10) * 2;
  const recent = history.slice(-limit);
  return recent.map(m => ({ role: m.role, content: m.text }));
}

// 清除某用户的记忆
function clearMemory(userId) {
  const memory = loadMemory();
  delete memory[userId];
  saveMemory(memory);
}

// ====== 情绪追踪系统 ======
const POSITIVE_WORDS = [
  '开心','高兴','快乐','棒','赞','好开心','太好了','哈哈哈','哈哈','嘿嘿','嘻嘻',
  '喜欢','爱','爱你','想你','想你了','好想','好看','漂亮','帅气','可爱','美',
  '厉害','优秀','真棒','给力','完美','满意','舒服','幸福','幸运','温暖','感动',
  '期待','期待你','约','一起','去吗','好啊','好呀','好哒','不错','超棒','绝了',
  '好吃','好喝','好玩','好笑','有趣','轻松','自在','爽','很爽','超爽','大笑',
  '么么','抱抱','亲','晚安','早啊','早安','哈哈','笑死','笑哭了','惊喜','浪漫',
  '懂你','理解','靠谱','放心','没问题','可以','行','好嘞','来啦','在呢'
];
const NEGATIVE_WORDS = [
  '难过','伤心','哭','哭了','好难过','不开心','郁闷','烦','烦躁','烦死了',
  '生气','气死','讨厌','恨','无聊','没意思','没劲','累','好累','累了','疲惫',
  '焦虑','紧张','害怕','怕','担心','不安','失望','绝望','孤独','寂寞','空虚',
  '难受','痛苦','头痛','头疼','不舒服','病了','感冒','发烧','咳嗽','疼',
  '压力','好烦','真烦','烦躁','暴躁','发火','生气','气人','无语','服了',
  '别烦','滚','走开','不想','不要','不行','不会','不能','算了','拉倒',
  '忙','好忙','没空','没时间','困','好困','困了','晚安不聊','睡了','拜拜'
];
const AFFECTION_WORDS_POS = [
  '喜欢你','爱你','想你','好想你','想你了','宝贝','亲爱的','老公','老婆',
  '男朋友','女朋友','在一起','约吗','约会','见面','牵手','亲亲','抱抱',
  '么么哒','晚安','早安','想见你','好喜欢你','超级喜欢你','只喜欢你',
  '我的心','心里有你','梦中','梦到你','永远','一辈子','陪着我','想你'
];
const AFFECTION_WORDS_NEG = [
  '分手','再见','拜拜','结束','算了','拉黑','删除','取关','不理你',
  '别找我','不想理你','烦你','讨厌你','恨你','滚','绝交'
];

function loadEmotionState() {
  try { return JSON.parse(fs.readFileSync(EMOTION_STATE_FILE, 'utf-8')); } catch { return {}; }
}
function saveEmotionState(state) {
  try { fs.writeFileSync(EMOTION_STATE_FILE, JSON.stringify(state)); } catch {}
}

function getEmotionDefault() {
  return {
    mood: 0.5,           // 0~1, 0.5=neutral
    affection: 0.0,      // 0~1, relationship affection level
    lastInteraction: 0,  // timestamp
    emotionHistory: [],  // recent emotion changes
    relationshipStage: 'stranger'
  };
}

function ensureUserEmotion(userId) {
  const state = loadEmotionState();
  if (!state[userId]) state[userId] = getEmotionDefault();
  return state;
}

function getRelationshipStage(affection) {
  if (affection >= 0.7) return 'lover';
  if (affection >= 0.5) return 'close_friend';
  if (affection >= 0.3) return 'friend';
  if (affection >= 0.1) return 'acquaintance';
  return 'stranger';
}

function detectEmotion(userMsg) {
  if (!userMsg || userMsg.trim().length === 0) {
    return { moodChange: 0, affectionChange: 0, detectedEmotion: 'neutral' };
  }
  if (userMsg.trim().length <= 2) {
    // Very short messages like "嗯", "好", "哦" — slight positive by default
    return { moodChange: 0.01, affectionChange: 0.001, detectedEmotion: 'neutral' };
  }

  let moodChange = 0;
  let affectionChange = 0;
  let detectedEmotion = 'neutral';

  // Count positive/negative word matches
  const posCount = POSITIVE_WORDS.filter(w => userMsg.includes(w)).length;
  const negCount = NEGATIVE_WORDS.filter(w => userMsg.includes(w)).length;
  const affPosCount = AFFECTION_WORDS_POS.filter(w => userMsg.includes(w)).length;
  const affNegCount = AFFECTION_WORDS_NEG.filter(w => userMsg.includes(w)).length;

  if (posCount > negCount) {
    const net = Math.min(Math.max((posCount - negCount) * 0.03, 0), 0.2);
    moodChange = net;
    detectedEmotion = 'positive';
  } else if (negCount > posCount) {
    const net = Math.min(Math.max((negCount - posCount) * -0.04, -0.25), 0);
    moodChange = net;
    detectedEmotion = 'negative';
  }

  if (affPosCount > 0) {
    affectionChange = Math.min(affPosCount * 0.015, 0.1);
    if (detectedEmotion === 'neutral') detectedEmotion = 'positive';
  }
  if (affNegCount > 0) {
    affectionChange = Math.max(affNegCount * -0.05, -0.2);
    detectedEmotion = 'negative';
  }

  return { moodChange, affectionChange, detectedEmotion };
}

function applyMoodDecay(userId) {
  const state = loadEmotionState();
  if (!state[userId]) state[userId] = getEmotionDefault();
  const u = state[userId];
  const now = Date.now();

  // Mood drifts toward 0.5 (neutral) over time
  if (u.mood > 0.5) {
    u.mood = Math.max(0.5, u.mood - 0.02);
  } else if (u.mood < 0.5) {
    u.mood = Math.min(0.5, u.mood + 0.02);
  }

  // Affection decays after 24h of no contact
  if (u.lastInteraction > 0) {
    const hoursSinceLast = (now - u.lastInteraction) / (1000 * 60 * 60);
    if (hoursSinceLast > 24) {
      const decayDays = Math.floor(hoursSinceLast / 24);
      u.affection = Math.max(0, u.affection - decayDays * 0.01);
    }
  }

  // Update relationship stage
  u.relationshipStage = getRelationshipStage(u.affection);

  saveEmotionState(state);
  return u;
}

function updateEmotion(userId, userMsg) {
  applyMoodDecay(userId);
  const state = loadEmotionState();
  if (!state[userId]) state[userId] = getEmotionDefault();
  const u = state[userId];
  const now = Date.now();

  const { moodChange, affectionChange, detectedEmotion } = detectEmotion(userMsg);

  // Apply changes
  u.mood = Math.max(0, Math.min(1, u.mood + moodChange));
  u.affection = Math.max(0, Math.min(1, u.affection + affectionChange));
  u.lastInteraction = now;

  // Record emotional history (keep last 10)
  u.emotionHistory.push({
    time: now,
    emotion: detectedEmotion,
    moodChange: Math.round(moodChange * 100) / 100,
    affectionChange: Math.round(affectionChange * 100) / 100
  });
  if (u.emotionHistory.length > 10) {
    u.emotionHistory = u.emotionHistory.slice(-10);
  }

  // Update relationship stage
  u.relationshipStage = getRelationshipStage(u.affection);

  saveEmotionState(state);
}

function buildEmotionContext(userId) {
  const state = loadEmotionState();
  if (!state[userId]) return '';

  const u = state[userId];
  const stageLabel = {
    'stranger': '陌生人',
    'acquaintance': '认识的人',
    'friend': '朋友',
    'close_friend': '好朋友',
    'lover': '亲密的人'
  };

  const moodLabel = u.mood > 0.6 ? '不错' : u.mood > 0.4 ? '一般' : '不太好';
  const stageDisplay = stageLabel[u.relationshipStage] || u.relationshipStage;

  let context = `\n\n【情绪状态】你现在的心情${moodLabel}，和对方的关系是「${stageDisplay}」。`;

  // Add recent emotional history if any
  const recent = u.emotionHistory.slice(-3);
  if (recent.length >= 2) {
    const recentEmotions = recent.map(e => e.emotion === 'positive' ? '开心' : e.emotion === 'negative' ? '低落' : '平静').join(' → ');
    context += ` 最近的互动氛围：${recentEmotions}。`;
  }

  return context;
}

// ====== AI 并发控制 ======
const aiQueue = [];           // 等待队列
let aiRunning = 0;            // 当前正在执行的 AI 调用数
const AI_MAX_CONCURRENT = 3;  // 最大并发数

function enqueueAiCall(fn) {
  return new Promise((resolve, reject) => {
    aiQueue.push({ fn, resolve, reject });
    processAiQueue();
  });
}

function processAiQueue() {
  while (aiRunning < AI_MAX_CONCURRENT && aiQueue.length > 0) {
    const { fn, resolve, reject } = aiQueue.shift();
    aiRunning++;
    fn().then(resolve).catch(reject).finally(() => {
      aiRunning--;
      processAiQueue();
    });
  }
}

// 带超时的 Promise 包装器
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)
    )
  ]);
}

// ---- Add-friend state (must be at module level to persist across requests) ----
let addFriendKey = null, addFriendStatus = 'idle', addFriendTimer = null;
let currentUserId = null;
function startAddFriendPolling(key) {
  if (addFriendTimer) clearInterval(addFriendTimer);
  addFriendKey = key; addFriendStatus = 'waiting';
  addFriendTimer = setInterval(async () => {
    try {
      const data = await ilinkGet(`/ilink/bot/get_qrcode_status?qrcode=${key}`, { 'iLink-App-ClientVersion': '1' });
      if (data.status === 'confirmed') {
        addFriendStatus = 'confirmed';
        clearInterval(addFriendTimer); addFriendTimer = null;
        if (data.ilink_user_id && !contextTokens[data.ilink_user_id]) {
          contextTokens[data.ilink_user_id] = '';
          saveState();
          console.log(`[ADD-FRIEND] New user added: ${(data.ilink_user_id||'').slice(0,16)}`);
          console.log(`[ADD-FRIEND] Context token empty for ${(data.ilink_user_id||'').slice(0,16)} — auto-reply will work after first message poll`);
        }
        exhaustMessages();
      } else if (data.status === 'expired') { addFriendStatus = 'expired'; clearInterval(addFriendTimer); addFriendTimer = null; }
    } catch {}
  }, 2000);
}

function saveState() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify({ botToken, botId, botUserId, cursor, contextTokens, messages, msgId })); } catch {}
}
function loadState() {
  try { const d = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); if (d.botToken) botToken = d.botToken; if (d.botId) botId = d.botId; if (d.botUserId) botUserId = d.botUserId; if (d.cursor) cursor = d.cursor; if (d.contextTokens) Object.assign(contextTokens, d.contextTokens); if (d.messages) { messages.length = 0; messages.push(...d.messages); msgId = d.msgId || messages.length; } console.log(`[STATE] Restored: ${Object.keys(contextTokens).length} users, ${messages.length} msgs`); } catch {}
}
loadState(); if (botToken && Object.keys(contextTokens).length > 0) { console.log('[INIT] Saved session found, auto-starting message polling...'); setTimeout(() => startMsgPolling(), 1000); }

const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png' };

// ---- iLink API (匹配 Python _post 实现) ----
function buildHeaders(token) {
  const uin = Buffer.from(String(Math.floor(Math.random() * 0xFFFFFFFF))).toString('base64');
  return {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Authorization': `Bearer ${token}`,
    'X-WECHAT-UIN': uin,
  };
}

function ilinkPost(endpoint, body, token, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    // Python: body["base_info"] = {"channel_version": "1.0.3"}
    body.base_info = { channel_version: '1.0.3' };

    const data = JSON.stringify(body);
    const headers = buildHeaders(token);

    const opts = {
      hostname: ILINK_BASE,
      path: `/ilink/bot/${endpoint}`,
      method: 'POST',
      agent: false, // 禁用连接复用，避免超时后 socket hang up
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: timeoutMs,
    };

    const req = https.request(opts, (res) => {
      let respData = '';
      res.on('data', c => respData += c);
      res.on('end', () => {
        if (respData.trim() === '{}' || respData.trim() === '') {
          resolve({ ret: 0 });
          return;
        }
        try {
          resolve(JSON.parse(respData));
        } catch (e) {
          console.log(`[PARSE ERROR] ${endpoint}: HTTP ${res.statusCode} body=${respData.slice(0,200)}`);
          resolve({ ret: -1, errmsg: 'parse error', statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (e) => {
      console.log(`[REQUEST ERROR] ${endpoint}: ${e.message}`);
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`[TIMEOUT] ${endpoint}`);
      reject(new Error('timeout'));
    });

    req.write(data);
    req.end();
  });
}

function ilinkGet(path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: ILINK_BASE,
      path,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      timeout: 10000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ ret: -1, errmsg: 'parse error' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ---- QR login polling ----
let qrPollTimer = null;
function startQrPolling(key) {
  if (qrPollTimer) clearInterval(qrPollTimer);
  if (botToken) { console.log('[QR] Already connected'); return; }
  qrStatus = 'waiting'; qrcodeKey = key;
  console.log(`[QR] Polling started key=${key.slice(0,16)}...`);
  qrPollTimer = setInterval(async () => {
    try {
      const data = await ilinkGet(`/ilink/bot/get_qrcode_status?qrcode=${key}`, { 'iLink-App-ClientVersion': '1' });
      const st = data.status;
      if (st === 'scaned') { qrStatus = 'scaned'; }
      else if (st === 'confirmed') {
        qrStatus = 'confirmed';
        botToken = data.bot_token;
        botId = data.ilink_bot_id
        saveState() || null;
        botUserId = data.ilink_user_id || null;
        console.log(`[QR] CONFIRMED! Bot: ${(botId||'').slice(0,16)}`);
        clearInterval(qrPollTimer); qrPollTimer = null;
        startMsgPolling();
      } else if (st === 'expired') { qrStatus = 'expired'; clearInterval(qrPollTimer); qrPollTimer = null; }
    } catch (e) { console.log('[QR] Poll error:', e.message); }
  }, 2000);
}

// ---- Message polling ----
let pollTimer = null;
function startMsgPolling() {
  exhaustMessages().then(() => {
    console.log(`[MSG] Users: ${Object.keys(contextTokens).length}, Messages: ${messages.length}`);
    startScheduledReplies();
    pollTimer = setInterval(pollMessages, 2000);
  });
}

async function exhaustMessages() {
  if (!botToken) return;
  for (let i = 0; i < 10; i++) {
    try {
      const result = await ilinkPost('getupdates', { get_updates_buf: cursor }, botToken, 25000);
      console.log(`[EXHAUST] #${i+1}: ret=${result.ret} msgs=${(result.msgs||[]).length}`);
      if (result.ret === -1) { console.log('[EXHAUST] ERROR:', result.errmsg); break; }
      if (result.get_updates_buf) cursor = result.get_updates_buf;
      for (const msg of (result.msgs || [])) {
        const fromUser = msg.from_user_id;
        const ctxToken = msg.context_token;
        if (fromUser && ctxToken) { contextTokens[fromUser] = ctxToken; }
        for (const item of (msg.item_list || [])) {
          if (item.type === 1) {
            const text = item.text_item?.text || '';
            if (text) { messages.push({ id: ++msgId, from: fromUser, text, time: Date.now(), dir: 'in' }); if (msg.id) processedMsgIds.add(msg.id); }
          }
        }
      }
      if ((result.msgs||[]).length === 0) break;
    } catch (e) { console.log('[EXHAUST] Exception:', e.message); break; }
  }
}

async function pollMessages() {
  if (!botToken) return;
  try {
    const result = await ilinkPost('getupdates', { get_updates_buf: cursor }, botToken, 25000);
    if (result.ret === -1) { console.log(`[POLL] ret=-1: ${result.errmsg||''} code=${result.statusCode||''}`); return; }
    const n = (result.msgs||[]).length;
    if (n > 0) console.log(`[POLL] New msgs: ${n}, total: ${messages.length}`);
    if (result.get_updates_buf) cursor = result.get_updates_buf;
    for (const msg of (result.msgs || [])) {
      const fromUser = msg.from_user_id;
      const ctxToken = msg.context_token;
      if (fromUser && ctxToken && !contextTokens[fromUser]) { contextTokens[fromUser] = ctxToken; saveState(); startScheduledReplies(); console.log(`[POLL] New user: ${(fromUser||'').slice(0,16)}`); for (const pm of messages) { if (pm.from === fromUser && pm.dir === 'in' && pm.text) autoReply(fromUser, pm.text); } }
      let msgText = '', msgMedia = null;
      for (const item of (msg.item_list || [])) {
        if (item.text_item) msgText = item.text_item.text || '';
        // 媒体消息：用键名判断类型（iLink API 无 type 字段）
        if (item.image_item) {
          msgMedia = { type: 'image', filename: item.image_item.filename || 'image.jpg', cdn: item.image_item.media || null, aeskey: item.image_item.aeskey || null };
          msgText = msgText || '[图片]';
        } else if (item.voice_item) {
          msgMedia = { type: 'voice', filename: 'voice.silk', cdn: item.voice_item.media || null };
          msgText = msgText || '[语音]';
        } else if (item.file_item) {
          const fn = item.file_item.file_name || 'file.bin';
          msgMedia = { type: 'file', filename: fn, cdn: item.file_item.media || null, md5: item.file_item.md5, size: item.file_item.len };
          msgText = msgText || `[文件] ${fn}`;
        } else if (item.video_item) {
          msgMedia = { type: 'video', filename: item.video_item.filename || 'video.mp4', cdn: item.video_item.media || null };
          msgText = msgText || '[视频]';
        }
      }
      if (msgText || msgMedia) {
        let cacheKey = '';
        let mediaRef = msgMedia ? { ...msgMedia } : null;
        if (msgMedia && msgMedia.cdn) {
          cacheKey = mediaCacheKey(msgMedia.cdn);
          // Download & cache synchronously before pushing message
          try {
            const data = await downloadCdnMedia(msgMedia.cdn);
            if (data) {
              const ext = msgMedia.type === 'image' ? '.img' : '.dat';
              fs.writeFileSync(path.join(CACHE_DIR, cacheKey + ext), data);
              console.log(`[MEDIA] Cached ${cacheKey}: ${data.length} bytes`);
              mediaRef = { ...msgMedia, cache_key: cacheKey };
            }
          } catch (e) { console.log('[MEDIA] Error:', e.message); }
        }
        // Dedup: skip exact same API message (based on iLink message ID)
        if (msg.id && processedMsgIds.has(msg.id)) { continue; }
        if (msg.id) processedMsgIds.add(msg.id);
        messages.push({ id: ++msgId, from: fromUser, text: msgText, media: mediaRef, time: Date.now(), dir: 'in' });
        console.log(`[POLL] MSG #${msgId}: ${msgText.slice(0,50)}${msgMedia ? ` (${msgMedia.type})` : ''}`);
        // Auto-reply
        if (msgText && fromUser && !msgMedia) {
          console.log(`[DEBUG] Calling autoReply for ${(fromUser||'').slice(0,16)}: ${msgText.slice(0,20)}`);
          // 情绪追踪：检测用户消息情绪
          updateEmotion(fromUser, msgText);
          // 保存用户消息到记忆
          const cfgMem = loadAiConfig();
          if (cfgMem.memory_enabled) {
            addMemory(fromUser, 'user', msgText);
          }
          autoReply(fromUser, msgText);
        }
      }
    }
  } catch (e) { console.log('[POLL] Exception:', e.message); }
}

// ---- AI Config ----
function loadAiConfig() {
  try { return JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf-8')); } catch { return { enabled: false, api_url: '', api_key: '', model: '', prompt: '', scheduled_reply: false, active_interval: 60, max_replies: 2, reply_min_chars: 0, reply_max_chars: 0, token_limit: 0, memory_enabled: false }; }
}
function saveAiConfig(cfg) {
  try { fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(cfg)); } catch {}
}

// ---- Persona / 角色卡 ----
function loadPersonas() {
  try { return JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf-8')); } catch { return {}; }
}
function savePersona(data) {
  const ps = loadPersonas();
  const id = data.id || 'persona_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  ps[id] = {
    id, name: data.name||'', personality: data.personality||'', style: data.style||'',
    background: data.background||'', details: data.details||'',
    mes_example: data.mes_example||'',
    skills: data.skills && data.skills.length > 0 ? data.skills : getBuiltinSkillIds(),
    createdAt: Date.now()
  };
  try { fs.writeFileSync(PERSONAS_FILE, JSON.stringify(ps)); } catch {}
  return id;
}
function deletePersona(id) {
  const ps = loadPersonas();
  delete ps[id];
  try { fs.writeFileSync(PERSONAS_FILE, JSON.stringify(ps)); } catch {}
  // Also remove from user map
  const map = loadPersonaMap();
  for (const uid of Object.keys(map)) { if (map[uid] === id) delete map[uid]; }
  try { fs.writeFileSync(PERSONA_MAP_FILE, JSON.stringify(map)); } catch {}
}
function loadPersonaMap() {
  try { return JSON.parse(fs.readFileSync(PERSONA_MAP_FILE, 'utf-8')); } catch { return {}; }
}

// ---- General Settings ----
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch {
    return {
      notify_sound: true, notify_desktop: true, notify_ai_indicator: true,
      notify_quiet_enabled: false, notify_quiet_start: "22:00", notify_quiet_end: "08:00",
      privacy_msg_encrypt: false, privacy_auto_delete: 0, privacy_read_receipt: true, privacy_show_online: true,
      general_language: "zh-CN", general_theme: "auto", general_font_size: "normal",
    };
  }
}
function saveSettings(cfg) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cfg)); } catch {}
}

// ====== IP Management ======
function loadIpRecords() {
  try { return JSON.parse(fs.readFileSync(IP_RECORDS_FILE, 'utf-8')); } catch { return {}; }
}
function saveIpRecords(records) {
  try { fs.writeFileSync(IP_RECORDS_FILE, JSON.stringify(records, null, 2)); } catch {}
}
function loadIpBlacklist() {
  try { return JSON.parse(fs.readFileSync(IP_BLACKLIST_FILE, 'utf-8')); } catch { return {}; }
}
function saveIpBlacklist(list) {
  try { fs.writeFileSync(IP_BLACKLIST_FILE, JSON.stringify(list, null, 2)); } catch {}
}
function getRealIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || req.connection?.remoteAddress || 'unknown';
}
function isIpBanned(ip) {
  const bl = loadIpBlacklist();
  const entry = bl[ip];
  if (!entry || entry.status !== 1) return false;
  // Check expiry
  if (entry.expire_time && Date.now() > entry.expire_time) {
    entry.status = 0;
    saveIpBlacklist(bl);
    // Also update record status
    const records = loadIpRecords();
    if (records[ip]) records[ip].status = 'normal';
    saveIpRecords(records);
    console.log(`[IP-BAN] Auto-unbanned (expired): ${ip}`);
    return false;
  }
  return true;
}
async function geolocateIp(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
    return { country: '本机', province: '-', city: '-', district: '-', isp: '-' };
  }
  try {
    const data = await httpGet(`http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN`, 5000);
    const d = JSON.parse(data);
    if (d.status === 'success') {
      return {
        country: d.country || '未知',
        province: d.regionName || d.region || '未知',
        city: d.city || '未知',
        district: d.district || '-',
        isp: d.isp || d.org || '未知',
      };
    }
  } catch {}
  return { country: '未知', province: '未知', city: '未知', district: '-', isp: '未知' };
}
async function recordIpAccess(ip) {
  if (!ip || ip === 'unknown') return;
  const records = loadIpRecords();
  if (records[ip]) {
    records[ip].login_count = (records[ip].login_count || 0) + 1;
    records[ip].last_login = Date.now();
  } else {
    const geo = await geolocateIp(ip);
    records[ip] = {
      ip_address: ip,
      country: geo.country,
      province: geo.province,
      city: geo.city,
      district: geo.district,
      isp: geo.isp,
      first_login: Date.now(),
      last_login: Date.now(),
      login_count: 1,
      status: 'normal',
    };
  }
  saveIpRecords(records);
}

// ---- Auto-delete old messages based on privacy settings ----
function cleanupOldMessages() {
  const s = loadSettings();
  if (!s.privacy_auto_delete || s.privacy_auto_delete <= 0) return;
  const cutoff = Date.now() - s.privacy_auto_delete * 24 * 60 * 60 * 1000;
  const before = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].time < cutoff) messages.splice(i, 1);
  }
  if (messages.length < before) console.log(`[CLEANUP] Deleted ${before - messages.length} old messages (>${s.privacy_auto_delete}d)`);
}
// Run cleanup every 10 minutes
setInterval(cleanupOldMessages, 10 * 60 * 1000);
// Persist messages every 30 seconds
setInterval(() => { if (messages.length > 0) saveState(); }, 30 * 1000);
// 清理 processedMsgIds 防止内存泄漏（每10分钟清理一次，保留最近1000条）
setInterval(() => {
  if (processedMsgIds.size > 1000) {
    const arr = Array.from(processedMsgIds);
    arr.splice(0, arr.length - 500);
    processedMsgIds.clear();
    arr.forEach(id => processedMsgIds.add(id));
    console.log(`[CLEANUP] Trimmed processedMsgIds to ${processedMsgIds.size}`);
  }
}, 10 * 60 * 1000);

// ====== Feature Skill Engine ======
// Each feature: { id, name, triggers[], fetcher(msg) → string|null }
// fetcher returns formatted text to inject into AI context, or null if no match.

function extractCity(msg) {
  // Extract Chinese city name from message (2-4 chars before 天气/气温/下雨)
  const m = msg.match(/([一-龥]{2,4}?)(?:天气|气温|下雨|下雪|晴|温度|热不热|冷不冷)/);
  if (m) return m[1];
  // Common city names mentioned directly
  const cities = ['北京','上海','广州','深圳','杭州','成都','重庆','武汉','南京','西安','天津','苏州','长沙','郑州','青岛','大连','厦门','宁波','福州','合肥','昆明','贵阳','南宁','哈尔滨','长春','沈阳','济南','太原','石家庄','呼和浩特','兰州','西宁','银川','乌鲁木齐','拉萨','海口','三亚','珠海','东莞','佛山','无锡','常州','徐州','温州','泉州','烟台','潍坊','淄博','洛阳','襄阳','宜昌','岳阳','常德','衡阳','株洲','九江','赣州','漳州','龙岩','南平','三明','宁德','莆田','泉州','晋江','石狮','南安','惠安','安溪','永春','德化','金门','连江','罗源','闽清','永泰','平潭','长乐','福清','闽侯'];
  for (const c of cities) { if (msg.includes(c)) return c; }
  return '北京';
}

function httpGet(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get({ hostname: u.hostname, path: u.pathname + u.search, timeout }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const FEATURE_DEFS = [
  {
    id: 'weather', name: '天气查询', icon: '🌤',
    triggers: ['天气', '气温', '下雨', '下雪', '温度', '热不热', '冷不冷', '晴天', '雨天'],
    async fetcher(msg) {
      try {
        const city = extractCity(msg);
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`;
        const raw = await httpGet(url);
        const d = JSON.parse(raw);
        const cur = d.current_condition?.[0];
        if (!cur) return null;
        const desc = cur.lang_zh?.[0]?.value || cur.weatherDesc?.[0]?.value || '';
        const temp = cur.temp_C;
        const feels = cur.FeelsLikeC;
        const hum = cur.humidity;
        const wind = cur.windspeedKmph;
        const windDir = cur.winddir16Point;
        // Today forecast
        const today = d.weather?.[0];
        const maxT = today?.maxtempC || '';
        const minT = today?.mintempC || '';
        const sunrise = today?.astronomy?.[0]?.sunrise || '';
        const sunset = today?.astronomy?.[0]?.sunset || '';
        return `【${city}天气实况】\n天气：${desc}\n气温：${temp}°C（体感${feels}°C）\n今日：${minT}~${maxT}°C\n湿度：${hum}%\n风：${windDir} ${wind}km/h\n日出${sunrise} 日落${sunset}`;
      } catch { return null; }
    }
  },
  {
    id: 'weather_3d', name: '天气预报', icon: '📅',
    triggers: ['天气预报', '未来天气', '明天天气', '后天天气', '这周天气'],
    async fetcher(msg) {
      try {
        const city = extractCity(msg);
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`;
        const raw = await httpGet(url);
        const d = JSON.parse(raw);
        const days = (d.weather || []).slice(0, 3);
        if (!days.length) return null;
        const lines = days.map((w, i) => {
          const desc = w.hourly?.[4]?.lang_zh?.[0]?.value || '';
          return `${i === 0 ? '今天' : i === 1 ? '明天' : '后天'}：${w.mintempC}~${w.maxtempC}°C ${desc}`;
        });
        return `【${city}三日预报】\n${lines.join('\n')}`;
      } catch { return null; }
    }
  },
  {
    id: 'ip_location', name: 'IP定位', icon: '📍',
    triggers: ['我在哪', '我的位置', 'IP地址', 'IP定位', '我的IP', '查IP'],
    async fetcher(msg) {
      try {
        // Check if user provided a specific IP
        const ipMatch = msg.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        const ip = ipMatch ? ipMatch[1] : '';
        const url = ip ? `http://ip-api.com/json/${ip}?lang=zh-CN` : `http://ip-api.com/json/?lang=zh-CN`;
        const raw = await httpGet(url);
        const d = JSON.parse(raw);
        if (d.status !== 'success') return null;
        return `【IP定位结果】\nIP：${d.query}\n位置：${d.country} ${d.regionName} ${d.city}\n运营商：${d.isp}\n坐标：${d.lat},${d.lon}`;
      } catch { return null; }
    }
  },
  {
    id: 'exchange_rate', name: '汇率换算', icon: '💱',
    triggers: ['汇率', '换算', '美元', '日元', '欧元', '英镑', '港币', '韩元', '泰铢', '人民币'],
    async fetcher(msg) {
      try {
        // Detect currency pairs
        const currencyMap = { '美元': 'USD', '日元': 'JPY', '欧元': 'EUR', '英镑': 'GBP', '港币': 'HKD', '韩元': 'KRW', '泰铢': 'THB', '人民币': 'CNY', '澳元': 'AUD', '加元': 'CAD', '新加坡': 'SGD', '新币': 'SGD', '台币': 'TWD' };
        let from = 'USD', to = 'CNY';
        for (const [cn, code] of Object.entries(currencyMap)) {
          if (msg.includes(cn)) { from = code; break; }
        }
        if (from === 'CNY') to = 'USD';
        // Check if user wants to convert to another currency
        for (const [cn, code] of Object.entries(currencyMap)) {
          if (msg.includes(cn) && code !== from) { to = code; break; }
        }
        const url = `https://open.er-api.com/v6/latest/${from}`;
        const raw = await httpGet(url);
        const d = JSON.parse(raw);
        if (d.result !== 'success') return null;
        const rate = d.rates?.[to];
        if (!rate) return null;
        // Also get CNY rate for reference
        const cnyRate = d.rates?.['CNY'];
        return `【实时汇率】\n1 ${from} = ${rate} ${to}${cnyRate && to !== 'CNY' ? `\n1 ${from} = ${cnyRate} CNY` : ''}\n更新时间：${d.time_last_update_utc}`;
      } catch { return null; }
    }
  },
  {
    id: 'hitokoto', name: '随机一言', icon: '💭',
    triggers: ['一言', '说句话', '来句话', '名言', '语录'],
    async fetcher() {
      try {
        const raw = await httpGet('https://v1.hitokoto.cn/');
        const d = JSON.parse(raw);
        return `【一言】\n"${d.hitokoto}"\n——${d.from_who || ''}《${d.from}》`;
      } catch { return null; }
    }
  },
  {
    id: 'joke', name: '随机笑话', icon: '😂',
    triggers: ['笑话', '讲个笑话', '搞笑', '逗我', '幽默'],
    async fetcher() {
      try {
        const raw = await httpGet('https://official-joke-api.appspot.com/random_joke');
        const d = JSON.parse(raw);
        return `【笑话】\n${d.setup}\n${d.punchline}`;
      } catch { return null; }
    }
  },
  {
    id: 'cat_image', name: '随机猫咪', icon: '🐱',
    triggers: ['猫咪', '猫猫', '喵', '猫图', '吸猫'],
    async fetcher() {
      try {
        const raw = await httpGet('https://api.thecatapi.com/v1/images/search');
        const d = JSON.parse(raw);
        return d[0]?.url ? `【随机猫咪图】\n${d[0].url}` : null;
      } catch { return null; }
    }
  },
  {
    id: 'dog_image', name: '随机狗狗', icon: '🐶',
    triggers: ['狗狗', '汪', '狗图', '柴犬', '哈士奇'],
    async fetcher() {
      try {
        const raw = await httpGet('https://dog.ceo/api/breeds/image/random');
        const d = JSON.parse(raw);
        return d.message ? `【随机狗狗图】\n${d.message}` : null;
      } catch { return null; }
    }
  },
  {
    id: 'crypto', name: '加密货币', icon: '₿',
    triggers: ['比特币', '币价', '以太坊', '加密货币', 'BTC', 'ETH', '狗狗币'],
    async fetcher(msg) {
      try {
        const coinMap = { '比特币': 'bitcoin', 'btc': 'bitcoin', '以太坊': 'ethereum', 'eth': 'ethereum', '狗狗币': 'dogecoin', 'doge': 'dogecoin', '币安': 'binancecoin', 'bnb': 'binancecoin', 'sol': 'solana', 'solana': 'solana' };
        let coin = 'bitcoin';
        for (const [k, v] of Object.entries(coinMap)) { if (msg.toLowerCase().includes(k)) { coin = v; break; } }
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,cny&include_24hr_change=true`;
        const raw = await httpGet(url);
        const d = JSON.parse(raw);
        const info = d[coin];
        if (!info) return null;
        const change = info.usd_24h_change?.toFixed(2) || 'N/A';
        return `【${coin.toUpperCase()} 实时价格】\n$${info.usd?.toLocaleString()} USD\n¥${info.cny?.toLocaleString()} CNY\n24h 涨跌：${change}%`;
      } catch { return null; }
    }
  },
  {
    id: 'news_hn', name: '科技新闻', icon: '📰',
    triggers: ['新闻', '科技新闻', '最新资讯', '头条', '热点'],
    async fetcher() {
      try {
        const raw = await httpGet('https://hacker-news.firebaseio.com/v0/topstories.json');
        const ids = JSON.parse(raw).slice(0, 5);
        const items = await Promise.all(ids.map(async (id) => {
          const r = await httpGet(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return JSON.parse(r);
        }));
        const lines = items.map((it, i) => `${i + 1}. ${it.title} (${it.score}分)`).join('\n');
        return `【今日科技热榜 Hacker News】\n${lines}`;
      } catch { return null; }
    }
  },
  {
    id: 'numbers', name: '数字趣闻', icon: '🔢',
    triggers: ['数字趣闻', '趣味数字', '数字 trivia', '数字冷知识'],
    async fetcher(msg) {
      try {
        const numMatch = msg.match(/(\d+)/);
        const num = numMatch ? numMatch[1] : 'random';
        const raw = await httpGet(`http://numbersapi.com/${num}/trivia`);
        return `【数字趣闻】\n${raw}`;
      } catch { return null; }
    }
  },
];

// Match user message against enabled features, fetch data, return context string
async function matchAndFetchFeatures(userMsg) {
  const settings = loadSettings();
  const features = settings.features || {};
  const matched = [];
  for (const feat of FEATURE_DEFS) {
    if (features[feat.id] === false) continue; // explicitly disabled
    // Default: enabled (only disabled if explicitly set to false)
    const triggered = feat.triggers.some(t => userMsg.includes(t));
    if (triggered) matched.push(feat);
  }
  if (matched.length === 0) return '';
  // Fetch all matched features in parallel（每个 feature 最多 5 秒超时）
  const results = await Promise.all(matched.map(async (f) => {
    try {
      const data = await withTimeout(f.fetcher(userMsg), 5000, `feature:${f.id}`);
      return data ? `\n${data}` : '';
    } catch { return ''; }
  }));
  const context = results.filter(Boolean).join('\n');
  return context ? `\n\n【实时数据参考】${context}\n请根据以上实时数据来回答用户的问题，用自然口语化的方式表达。` : '';
}

// Feature list for API
function getFeatureList() {
  const settings = loadSettings();
  const features = settings.features || {};
  return FEATURE_DEFS.map(f => ({
    id: f.id, name: f.name, icon: f.icon,
    enabled: features[f.id] !== false, // default true
    triggers: f.triggers.slice(0, 3), // show first 3 triggers
  }));
}

// ---- Scheduled Messages (全局定时器) ----
let schedTimer = null;
function startScheduledReplies() {
  if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  const cfg = loadAiConfig();
  if (!cfg.enabled || !cfg.scheduled_reply || !cfg.api_url || !cfg.api_key) return;
  // active_interval 统一为秒
  const intervalSec = (cfg.active_interval || 1) * 60;
  const intervalMs = intervalSec * 1000;
  console.log(`[SCHED] Started (every ${intervalSec}s, ${Object.keys(contextTokens).length} users)`);
  schedTimer = setInterval(async () => {
    // 检查连接状态
    if (!botToken) { console.log('[SCHED] Bot not connected, skipping'); return; }
    const c = loadAiConfig();
    if (!c.enabled || !c.scheduled_reply) return;
    const now = Date.now();
    for (const uid of Object.keys(contextTokens)) {
      const ctx = contextTokens[uid];
      if (!ctx) continue;
      // 找到该用户最近一条消息的时间（active_interval 统一用秒）
      const lastMsg = messages.filter(m => (m.from === uid || m.to === uid)).pop();
      if (lastMsg && (now - lastMsg.time) < intervalSec * 1000) {
        continue; // 用户最近有过对话，跳过本次定时问候
      }
      try {
        const url = c.api_url.replace(/\/+$/, '') + (c.api_url.includes('/chat/completions') ? '' : '/chat/completions');
        // 定时问候也应用字数限制
        let limitHint = '';
        if (c.reply_max_chars > 0) {
          if (c.reply_min_chars > 0 && c.reply_min_chars <= c.reply_max_chars) {
            limitHint = `（回复控制在 ${c.reply_min_chars}~${c.reply_max_chars} 字之间）`;
          } else {
            limitHint = `（回复不超过 ${c.reply_max_chars} 字）`;
          }
        }
        const sPrompt = c.prompt
          ? `${c.prompt}\n\n你现在想主动给对方发一条消息。随便说点什么日常的。${limitHint}`
          : `你是微信上的一个真实好友。说话短而自然，像真人聊天。${limitHint}\n\n你现在想主动给对方发一条消息。不用很正式，随便说点什么就好。`;
        const msgs = [{ role: 'system', content: sPrompt }];
        msgs.push({ role: 'user', content: '发一条问候' });
        let schedMaxTokens;
        if (c.token_limit > 0) {
          schedMaxTokens = c.token_limit;
        } else if (c.reply_max_chars > 0) {
          schedMaxTokens = Math.min(Math.max(Math.ceil(c.reply_max_chars * 1.5) + 50, 100), 4096);
        }
        const bodyObj2 = { model: c.model, messages: msgs };
        if (schedMaxTokens) bodyObj2.max_tokens = schedMaxTokens;
        const body = JSON.stringify(bodyObj2);
        const result = await new Promise((res, rej) => {
          const u = new URL(url);
          const opts = { hostname: u.hostname, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.api_key, 'Content-Length': Buffer.byteLength(body) }, timeout: 30000 };
          const r = https.request(opts, (resp) => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => res(d)); });
          r.on('error', rej); r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); }); r.write(body); r.end();
        });
        const j = JSON.parse(result);
        let reply = j.choices?.[0]?.message?.content || '';
        if (!reply) continue;
        // 后端硬性截断（定时发送也应用字数限制）
        // 后处理：剥离括号、emoji、标签
        const cleanSched = cleanReply(reply);
        if (cleanSched !== reply) {
          console.log(`[SCHED] Cleaned: "${reply.slice(0,40)}" → "${cleanSched.slice(0,40)}"`);
          reply = cleanSched;
        }
        if (c.reply_max_chars > 0 && reply.length > c.reply_max_chars) {
          reply = reply.slice(0, c.reply_max_chars);
        }
        const sendR = await ilinkPost('sendmessage', { msg: { from_user_id: '', to_user_id: uid, client_id: 'sched-' + Date.now().toString(36), message_type: 2, message_state: 2, context_token: ctx, item_list: [{ type: 1, text_item: { text: reply } }] } }, botToken);
        if (!sendR.errcode && sendR.ret !== -1) {
          messages.push({ id: ++msgId, to: uid, text: reply, time: Date.now(), dir: 'out', is_ai: true });
          console.log(`[SCHED] ${uid.slice(0,16)}: ${reply.slice(0,40)}`);
          // 保存定时问候到记忆
          if (c.memory_enabled) {
            addMemory(uid, 'assistant', reply);
          }
        }
      } catch (e) { console.log('[SCHED] Error:', e.message); }
    }
  }, intervalMs);
}
// Start scheduled replies when poll confirms
const origConfirm = startQrPolling;
// Trigger from save endpoint and after user added

// ---- AI Auto-reply ----
const autoReplyCounts = {};

// ====== TASK 1: 情绪分析函数 ======
async function analyzeUserEmotion(userMsg, userId) {
  try {
    // Local keyword scan using existing word lists
    const posCount = POSITIVE_WORDS.filter(w => userMsg.includes(w)).length;
    const negCount = NEGATIVE_WORDS.filter(w => userMsg.includes(w)).length;

    let keywordEmotion = '中性';
    let keywordValence = 'neutral';
    if (posCount > negCount * 2 && posCount >= 2) { keywordEmotion = '开心'; keywordValence = 'positive'; }
    else if (negCount > posCount * 2 && negCount >= 2) { keywordEmotion = '难过'; keywordValence = 'negative'; }

    // Read emotion history for AI context
    const state = loadEmotionState();
    const es = state[userId] || getEmotionDefault();
    const emotionHistory = es.emotionHistory || [];

    // Call AI for deep analysis
    const cfg = loadAiConfig();
    let aiResult = null;
    if (cfg.api_url && cfg.api_key) {
      try {
        const historyContext = emotionHistory.length > 0
          ? `\n最近情绪历史: ${JSON.stringify(emotionHistory.slice(-5))}`
          : '';
        const analysisPrompt = `你是一个情感分析师。分析这条微信消息的情绪状态。
返回纯JSON，不要其他内容：
{"primary_emotion":"开心/难过/生气/焦虑/疲惫/无聊/撒娇/期待/中性",
 "intensity":0.0-1.0,
 "valence":"positive/negative/mixed/neutral",
 "subtext":"对方说这句话的潜台词是什么",
 "need":"对方需要什么——安慰/认同/陪伴/建议/空间/闲聊",
 "should_respond":"yes/no——如果对方明显不想聊，返回no"}

消息: ${userMsg}${historyContext}`;
        const url = cfg.api_url.replace(/\/+$/, '') + (cfg.api_url.includes('/chat/completions') ? '' : '/chat/completions');
        const body = JSON.stringify({
          model: cfg.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个情感分析专家。只返回JSON。' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.1,
          max_tokens: 300
        });
        const result = await new Promise((resolve, reject) => {
          const u = new URL(url);
          const opts = { hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key, 'Content-Length': Buffer.byteLength(body) }, timeout: 15000 };
          const r = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
          r.on('error', reject); r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); }); r.write(body); r.end();
        });
        const j = JSON.parse(result || '{}');
        const content = j.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) aiResult = JSON.parse(jsonMatch[0]);
      } catch (e) { console.log('[EMOTION-ANALYSIS] AI error:', e.message); }
    }

    // Merge keyword scan + AI analysis
    const primary_emotion = aiResult?.primary_emotion || keywordEmotion;
    const intensity = aiResult?.intensity || Math.min(Math.max((posCount + negCount) * 0.1 + 0.1, 0.1), 0.8);
    const valence = aiResult?.valence || keywordValence;
    const subtext = aiResult?.subtext || '';
    const need = aiResult?.need || '闲聊';
    const should_respond = aiResult?.should_respond !== 'no';

    return { primary_emotion, intensity, valence, subtext, need, strategy: null, should_respond };
  } catch (e) {
    console.log('[EMOTION-ANALYSIS] Error:', e.message);
    return { primary_emotion: '中性', intensity: 0.3, valence: 'neutral', subtext: '', need: '闲聊', strategy: null, should_respond: true };
  }
}

// ====== TASK 2: 回复策略选择 ======
function selectReplyStrategy(emotion, affection) {
  const strategyMap = {
    '开心': { action: 'mirror_happy', guide: '对方在分享快乐，你应该一起开心，+1，顺势分享你自己相关的事' },
    '疲惫': { action: 'comfort_gentle', guide: '对方需要的是被理解而不是建议。先共情，不问问题，不追问他累不累' },
    '撒娇': { action: 'play_along', guide: '对方在撒娇求关注。配合ta，宠溺一点，但不要拆穿ta在撒娇' },
    '生气': { action: 'deescalate', guide: '对方在生气。不要讲道理，不要解释，先承认对方的情绪是合理的' },
    '焦虑': { action: 'reassure', guide: '给对方安全感。不敷衍，不说别担心。先接住情绪再轻轻带过' },
    '无聊': { action: 'spark_interest', guide: '抛出新鲜话题，但不要追问对方为什么不说话。分享而不是查户口' },
    '期待': { action: 'build_excitement', guide: '和对方一起期待。给明确回应，不要泼冷水' },
    '伤心': { action: 'hold_space', guide: '陪伴比语言重要。不要说别哭了，不要给建议，安静地陪着就好' },
    '压力': { action: 'lighten_load', guide: '帮对方减压而不是加压。别说加油，别说你可以的——ta已经很努力了' },
    '混合': { action: 'adaptive', guide: '检测到混合情绪。先回应主情绪，再轻轻带过副情绪' },
    '中性': { action: 'mood_driven', guide: '根据自身心情和好感度决定回复态度' },
    '难过': { action: 'hold_space', guide: '陪伴比语言重要。不要说别哭了，不要给建议，安静地陪着就好' },
  };
  const strategy = strategyMap[emotion] || strategyMap['中性'];
  let warmthModifier = '';
  if (affection < 0.3) warmthModifier = ' (对方和你不熟，保持距离感，不要太热情)';
  else if (affection > 0.6) warmthModifier = ' (你们关系亲密，可以更温暖主动一些)';
  return { action: strategy.action, guide: strategy.guide + warmthModifier };
}

// ====== TASK 3: 回复质量审核 ======
async function reviewReply(reply, strategy, emotion) {
  try {
    const cfg = loadAiConfig();
    if (!cfg.api_url || !cfg.api_key) return null;
    const reviewPrompt = `你是一个质量审核员。检查以下回复是否符合要求的策略和情绪。
策略: ${strategy.guide}
回复: ${reply}
只回复JSON: {"pass":true/false, "score":0-100, "fixed_reply":"如果不通过，给出修改后的回复"}`;
    const url = cfg.api_url.replace(/\/+$/, '') + (cfg.api_url.includes('/chat/completions') ? '' : '/chat/completions');
    const body = JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个质量审核员。只返回JSON。' },
        { role: 'user', content: reviewPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });
    const result = await new Promise((resolve, reject) => {
      const u = new URL(url);
      const opts = { hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key, 'Content-Length': Buffer.byteLength(body) }, timeout: 15000 };
      const r = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
      r.on('error', e => { console.log('[REVIEW] Request error:', e.message); resolve(null); });
      r.on('timeout', () => { r.destroy(); resolve(null); });
      r.write(body); r.end();
    });
    if (!result) return null;
    const j = JSON.parse(result || '{}');
    const content = j.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const reviewResult = JSON.parse(jsonMatch[0]);
    return { pass: reviewResult.pass === true, score: reviewResult.score || 0, fixed_reply: reviewResult.fixed_reply || reply };
  } catch (e) { console.log('[REVIEW] Error:', e.message); return null; }
}

// ====== 回复后处理：剥离括号、emoji、标签，只保留纯对话文字 ======
function cleanReply(text) {
  if (!text) return '';
  // 1. 剥离中文括号内容（动作描写）：（看了看手机）→ 删除
  text = text.replace(/（[^）]*）/g, '');
  // 2. 剥离英文括号内容
  text = text.replace(/\([^)]*\)/g, '');
  // 3. 剥离方括号标签（情绪/好感度/记忆等元标签）：[情绪:开心] → 删除
  text = text.replace(/\[[^\]]*\]/g, '');
  // 4. 剥离尖括号内容
  text = text.replace(/〈[^〉]*〉/g, '');
  text = text.replace(/<[^>]*>/g, '');
  // 5. 剥离 emoji 表情符号
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}]/gu, '');
  // 6. 剥离常见符号表情：XD :D :) :( :P ;) 等
  text = text.replace(/[:;=][-']?[)D(P\/|3@$*]/gi, '');
  // 7. 清理多余空格、连续换行
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/ {2,}/g, ' ');
  // 8. 去掉首尾空格和空行
  text = text.trim();
  // 9. 如果清理后变成了空字符串，返回一个安全的兜底
  if (!text || text.length === 0) return '嗯嗯';
  return text;
}

async function autoReply(toUser, userMsg) {
  // 用并发队列包装
  return enqueueAiCall(() => _autoReplyInner(toUser, userMsg));
}

async function _autoReplyInner(toUser, userMsg) {
  try {
    console.log(`[AI] autoReply called: user=${(toUser||'').slice(0,16)} msg=${(userMsg||'').slice(0,20)} queue=${aiQueue.length} running=${aiRunning}`);
    const cfg = loadAiConfig();
    if (!cfg.enabled || !cfg.api_url || !cfg.api_key || !cfg.model) { console.log('[AI] Config invalid:', JSON.stringify(cfg)); return; }
    const ctx = contextTokens[toUser];
    if (!ctx) { console.log('[AI] No context token for user'); return; }
    // Max replies per message
    const replyKey = toUser + ':' + userMsg;
    const replyCount = (autoReplyCounts[replyKey] || 0) + 1;
    autoReplyCounts[replyKey] = replyCount;
    setTimeout(() => { delete autoReplyCounts[replyKey]; }, 60000);
    if (replyCount > (cfg.max_replies ?? 2)) { console.log(`[AI] Skip #${replyCount} (max ${cfg.max_replies??2})`); return; }
    const url = cfg.api_url.replace(/\/+$/, '') + (cfg.api_url.includes('/chat/completions') ? '' : '/chat/completions');
    // Build system prompt: natural persona + skills merged as personality traits
    const pMap = loadPersonaMap();
    const pId = pMap[toUser];
    const persona = pId ? (loadPersonas()[pId] || null) : null;

    // ====== TASK 4: 情绪分析 + 策略选择 ======
    const emotionAnalysis = await analyzeUserEmotion(userMsg, toUser);
    const emotionStateForStrategy = loadEmotionState();
    const esForStrategy = emotionStateForStrategy[toUser] || getEmotionDefault();
    const replyStrategy = selectReplyStrategy(emotionAnalysis.primary_emotion, esForStrategy.affection);
    // 异步触发联网搜索（不阻塞，结果下次对话使用）
    searchWebForContext(userMsg).then(result => {
      if (result) console.log(`[AI] Web search result cached for next turn`);
    }).catch(() => {});

    // Layer 2 — Current emotional state + emotion analysis injection
    const emotionState = loadEmotionState();
    const es = emotionState[toUser] || getEmotionDefault();
    const moodLevel = es.mood || 0.5;
    const affLevel = (es.affection || 0) * 100;
    let moodHint = "";
    if (moodLevel < 0.2) moodHint = "你现在情绪很差，不想理人，说话会很冲。";
    else if (moodLevel < 0.4) moodHint = "你现在心情不太好，有点敷衍。";
    else if (moodLevel < 0.6) moodHint = "你现在心情一般，不好不坏。";
    else if (moodLevel < 0.8) moodHint = "你现在心情不错，愿意聊天。";
    else moodHint = "你现在心情特别好，元气满满。";
    let affHint = "";
    if (affLevel < 20) affHint = "你对对方没什么好感，不太想搭理。";
    else if (affLevel < 40) affHint = "你们关系一般，你会保持礼貌但不会主动。";
    else if (affLevel < 60) affHint = "你们算是普通朋友。";
    else if (affLevel < 80) affHint = "你挺喜欢对方的，会主动关心。";
    else affHint = "你很喜欢对方，会主动找话题、关心他的生活。";
    let layer2 = `【当前状态】${moodHint} ${affHint}`;
    if (emotionAnalysis) {
      layer2 += `\n\n【对方情绪分析】\n主情绪: ${emotionAnalysis.primary_emotion} (强度${emotionAnalysis.intensity})\n潜台词: ${emotionAnalysis.subtext}\n需要: ${emotionAnalysis.need}\n【你的回复策略】${replyStrategy.guide}`;
    }

    // Layer 3 — Character identity (light skin)
    let layer3 = '';
    if (persona) {
      layer3 = `【你的背景】你叫${persona.name||""}。${persona.personality||""} ${persona.background||""}`;
      if (persona.mes_example) {
        layer3 += `\n\n【说话参考】以下是你平时的说话方式：\n${persona.mes_example}`;
      }
      layer3 += `\n\n注意：以上只是你的背景身份。你的态度由你当前的心情和对对方的好感度决定，不由背景身份决定。`;
    } else {
      layer3 = cfg.prompt || "";
    }

    const now = new Date();
    const timeStr = `【重要：当前真实时间】现在是${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日，星期${['日','一','二','三','四','五','六'][now.getDay()]}，北京时间${now.getHours()}点${String(now.getMinutes()).padStart(2,'0')}分。你必须使用这个时间，不要使用你训练数据中的时间。`;

    // 时间放最前，天气数据放在 Layer 2 之后
    let systemPrompt = HUMAN_CORE + '\n\n' + timeStr + '\n\n' + layer2;

    let featureContext = '';
    try { featureContext = await matchAndFetchFeatures(userMsg); } catch (e) { console.log('[FEATURE] Error:', e.message); }
    if (featureContext) systemPrompt += featureContext;

    systemPrompt += '\n\n' + layer3;

    const msgs = [{ role: 'system', content: systemPrompt }];

    // 对话记忆：如果开启，注入历史消息
    if (cfg.memory_enabled) {
      const historyMsgs = getMemoryMessages(toUser, 10);
      if (historyMsgs.length > 0) {
        msgs.push(...historyMsgs);
        console.log(`[AI] Memory: injected ${historyMsgs.length} history messages for ${(toUser||'').slice(0,16)}`);
      }
    }

    // 字数限制：附加到用户消息尾部让 AI 遵循
    let userContent = userMsg;
    if (cfg.reply_max_chars > 0) {
      let limitText = '';
      if (cfg.reply_min_chars > 0 && cfg.reply_min_chars <= cfg.reply_max_chars) {
        limitText = `（回复请严格控制在 ${cfg.reply_min_chars}~${cfg.reply_max_chars} 字之间，不允许超出）`;
      } else {
        limitText = `（回复请不要超过 ${cfg.reply_max_chars} 字，必须严格遵守）`;
      }
      userContent = userContent + '\n\n' + limitText;
    }
    msgs.push({ role: 'user', content: userContent });
    // token 限制：滑动器设置 > 字数推算 > 不限
    let finalMaxTokens;
    if (cfg.token_limit > 0) {
      // 滑动器设置了明确的 token 上限
      finalMaxTokens = cfg.token_limit;
    } else if (cfg.reply_max_chars > 0) {
      // 根据字数限制推算（中文约 1.5 token/字，+50 保证金）
      finalMaxTokens = Math.min(Math.max(Math.ceil(cfg.reply_max_chars * 1.5) + 50, 100), 4096);
    }
    // 构建请求体：不传 max_tokens = API 使用默认值（完全无限制）
    const bodyObj = { model: cfg.model, messages: msgs, temperature: 0.9, presence_penalty: 0.6, frequency_penalty: 0.6, stop: ["\n\n\n"] };
    if (finalMaxTokens) bodyObj.max_tokens = finalMaxTokens;
    const body = JSON.stringify(bodyObj);
    console.log(`[AI] Calling API: ${cfg.model} ${url.slice(0,40)}...`);
    const result = await new Promise((resolve, reject) => {
      const u = new URL(url);
      const opts = { hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key, 'Content-Length': Buffer.byteLength(body) } };
      const r = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { console.log(`[AI] API status: ${res.statusCode}`); resolve(d); }); });
      r.setTimeout(30000, () => { r.destroy(); reject(new Error('timeout')); });
      r.on('error', e => { console.log(`[AI] Request error: ${e.message}`); reject(e); });
      r.write(body); r.end();
    });
    console.log(`[AI] API response received: ${result.length} bytes`);
    const j = JSON.parse(result);
    let reply = j.choices?.[0]?.message?.content || '';
    if (!reply) return;
    // ====== TASK 4: 质量审核 ======
    if (emotionAnalysis && replyStrategy) {
      try {
        const reviewResult = await reviewReply(reply, replyStrategy, emotionAnalysis);
        if (reviewResult && reviewResult.score < 70 && reviewResult.fixed_reply) {
          console.log(`[REVIEW] Score ${reviewResult.score}, score<70, using fixed reply: "${reviewResult.fixed_reply.slice(0,40)}"`);
          reply = reviewResult.fixed_reply;
        } else if (reviewResult) {
          console.log(`[REVIEW] Score ${reviewResult.score}, score>=70, keeping original reply`);
        }
      } catch (e) { console.log('[REVIEW] Error:', e.message); }
    }
    // 后处理：剥离括号、emoji、标签，只保留纯对话文字
    const cleanText = cleanReply(reply);
    if (cleanText !== reply) {
      console.log(`[AI] Cleaned reply: "${reply.slice(0,50)}" → "${cleanText.slice(0,50)}"`);
      reply = cleanText;
    }
    // 后端硬性截断：确保回复不超出字数限制（最终保险）
    if (cfg.reply_max_chars > 0 && reply.length > cfg.reply_max_chars) {
      reply = reply.slice(0, cfg.reply_max_chars);
      console.log(`[AI] Truncated reply to ${cfg.reply_max_chars} chars`);
    }
    // Send reply
    const clientId = `ai-${Date.now().toString(36)}`;
    const sendResult = await ilinkPost('sendmessage', { msg: { from_user_id: '', to_user_id: toUser, client_id: clientId, message_type: 2, message_state: 2, context_token: ctx, item_list: [{ type: 1, text_item: { text: reply } }] } }, botToken);
    if (!sendResult.errcode && sendResult.ret !== -1) {
      messages.push({ id: ++msgId, to: toUser, text: reply, time: Date.now(), dir: 'out', is_ai: true });
      console.log(`[AI] Replied to ${(toUser||'').slice(0,16)}: ${reply.slice(0,50)}...`);
      // 保存 AI 回复到记忆（用户消息已在 pollMessages 中保存）
      if (cfg.memory_enabled) {
        addMemory(toUser, 'assistant', reply);
      }
    } else {
      console.log(`[AI] Send failed: errcode=${sendResult.errcode} ret=${sendResult.ret} msg=${sendResult.errmsg||''}`);
    }
  } catch (e) { console.log('[AI] Error:', e.message); }
}

// ====== TASK 5: Web Search (async, non-blocking with topic cache) ======
const searchContextCache = {};

async function searchWebForContext(userMsg) {
  try {
    const cfg = loadAiConfig();
    if (!cfg.api_url || !cfg.api_key) return null;

    // Extract topic from message for caching
    const topic = userMsg.replace(/[^一-龥a-zA-Z0-9]/g, '').slice(0, 30);
    if (!topic) return null;

    // Check cache (5 min TTL)
    if (searchContextCache[topic] && Date.now() - searchContextCache[topic].time < 300000) {
      console.log(`[SEARCH] Cache hit for topic: ${topic}`);
      return searchContextCache[topic].result;
    }

    const searchPrompt = `请搜索以下内容的最新信息，并总结要点：${userMsg}`;
    const url = cfg.api_url.replace(/\/+$/, '') + (cfg.api_url.includes('/chat/completions') ? '' : '/chat/completions');
    const body = JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个搜索助手。搜索网络获取最新信息，并给出简洁的中文总结。' },
        { role: 'user', content: searchPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
      enable_search: true
    });

    const result = await new Promise((resolve, reject) => {
      const u = new URL(url);
      const opts = { hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key, 'Content-Length': Buffer.byteLength(body) }, timeout: 25000 };
      const r = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
      r.on('error', e => { console.log('[SEARCH] Request error:', e.message); reject(e); });
      r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); }); r.write(body); r.end();
    });

    const j = JSON.parse(result || '{}');
    const content = j.choices?.[0]?.message?.content || '';
    if (!content) return null;

    // Cache result
    searchContextCache[topic] = { result: content, time: Date.now() };
    console.log(`[SEARCH] Cached result for topic: ${topic} (${content.length} chars)`);

    // Clean old cache entries (periodic, keep entries < 10 min)
    const now = Date.now();
    for (const key of Object.keys(searchContextCache)) {
      if (now - searchContextCache[key].time > 600000) delete searchContextCache[key];
    }

    return content;
  } catch (e) { console.log('[SEARCH] Error:', e.message); return null; }
}

// ====== 加载情感知识库 ======
const EMOTION_KB_DIR = '/root/login-app/emotion_knowledge';
let emotionKB = null;
function loadEmotionKnowledge() {
  if (emotionKB) return emotionKB;
  try {
    emotionKB = {
      analyst: JSON.parse(fs.readFileSync(EMOTION_KB_DIR + '/analyst.json', 'utf-8')),
      dating: JSON.parse(fs.readFileSync(EMOTION_KB_DIR + '/dating.json', 'utf-8')),
      social: JSON.parse(fs.readFileSync(EMOTION_KB_DIR + '/social.json', 'utf-8')),
      companion: JSON.parse(fs.readFileSync(EMOTION_KB_DIR + '/companion.json', 'utf-8')),
    };
    console.log('[KB] Loaded 4 emotion knowledge bases');
  } catch (e) {
    console.log('[KB] Knowledge base load failed:', e.message);
    emotionKB = { analyst: {}, dating: {}, social: {}, companion: {} };
  }
  return emotionKB;
}

function getKnowledgeContext(emotion) {
  const kb = loadEmotionKnowledge();
  const ctx = [];
  const ai = kb.analyst?.emotions?.[emotion];
  if (ai) {
    ctx.push('【情感参考】' + (ai.strategy || ''));
    if (ai.do?.length) ctx.push('建议:' + ai.do.join('；'));
    if (ai.dont?.length) ctx.push('避免:' + ai.dont.join('；'));
  }
  if (kb.social?.techniques) {
    const keys = Object.keys(kb.social.techniques);
    const key = keys[Math.floor(Math.random() * keys.length)];
    ctx.push('【社交技巧】' + kb.social.techniques[key]);
  }
  if (kb.companion?.principles) {
    ctx.push('【陪伴原则】' + kb.companion.principles.slice(0,3).join('；'));
  }
  return ctx.join('\n');
}

// ---- Media upload (参考 Python _upload_media) ----
async function uploadMedia(fileBuf, filename, mediaType, toUserId) {
  try {
    console.log(`[UPLOAD] Starting: ${filename} type=${mediaType} size=${fileBuf.length}`);
    const aesKeyHex = randomHex(16);
    const aesKey = Buffer.from(aesKeyHex, 'hex');
    const encrypted = aesEcbEncrypt(fileBuf, aesKey);
    const filekey = randomHex(16);
    const rawMd5 = md5Hex(fileBuf);

    const body = { filekey, media_type: mediaType, to_user_id: toUserId, rawsize: fileBuf.length, rawfilemd5: rawMd5, filesize: encrypted.length, no_need_thumb: true, aeskey: aesKeyHex };
    console.log(`[UPLOAD] Requesting upload URL...`);

    const result = await ilinkPost('getuploadurl', body, botToken);
    if (result.ret === -1 || result.errcode) { console.log(`[UPLOAD] getuploadurl failed: ret=${result.ret} errcode=${result.errcode} msg=${result.errmsg}`); return null; }
    const uploadParam = result.upload_param;
    if (!uploadParam) { console.log(`[UPLOAD] No upload_param in response: ${JSON.stringify(result).slice(0,200)}`); return null; }

    console.log(`[UPLOAD] Got upload param, uploading to CDN...`);
    const cdnUrl = `${CDN_BASE}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(filekey)}`;
    const cdnResp = await new Promise((res, rej) => {
      const u = new URL(cdnUrl);
      const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': encrypted.length }, timeout: 120000 },
        (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: d })); });
      req.on('error', (e) => { console.log(`[UPLOAD] CDN request error: ${e.message}`); rej(e); });
      req.on('timeout', () => { req.destroy(); console.log('[UPLOAD] CDN timeout'); rej(new Error('cdn timeout')); });
      req.write(encrypted); req.end();
    });

    if (cdnResp.status !== 200) { console.log(`[UPLOAD] CDN returned ${cdnResp.status}: ${cdnResp.body.slice(0,100)}`); return null; }

    const encryptedParam = cdnResp.headers['x-encrypted-param'];
    if (!encryptedParam) { console.log(`[UPLOAD] Missing x-encrypted-param header. Headers: ${JSON.stringify(cdnResp.headers)}`); return null; }

    const aesKeyB64 = Buffer.from(aesKeyHex).toString('base64');
    const cdnMedia = { encrypt_query_param: encryptedParam, aes_key: aesKeyB64, encrypt_type: 1 };
    console.log(`[UPLOAD] SUCCESS: ${filename}, encrypted_size=${encrypted.length}`);
    return { filekey, media: cdnMedia, aes_key_hex: aesKeyHex, raw_size: fileBuf.length, encrypted_size: encrypted.length, md5: rawMd5, filename };
  } catch (e) { console.log(`[UPLOAD] Error: ${e.message}`); return null; }
}

// ====== HTTP Server ======
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${FRONT_PORT}`);
  const p = url.pathname;

  // ---- IP Tracking & Ban Check ----
  const clientIp = getRealIp(req);
  // Record IP access (async, non-blocking)
  if (!p.startsWith('/api/ip-') && !p.startsWith('/api/media/')) {
    recordIpAccess(clientIp).catch(() => {});
  }
  // Check if IP is banned (allow IP management endpoints so admin can unban)
  if (isIpBanned(clientIp) && !p.startsWith('/api/ip-') && p.startsWith('/api/')) {
    res.writeHead(403, cors);
    res.end(JSON.stringify({ error: 'IP_BANNED', message: '当前IP已被封禁' }));
    return;
  }

  // ---- Routes ----
  // QR code login (bot_type=3)
  if (p === '/api/qrcode') {
    ilinkGet('/ilink/bot/get_bot_qrcode?bot_type=3').then(data => {
      qrcodeImgUrl = data.qrcode_img_content;
      if (data.qrcode) startQrPolling(data.qrcode);
      res.writeHead(200, cors); res.end(JSON.stringify({ success: !!data.qrcode, qrcode_key: data.qrcode, qrcode_img_url: data.qrcode_img_content }));
    }).catch(e => res.writeHead(502, cors).end(JSON.stringify({ success: false, error: e.message })));
    return;
  }
  if (p === '/api/qrcode-status') {
    res.writeHead(200, cors); res.end(JSON.stringify({ status: !!botToken ? 'confirmed' : qrStatus, connected: !!botToken, bot_id: botId }));
    return;
  }
  if (p === '/api/status') {
    res.writeHead(200, cors); res.end(JSON.stringify({ connected: !!botToken, bot_id: botId }));
    return;
  }
  if (p === '/api/qrcode-image') {
    QRCode.toDataURL(qrcodeImgUrl || 'https://weixin.qq.com', { width: 280, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } })
      .then(dataUrl => { const img = Buffer.from(dataUrl.split(',')[1], 'base64'); res.writeHead(200, { ...cors, 'Content-Type': 'image/png' }); res.end(img); })
      .catch(() => res.writeHead(500, cors).end('error'));
    return;
  }

  // Messages
  if (p === '/api/messages') {
    const since = parseInt(url.searchParams.get('since') || '0');
    const userFilter = url.searchParams.get('user') || '';
    let filtered = messages.filter(m => m.id > since);
    if (userFilter) {
      filtered = filtered.filter(m => m.from === userFilter || m.to === userFilter);
    }
    res.writeHead(200, cors); res.end(JSON.stringify({ messages: filtered, current_user: currentUserId || Object.keys(contextTokens)[0] || null }));
    return;
  }
  if (p === '/api/send-text' || p === '/api/send') {
    if (!botToken) { res.writeHead(401, cors); res.end(JSON.stringify({ error: 'Not connected' })); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { text, to_user_id } = JSON.parse(body);
        if (!text || !to_user_id) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'Missing fields' })); return; }
        const ctxToken = contextTokens[to_user_id];
        if (!ctxToken) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'No session' })); return; }
        const clientId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        const result = await ilinkPost('sendmessage', {
          msg: {
            from_user_id: '', to_user_id, client_id: clientId,
            message_type: 2, message_state: 2,
            context_token: ctxToken,
            item_list: [{ type: 1, text_item: { text } }],
          },
        }, botToken);
        const ok = !result.errcode && result.ret !== -1;
        if (ok) { messages.push({ id: ++msgId, to: to_user_id, text, time: Date.now(), dir: 'out' }); saveState(); }
        res.writeHead(200, cors); res.end(JSON.stringify({ success: ok, error: ok ? null : (result.errmsg || 'send failed') }));
      } catch (e) { res.writeHead(500, cors); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // Serve cached media (images/files)
  if (p.startsWith('/api/media/')) {
    const key = p.split('/')[3] || '';
    const ext = url.searchParams.get('ext') || '';
    const imgPath = path.join(CACHE_DIR, key + (ext ? '.' + ext : ''));
    // Try both .img and .dat extensions
    let filePath = path.join(CACHE_DIR, key + '.img');
    if (!fs.existsSync(filePath)) filePath = path.join(CACHE_DIR, key + '.dat');
    if (!fs.existsSync(filePath) && ext) filePath = imgPath;

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      const mime = detectMime(data);
      res.writeHead(200, { ...cors, 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
      res.end(data);
    } else {
      res.writeHead(404, cors); res.end('Not found');
    }
    return;
  }

  // Send media (image/file/voice)
  if (p === '/api/send-media') {
    if (!botToken) { res.writeHead(401, cors); res.end(JSON.stringify({ error: 'Not connected' })); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { media_type, file_data, to_user_id, playtime } = JSON.parse(body);
        let filename = JSON.parse(body).filename || 'file';
        if (!file_data || !to_user_id || !media_type) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'Missing fields' })); return; }
        const ctxToken = contextTokens[to_user_id];
        if (!ctxToken) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'No session' })); return; }

        let fileBuf = Buffer.from(file_data, 'base64');
        const typeMap = { image: 1, video: 2, file: 3, voice: 4 };
        let mediaType = typeMap[media_type] || 3;

        // Voice → convert to MP3 and send as file
        if (mediaType === 4) {
          const tmpIn = path.join(CACHE_DIR, `v${Date.now()}.webm`);
          const tmpOut = path.join(CACHE_DIR, `v${Date.now()}.mp3`);
          try {
            fs.writeFileSync(tmpIn, fileBuf);
            require('child_process').execSync(`ffmpeg -y -i "${tmpIn}" -acodec mp3 -ar 24000 -ac 1 -b:a 32k "${tmpOut}" 2>/dev/null`);
            if (fs.existsSync(tmpOut)) { fileBuf = fs.readFileSync(tmpOut); console.log(`[VOICE] MP3: ${fileBuf.length} bytes`); }
          } catch (e) { console.log('[VOICE] Error:', e.message); }
          finally { try { fs.unlinkSync(tmpIn); } catch {} try { fs.unlinkSync(tmpOut); } catch {} }
          mediaType = 3;
          filename = filename.replace(/\.\w+$/, '') + '.mp3';
        }

        const uploaded = await uploadMedia(fileBuf, filename, mediaType, to_user_id);
        if (!uploaded) { res.writeHead(500, cors); res.end(JSON.stringify({ error: 'Upload failed' })); return; }

        let item;
        if (mediaType === 1) {
          item = { type: 2, image_item: { media: uploaded.media, aeskey: uploaded.aes_key_hex, mid_size: uploaded.encrypted_size } };
        } else if (mediaType === 4) {
          item = { type: 3, voice_item: { media: uploaded.media, encode_type: 6, bits_per_sample: 16, playtime: playtime || 2000, sample_rate: 16000 } };
        } else {
          item = { type: 4, file_item: { media: uploaded.media, file_name: filename, md5: uploaded.md5, len: String(uploaded.raw_size) } };
        }

        const clientId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        const result = await ilinkPost('sendmessage', {
          msg: { from_user_id: '', to_user_id, client_id: clientId, message_type: 2, message_state: 2, context_token: ctxToken, item_list: [item] },
        }, botToken);

        const ok = !result.errcode && result.ret !== -1;
        if (ok) messages.push({ id: ++msgId, to: to_user_id, text: `[${media_type}] ${filename}`, time: Date.now(), dir: 'out' });
        res.writeHead(200, cors); res.end(JSON.stringify({ success: ok, error: ok ? null : (result.errmsg || 'send failed') }));
      } catch (e) { res.writeHead(500, cors); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // Add friend QR code
  if (p === '/api/add-friend-qrcode') {
    if (!botToken) { res.writeHead(401, cors); res.end(JSON.stringify({ error: 'Not connected' })); return; }
    ilinkGet('/ilink/bot/get_bot_qrcode?bot_type=3').then(async data => {
      const key = data.qrcode;
      if (!key) { res.writeHead(500, cors); res.end(JSON.stringify({ success: false })); return; }
      startAddFriendPolling(key);
      try {
        const qrDataUrl = await QRCode.toDataURL(data.qrcode_img_content || 'https://weixin.qq.com', { width: 280, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });
        res.writeHead(200, cors); res.end(JSON.stringify({ success: true, qrcode_key: key, qrcode_image: qrDataUrl.split(',')[1] }));
      } catch { res.writeHead(200, cors); res.end(JSON.stringify({ success: true, qrcode_key: key })); }
    }).catch(e => res.writeHead(502, cors).end(JSON.stringify({ error: e.message })));
    return;
  }
  if (p === '/api/add-friend-status') {
    res.writeHead(200, cors); res.end(JSON.stringify({ status: addFriendStatus || 'idle' }));
    return;
  }
  if (p === '/api/add-friend-poll') {
    if (addFriendKey) {
      ilinkGet(`/ilink/bot/get_qrcode_status?qrcode=${addFriendKey}`, { 'iLink-App-ClientVersion': '1' }).then(data => {
        if (data.status === 'confirmed' && data.ilink_user_id && !contextTokens[data.ilink_user_id]) {
          contextTokens[data.ilink_user_id] = ''; addFriendStatus = 'confirmed'; saveState();
          console.log(`[ADD-FRIEND] New user: ${(data.ilink_user_id||'').slice(0,16)}`);
        }
        res.writeHead(200, cors); res.end(JSON.stringify({ status: data.status || addFriendStatus, user_id: data.ilink_user_id || null }));
      }).catch(() => res.writeHead(200, cors).end(JSON.stringify({ status: addFriendStatus })));
    } else { res.writeHead(200, cors).end(JSON.stringify({ status: addFriendStatus })); }
    return;
  }

  // Switch active user
  if (p === '/api/users') {
    res.writeHead(200, cors); res.end(JSON.stringify({ users: Object.keys(contextTokens), current_user: currentUserId || Object.keys(contextTokens)[0] || null }));
    return;
  }
  if (p === '/api/switch-user') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { try { const d = JSON.parse(body); currentUserId = d.user_id || null; res.writeHead(200, cors); res.end(JSON.stringify({ success: true, current_user: currentUserId })); } catch (e) { res.writeHead(400, cors); res.end(JSON.stringify({ error: e.message })); } });
    return;
  }
  if (p === '/api/delete-user') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { try { const d = JSON.parse(body); const id = d.user_id; if (id) { delete contextTokens[id]; saveState(); if (currentUserId === id) currentUserId = null; } res.writeHead(200, cors); res.end(JSON.stringify({ success: true })); } catch (e) { res.writeHead(400, cors); res.end(JSON.stringify({ error: e.message })); } });
    return;
  }

  // 前端调试日志
  if (p === '/api/debug-log') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      try { const d = JSON.parse(body); console.log('[FRONTEND ERROR]', d.msg, 'at', d.url, 'line', d.line); } catch {}
      res.writeHead(200, cors); res.end('ok');
    });
    return;
  }

  // Skill 库接口
  if (p === '/api/skills') {
    res.writeHead(200, cors); res.end(JSON.stringify({ skills: getBuiltinSkillList() }));
    return;
  }

  // Feature skills (功能选项)
  if (p === '/api/features') {
    if (req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const d = JSON.parse(body);
          const settings = loadSettings();
          settings.features = { ...(settings.features || {}), ...d };
          saveSettings(settings);
          res.writeHead(200, cors); res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); }
      });
    } else {
      res.writeHead(200, cors); res.end(JSON.stringify({ features: getFeatureList() }));
    }
    return;
  }

  // AI Auto-reply config
  if (p === '/api/ai-config') {
    if (req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => { try { const d = JSON.parse(body); saveAiConfig(d); startScheduledReplies(); res.writeHead(200, cors); res.end(JSON.stringify({ success: true })); } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); } });
    } else { res.writeHead(200, cors); res.end(JSON.stringify(loadAiConfig())); }
    return;
  }
  // 对话记忆管理
  if (p === '/api/memory') {
    if (req.method === 'GET') {
      const uid = url.searchParams.get('user') || '';
      if (uid) {
        const memory = loadMemory();
        res.writeHead(200, cors); res.end(JSON.stringify({ history: memory[uid] || [], count: (memory[uid] || []).length }));
      } else {
        const memory = loadMemory();
        const summary = Object.fromEntries(Object.entries(memory).map(([k, v]) => [k, v.length]));
        res.writeHead(200, cors); res.end(JSON.stringify({ users: summary }));
      }
    } else if (req.method === 'DELETE') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { user_id } = JSON.parse(body);
          if (user_id) clearMemory(user_id);
          res.writeHead(200, cors); res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400, cors); res.end(JSON.stringify({ error: e.message })); }
      });
    }
    return;
  }

  // 获取情绪状态（好感度）
  if (p === '/api/emotion/get' && method === 'GET') {
    const userId = u.searchParams.get('userId');
    if (!userId) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'Missing userId' })); return; }
    const state = loadEmotionState();
    const emotion = state[userId] || getEmotionDefault();
    res.writeHead(200, cors); res.end(JSON.stringify({ success: true, emotion }));
    return;
  }

  // 设置情绪（手动调整好感度）
  if (p === '/api/emotion/set') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        const { userId, affection } = d;
        if (!userId || affection === undefined) {
          res.writeHead(400, cors); res.end(JSON.stringify({ error: 'Missing userId or affection' })); return;
        }
        const state = loadEmotionState();
        if (!state[userId]) state[userId] = getEmotionDefault();
        state[userId].affection = Math.max(0, Math.min(1, affection));
        state[userId].lastInteraction = Date.now();
        state[userId].relationshipStage = getRelationshipStage(state[userId].affection);
        saveEmotionState(state);
        res.writeHead(200, cors); res.end(JSON.stringify({ success: true, emotion: state[userId] }));
      } catch (e) { res.writeHead(400, cors); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (p === '/api/ai-test') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { api_url, api_key, model } = JSON.parse(body);
        if (!api_url || !api_key) { res.writeHead(400, cors); res.end(JSON.stringify({ success: false, error: '缺少 API 地址或密钥' })); return; }
        const url = api_url.replace(/\/+$/, '') + (api_url.includes('/chat/completions') ? '' : '/chat/completions');
        const result = await new Promise((resolve, reject) => {
          const data = JSON.stringify({ model: model || 'gpt-3.5-turbo', messages: [{ role: 'user', content: '回复OK' }], max_tokens: 10 });
          const u = new URL(url);
          const opts = { hostname: u.hostname, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api_key, 'Content-Length': Buffer.byteLength(data) }, timeout: 15000 };
          const req = https.request(opts, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { const j = JSON.parse(d); resolve({ success: true, reply: (j.choices?.[0]?.message?.content || '').slice(0,50) }); } catch { resolve({ success: false, error: '响应解析失败: ' + d.slice(0,100) }); } }); });
          req.on('error', e => resolve({ success: false, error: e.message }));
          req.on('timeout', () => { req.destroy(); resolve({ success: false, error: '连接超时' }); });
          req.write(data); req.end();
        });
        res.writeHead(200, cors); res.end(JSON.stringify(result));
      } catch (e) { res.writeHead(500, cors); res.end(JSON.stringify({ success: false, error: e.message })); }
    });
    return;
  }

  // ====== TASK 5: Web Search API ======
  if (p === '/api/search') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { q } = JSON.parse(body);
        if (!q) { res.writeHead(400, cors); res.end(JSON.stringify({ success: false, error: 'Missing query' })); return; }
        const result = await searchWebForContext(q);
        res.writeHead(200, cors); res.end(JSON.stringify({ success: !!result, result: result || '' }));
      } catch (e) { res.writeHead(500, cors); res.end(JSON.stringify({ success: false, error: e.message })); }
    });
    return;
  }

  // General Settings
  if (p === '/api/settings') {
    if (req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => { try { const d = JSON.parse(body); saveSettings(d); res.writeHead(200, cors); res.end(JSON.stringify({ success: true })); } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); } });
    } else { res.writeHead(200, cors); res.end(JSON.stringify(loadSettings())); }
    return;
  }

  // Persona API
  if (p === '/api/personas') {
    if (req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => { try { const d = JSON.parse(body); const id = savePersona(d); res.writeHead(200, cors); res.end(JSON.stringify({ success: true, id })); } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); } });
    } else {
      const ps = loadPersonas(); const map = loadPersonaMap();
      res.writeHead(200, cors); res.end(JSON.stringify({ personas: Object.values(ps), user_map: map }));
    }
    return;
  }
  if (p === '/api/personas/delete') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { try { const d = JSON.parse(body); deletePersona(d.id); res.writeHead(200, cors); res.end(JSON.stringify({ success: true })); } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); } });
    return;
  }
  if (p === '/api/personas/assign') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        const map = loadPersonaMap();
        if (d.user_id && d.persona_id) map[d.user_id] = d.persona_id;
        else if (d.user_id && !d.persona_id) delete map[d.user_id];
        try { fs.writeFileSync(PERSONA_MAP_FILE, JSON.stringify(map)); } catch {}
        res.writeHead(200, cors); res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // ====== IP Management API ======
  if (p === '/api/ip-stats') {
    const records = loadIpRecords();
    const blacklist = loadIpBlacklist();
    const now = Date.now();
    const all = Object.values(records);
    const total = all.length;
    const online = all.filter(r => (now - r.last_login) < 5 * 60 * 1000).length;
    const banned = Object.values(blacklist).filter(b => b.status === 1).length;
    const recent = all.filter(r => (now - r.last_login) < 24 * 60 * 60 * 1000).length;
    res.writeHead(200, cors); res.end(JSON.stringify({ total, online, banned, recent }));
    return;
  }
  if (p === '/api/ip-records') {
    const records = loadIpRecords();
    const blacklist = loadIpBlacklist();
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const status = url.searchParams.get('status') || '';
    let list = Object.values(records);
    // Mark banned status from blacklist
    list = list.map(r => ({
      ...r,
      status: blacklist[r.ip_address] && blacklist[r.ip_address].status === 1 ? 'banned' : 'normal',
    }));
    if (q) {
      list = list.filter(r =>
        r.ip_address.includes(q) ||
        (r.country || '').toLowerCase().includes(q) ||
        (r.province || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q) ||
        (r.isp || '').toLowerCase().includes(q)
      );
    }
    if (status) list = list.filter(r => r.status === status);
    // Sort by last_login descending
    list.sort((a, b) => (b.last_login || 0) - (a.last_login || 0));
    res.writeHead(200, cors); res.end(JSON.stringify({ records: list }));
    return;
  }
  if (p === '/api/ip-ban') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { ip, reason, expire_time } = JSON.parse(body);
        if (!ip) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'Missing IP' })); return; }
        const blacklist = loadIpBlacklist();
        blacklist[ip] = { ip_address: ip, reason: reason || '', operator: 'admin', create_time: Date.now(), expire_time: expire_time || 0, status: 1 };
        saveIpBlacklist(blacklist);
        // Update record status
        const records = loadIpRecords();
        if (records[ip]) records[ip].status = 'banned';
        saveIpRecords(records);
        console.log(`[IP-BAN] Banned: ${ip} reason: ${reason || '-'}`);
        res.writeHead(200, cors); res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); }
    });
    return;
  }
  if (p === '/api/ip-unban') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { ip } = JSON.parse(body);
        if (!ip) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'Missing IP' })); return; }
        const blacklist = loadIpBlacklist();
        if (blacklist[ip]) blacklist[ip].status = 0;
        saveIpBlacklist(blacklist);
        const records = loadIpRecords();
        if (records[ip]) records[ip].status = 'normal';
        saveIpRecords(records);
        console.log(`[IP-BAN] Unbanned: ${ip}`);
        res.writeHead(200, cors); res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400, cors).end(JSON.stringify({ error: e.message })); }
    });
    return;
  }
  if (p === '/api/ip-blacklist') {
    const blacklist = loadIpBlacklist();
    const active = Object.values(blacklist).filter(b => b.status === 1);
    res.writeHead(200, cors); res.end(JSON.stringify({ blacklist: active }));
    return;
  }

  // ---- 注销当前扫码用户（清除已保存的 botToken，下次需重新扫码） ----
  if (p === '/api/logout') {
    if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
    if (addFriendTimer) { clearInterval(addFriendTimer); addFriendTimer = null; }
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    botToken = null; botId = null; botUserId = null; cursor = ''; qrcodeKey = null; qrStatus = 'idle';
    for (const k of Object.keys(contextTokens)) delete contextTokens[k];
    messages.length = 0; msgId = 0;
    saveState();
    console.log('[LOGOUT] Bot session cleared');
    res.writeHead(200, cors); res.end(JSON.stringify({ success: true }));
    return;
  }

  // Static files — serve from dist/ if available, otherwise project root
  try {
    const distDir = path.join(ROOT, 'dist');
    const staticRoot = fs.existsSync(distDir) ? distDir : ROOT;
    const fp = p === '/' ? '/index.html' : p;
    const full = path.join(staticRoot, fp);
    if (!full.startsWith(staticRoot)) { res.writeHead(403, cors); res.end('Forbidden'); return; }
    const data = fs.readFileSync(full);
    res.writeHead(200, { ...cors, 'Content-Type': MIME[path.extname(fp).slice(1)] || 'text/plain' });
    res.end(data);
  } catch { res.writeHead(404, cors); res.end('Not Found'); }
}).listen(FRONT_PORT, () => { console.log(`✅ http://localhost:${FRONT_PORT}`); });
