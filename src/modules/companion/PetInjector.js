/**
 * Live2D 看板娘注入器
 * 使用 live2d-widget（更活跃的开源项目）
 */

if (window.__PET_INJECTED__) {
  console.log('[Live2D] Already injected');
} else {
  window.__PET_INJECTED__ = true;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function injectLive2D() {
    if (document.readyState === 'loading') {
      document.addEventListener('load', () => setTimeout(injectLive2D, 500));
      return;
    }

    console.log('[Live2D] Starting injection...');

    // 使用 live2d-widget（更可靠的方案）
    // https://github.com/stevenjoezhang/live2d-widget
    loadScript('https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/autoload.js')
      .then(() => {
        console.log('[Live2D] live2d-widget loaded');
      })
      .catch(err => {
        console.error('[Live2D] Load error:', err);
        // 降级：显示emoji猫
        injectFallback();
      });

    // 后台暂停
    document.addEventListener('visibilitychange', () => {
      const widgets = document.querySelectorAll('#live2d-widget, .live2d-widget-container');
      widgets.forEach(w => {
        w.style.display = document.hidden ? 'none' : 'block';
      });
    });
  }

  // 降级方案
  function injectFallback() {
    console.log('[Live2D] Using fallback');
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;right:10px;bottom:80px;z-index:9999;pointer-events:auto;cursor:pointer;text-align:center;';
    div.innerHTML = '<div style="font-size:80px;animation:petBounce 2s ease-in-out infinite;">🐱</div><div style="font-size:12px;color:#FF69B4;">喵~</div>';
    document.body.appendChild(div);

    const style = document.createElement('style');
    style.textContent = '@keyframes petBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}';
    document.head.appendChild(style);

    div.addEventListener('click', () => {
      const msgs = ['主人~ 你好呀！', '喵~', '要摸摸头吗？', '今天也要加油！'];
      const bubble = document.createElement('div');
      bubble.style.cssText = 'position:absolute;top:-40px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#FF69B4,#FF1493);color:white;padding:6px 14px;border-radius:15px;font-size:12px;white-space:nowrap;pointer-events:none;';
      bubble.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      div.appendChild(bubble);
      setTimeout(() => bubble.remove(), 2000);
    });
  }

  injectLive2D();
}
