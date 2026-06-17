/**
 * Live2D 看板娘注入器
 * 使用 fghrsh/live2d_demo 原版文件 + jQuery
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

    // 加载CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/live2d/waifu.css';
    document.head.appendChild(link);

    // 创建HTML结构
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

    // 加载jQuery（waifu-tips.js依赖）
    loadScript('https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js')
      .then(() => {
        console.log('[Live2D] jQuery loaded');
        return loadScript('/live2d/waifu-tips.js');
      })
      .then(() => {
        console.log('[Live2D] waifu-tips.js loaded');
        return loadScript('/live2d/live2d.js');
      })
      .then(() => {
        console.log('[Live2D] live2d.js loaded');

        // 配置参数
        if (window.live2d_settings) {
          live2d_settings['modelAPI'] = 'https://live2d.fghrsh.net/api/';
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

        console.log('[Live2D] Injection complete!');
      })
      .catch(err => {
        console.error('[Live2D] Load error:', err);
      });
  }

  injectLive2D();
}
