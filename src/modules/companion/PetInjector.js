/**
 * Live2D 看板娘注入器
 * 直接使用 fghrsh/live2d_demo 原版文件
 */

if (window.__PET_INJECTED__) {
  console.log('[Live2D] Already injected');
} else {
  window.__PET_INJECTED__ = true;

  function injectLive2D() {
    if (document.readyState === 'loading') {
      document.addEventListener('load', () => setTimeout(injectLive2D, 300));
      return;
    }

    console.log('[Live2D] Injecting...');

    // 加载CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/live2d/waifu.css';
    document.head.appendChild(link);

    // 创建HTML结构（原版结构）
    const waifu = document.createElement('div');
    waifu.className = 'waifu';
    waifu.innerHTML = `
      <div class="waifu-tips"></div>
      <canvas id="live2d" class="live2d"></canvas>
      <div class="waifu-tool">
        <span class="fui-home" title="首页"></span>
        <span class="fui-chat" title="对话"></span>
        <span class="fui-eye" title="切换模型"></span>
        <span class="fui-user" title="切换材质"></span>
        <span class="fui-photo" title="截图"></span>
        <span class="fui-info-circle" title="关于"></span>
        <span class="fui-cross" title="关闭"></span>
      </div>
    `;
    document.body.appendChild(waifu);

    // 加载waifu-tips.js
    const tipsScript = document.createElement('script');
    tipsScript.src = '/live2d/waifu-tips.js';
    tipsScript.onload = () => {
      console.log('[Live2D] waifu-tips.js loaded');

      // 加载live2d.js
      const live2dScript = document.createElement('script');
      live2dScript.src = '/live2d/live2d.js';
      live2dScript.onload = () => {
        console.log('[Live2D] live2d.js loaded');

        // 配置参数
        if (window.live2d_settings) {
          live2d_settings['modelId'] = 5;
          live2d_settings['modelTexturesId'] = 1;
          live2d_settings['modelStorage'] = false;
          live2d_settings['canCloseLive2d'] = true;
          live2d_settings['canTurnToHomePage'] = false;
          live2d_settings['waifuSize'] = '280x250';
          live2d_settings['waifuTipsSize'] = '250x120';
          live2d_settings['waifuFontSize'] = '14px';
          live2d_settings['waifuToolFont'] = '18px';
          live2d_settings['waifuToolLine'] = '30px';
          live2d_settings['waifuToolTop'] = '-40px';
          live2d_settings['waifuDraggable'] = 'axis-x';

          // 初始化模型
          if (window.initModel) {
            initModel('/live2d/waifu-tips.json');
            console.log('[Live2D] Model initialized');
          }
        }

        // 后台暂停
        document.addEventListener('visibilitychange', () => {
          const canvas = document.getElementById('live2d');
          if (canvas) {
            canvas.style.display = document.hidden ? 'none' : 'block';
          }
        });
      };
      live2dScript.onerror = () => console.error('[Live2D] Failed to load live2d.js');
      document.head.appendChild(live2dScript);
    };
    tipsScript.onerror = () => console.error('[Live2D] Failed to load waifu-tips.js');
    document.head.appendChild(tipsScript);

    console.log('[Live2D] Injection started');
  }

  injectLive2D();
}
