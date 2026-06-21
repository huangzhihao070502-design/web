import { useEffect, useRef } from 'react';

export default function Live2DWidget() {
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    let clickCount = 0;
    let clickTimer: any = null;
    let currentWalkTimer: any = null;
    let nextWalkTimer: any = null;

    const style = document.createElement('style');
    style.id = 'live2d-extras';
    style.textContent = `
      @keyframes live2d-walk { 0% { right: 20px; } 50% { right: calc(100vw - 190px); } 100% { right: 20px; } }
      @keyframes live2d-shake { 0%,100% { transform: translateX(0); } 10% { transform: translateX(-4px); } 30% { transform: translateX(3px); } 50% { transform: translateX(-2px); } 70% { transform: translateX(1px); } }
      .live2d-walking { animation: live2d-walk 12s ease-in-out forwards !important; }
      .live2d-screen-shake { animation: live2d-shake 0.4s ease !important; }
    `;
    document.head.appendChild(style);

    const checkInterval = setInterval(() => {
      const waifu = document.getElementById('waifu');
      if (waifu) {
        waifu.style.display = 'block';
        clearInterval(checkInterval);
        setTimeout(injectAnimations, 3000);
        setupTriggers(waifu);
        setupCharacterInteraction();
      }
    }, 500);

    const handleVisibility = () => {
      const w = document.getElementById('waifu');
      if (w) w.style.display = document.hidden ? 'none' : 'block';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    function setupTriggers(waifu: HTMLElement) {
      const handleTap = () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 4000);
        if (clickCount >= 5) { clickCount = 0; startWalk(waifu); }
      };
      waifu.addEventListener('click', handleTap);
      waifu.addEventListener('touchstart', handleTap, { passive: true });
      scheduleNext(waifu);
    }

    function scheduleNext(waifu: HTMLElement) {
      if (nextWalkTimer) clearTimeout(nextWalkTimer);
      nextWalkTimer = setTimeout(() => startWalk(waifu), 30000 + Math.random() * 60000);
    }

    function startWalk(waifu: HTMLElement) {
      if (currentWalkTimer) return;
      waifu.classList.remove('live2d-walking-finish');
      waifu.classList.add('live2d-walking');
      currentWalkTimer = setTimeout(() => {
        waifu.classList.remove('live2d-walking');
        const container = document.querySelector('.app-container') || document.querySelector('.max-w-\\[420px\\]') || document.querySelector('.bg-warm-white');
        if (container) { container.classList.add('live2d-screen-shake'); setTimeout(() => container.classList.remove('live2d-screen-shake'), 400); }
        currentWalkTimer = null;
        scheduleNext(waifu);
      }, 12000);
    }

    /* ★ 角色互动系统 ★ */
    function setupCharacterInteraction() {
      const canvas = document.getElementById('live2d');
      if (!canvas) return;

      const reactions = [
        // 点击头部区域的反应
        ['嗯？怎么了~', '别摸人家的头啦~', '呜呜，发型要乱了！', '嘿嘿，好舒服~', '你在摸我头吗？'],
        // 点击身体区域的反应
        ['呀！别碰那里！', '好痒好痒~', '你在做什么呀！', '哼，不理你了！', '讨厌啦~'],
        // 通用点击反应
        ['有什么事吗？', '我在听哦~', '嗯嗯，然后呢？', '你好呀！', '今天过得怎么样？', '想聊点什么吗？', '嘻嘻~'],
      ];

      // 显示台词气泡
      function showReaction(text: string) {
        // 优先使用 waifu-tips 的气泡
        const tips = document.getElementById('waifu-tips');
        if (tips) {
          tips.innerHTML = text;
          tips.classList.add('waifu-tips-active');
          setTimeout(() => tips.classList.remove('waifu-tips-active'), 3000);
          return;
        }
        // 备用：创建临时气泡
        const bubble = document.createElement('div');
        bubble.style.cssText = 'position:fixed;bottom:180px;right:20px;background:rgba(236,217,188,.9);border:1px solid rgba(224,186,140,.6);border-radius:12px;padding:8px 14px;font-size:13px;color:#333;z-index:10001;max-width:200px;pointer-events:none;animation:waifu-shake 0.3s ease;box-shadow:0 2px 8px rgba(0,0,0,.1);';
        bubble.textContent = text;
        document.body.appendChild(bubble);
        setTimeout(() => { bubble.style.transition = 'opacity 0.5s'; bubble.style.opacity = '0'; setTimeout(() => bubble.remove(), 500); }, 2500);
      }

      let lastTapTime = 0;
      let tapZone = ''; // 'head' | 'body' | 'other'

      // 判断点击区域（基于 canvas 坐标）
      function getTapZone(e: MouseEvent | Touch): string {
        const rect = canvas!.getBoundingClientRect();
        const y = (e.clientY - rect.top) / rect.height; // 0~1, top=0
        if (y < 0.4) return 'head';
        if (y < 0.8) return 'body';
        return 'other';
      }

      canvas.addEventListener('click', (e) => {
        const now = Date.now();
        // 防抖：200ms 内不重复触发
        if (now - lastTapTime < 200) return;
        lastTapTime = now;

        const zone = getTapZone(e as MouseEvent);
        let pool: string[];
        if (zone === 'head') {
          pool = reactions[0];
          // 头部点击：触发模型摇头动画
          try {
            const model = (window as any).__live2d_model;
            if (model?.setParamFloat) {
              model.setParamFloat('PARAM_ANGLE_Z', 15);
              setTimeout(() => model.setParamFloat('PARAM_ANGLE_Z', -15), 150);
              setTimeout(() => model.setParamFloat('PARAM_ANGLE_Z', 10), 300);
              setTimeout(() => model.setParamFloat('PARAM_ANGLE_Z', 0), 450);
            }
          } catch {}
        } else if (zone === 'body') {
          pool = reactions[1];
          // 身体点击：触发模型后仰动画
          try {
            const model = (window as any).__live2d_model;
            if (model?.setParamFloat) {
              model.setParamFloat('PARAM_BODY_ANGLE_Z', 5);
              setTimeout(() => model.setParamFloat('PARAM_BODY_ANGLE_Z', -3), 200);
              setTimeout(() => model.setParamFloat('PARAM_BODY_ANGLE_Z', 0), 400);
            }
          } catch {}
        } else {
          pool = reactions[2];
        }
        const text = pool[Math.floor(Math.random() * pool.length)];
        showReaction(text);

        // 派发事件给 waifu-tips.js
        window.dispatchEvent(new CustomEvent('live2d:tapbody'));
      });

      // 悬停时眼睛跟随鼠标
      canvas.addEventListener('mousemove', (e) => {
        try {
          const model = (window as any).__live2d_model;
          if (!model?.setParamFloat) return;
          const rect = canvas!.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6; // -3 ~ 3
          const y = ((e.clientY - rect.top) / rect.height - 0.5) * 4; // -2 ~ 2
          model.setParamFloat('PARAM_EYE_BALL_X', x);
          model.setParamFloat('PARAM_EYE_BALL_Y', y);
          // 头部轻微跟随
          model.setParamFloat('PARAM_ANGLE_X', y * 0.5);
          model.setParamFloat('PARAM_ANGLE_Y', x * 0.3);
        } catch {}
      });

      // 鼠标离开时恢复默认
      canvas.addEventListener('mouseleave', () => {
        try {
          const model = (window as any).__live2d_model;
          if (!model?.setParamFloat) return;
          // 平滑恢复
          const steps = 10;
          let i = 0;
          const interval = setInterval(() => {
            i++;
            const t = i / steps;
            model.setParamFloat('PARAM_EYE_BALL_X', Math.sin(Date.now() / 4000) * 3 * (1 - t) + 0 * t);
            model.setParamFloat('PARAM_EYE_BALL_Y', Math.cos(Date.now() / 5000) * 2 * (1 - t) + 0 * t);
            model.setParamFloat('PARAM_ANGLE_X', 0);
            model.setParamFloat('PARAM_ANGLE_Y', 0);
            if (i >= steps) clearInterval(interval);
          }, 50);
        } catch {}
      });

      // 长按触发特殊反应
      let longPressTimer: any = null;
      canvas.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
          const specialReactions = ['要抱抱~', '最喜欢你了！', '今天也要加油哦！', '你是来找我玩的吗？', '嘿嘿，被你发现了~'];
          showReaction(specialReactions[Math.floor(Math.random() * specialReactions.length)]);
          // 眨眼动画
          try {
            const model = (window as any).__live2d_model;
            if (model?.setParamFloat) {
              model.setParamFloat('PARAM_EYE_L_OPEN', 0.1);
              model.setParamFloat('PARAM_EYE_R_OPEN', 0.1);
              setTimeout(() => {
                model.setParamFloat('PARAM_EYE_L_OPEN', 1);
                model.setParamFloat('PARAM_EYE_R_OPEN', 1);
              }, 300);
            }
          } catch {}
        }, 800);
      }, { passive: true });
      canvas.addEventListener('touchend', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });
      canvas.addEventListener('touchmove', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });
    }

    return () => {
      clearInterval(checkInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (clickTimer) clearTimeout(clickTimer);
      if (nextWalkTimer) clearTimeout(nextWalkTimer);
      if (currentWalkTimer) clearTimeout(currentWalkTimer);
      const w = document.getElementById('waifu');
      if (w) w.style.display = 'none';
    };
  }, []);

  return null;
}

function injectAnimations() {
  const canvas = document.getElementById('live2d') as HTMLCanvasElement | null;
  if (!canvas) { setTimeout(injectAnimations, 1000); return; }
  if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) { setTimeout(injectAnimations, 1000); return; }

  const s = document.getElementById('live2d-animations') || (() => { const ns = document.createElement('style'); ns.id = 'live2d-animations'; document.head.appendChild(ns); return ns; })();
  s.textContent = `@keyframes live2d-tilt { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(1.5deg); } 75% { transform: rotate(-1.5deg); } } #waifu-canvas { animation: live2d-tilt 8s ease-in-out infinite; }`;

  let lastBlink = Date.now();
  setInterval(() => {
    try {
      const model = (window as any).__live2d_model;
      if (!model) return;
      const now = Date.now();
      if (now - lastBlink > 4000 + Math.random() * 2000) {
        model.setParamFloat?.('PARAM_EYE_L_OPEN', 0.1);
        model.setParamFloat?.('PARAM_EYE_R_OPEN', 0.1);
        setTimeout(() => { model.setParamFloat?.('PARAM_EYE_L_OPEN', 1); model.setParamFloat?.('PARAM_EYE_R_OPEN', 1); }, 150);
        lastBlink = now;
      }
      model.setParamFloat?.('PARAM_BREATH', 0.5 + Math.sin(Date.now() / 2000) * 0.15);
      model.setParamFloat?.('PARAM_EYE_BALL_X', Math.sin(Date.now() / 4000) * 3);
      model.setParamFloat?.('PARAM_EYE_BALL_Y', Math.cos(Date.now() / 5000) * 2);
      model.setParamFloat?.('PARAM_BODY_ANGLE_X', Math.sin(Date.now() / 3000) * 1.5);
      model.setParamFloat?.('PARAM_ANGLE_Z', Math.sin(Date.now() / 4000) * 2);
    } catch {}
  }, 50);
}
