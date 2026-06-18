/**
 * Live2D 看板娘注入器（降级方案）
 * 主加载由 autoload.js 处理，此脚本仅在 autoload 失败时作为备用
 */

// 如果 autoload.js 已经成功加载了 initWidget，不再执行
if (window.initWidget || window.__PET_INJECTED__) {
  console.log('[Live2D] Already loaded by autoload.js, PetInjector skipped');
} else {
  window.__PET_INJECTED__ = true;

  // 降级方案：显示 emoji 猫
  function injectFallback() {
    console.log('[Live2D] Using emoji fallback');
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;right:10px;bottom:80px;z-index:9999;pointer-events:auto;cursor:pointer;text-align:center;';
    div.innerHTML = '<div style="font-size:80px;animation:petBounce 2s ease-in-out infinite;">🐱</div><div style="font-size:12px;color:#FF69B4;">喵~</div>';
    document.body.appendChild(div);

    var style = document.createElement('style');
    style.textContent = '@keyframes petBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}';
    document.head.appendChild(style);

    div.addEventListener('click', function () {
      var msgs = ['主人~ 你好呀！', '喵~', '要摸摸头吗？', '今天也要加油！'];
      var bubble = document.createElement('div');
      bubble.style.cssText = 'position:absolute;top:-40px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#FF69B4,#FF1493);color:white;padding:6px 14px;border-radius:15px;font-size:12px;white-space:nowrap;pointer-events:none;';
      bubble.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      div.appendChild(bubble);
      setTimeout(function () { bubble.remove(); }, 2000);
    });
  }

  // 等待 autoload 完成，如果超时则启用降级
  var waitCount = 0;
  var waitTimer = setInterval(function () {
    waitCount++;
    if (window.initWidget || document.getElementById('waifu')) {
      clearInterval(waitTimer);
      console.log('[Live2D] autoload.js succeeded, PetInjector fallback not needed');
      return;
    }
    if (waitCount > 20) {
      clearInterval(waitTimer);
      console.warn('[Live2D] autoload.js did not complete, using fallback');
      injectFallback();
    }
  }, 250);
}
