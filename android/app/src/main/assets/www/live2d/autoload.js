/*!
 * Live2D Widget — 看板娘加载器
 * 用 IIFE 包裹各脚本以避免全局变量冲突（chunk 文件使用相同短变量名）
 * live2d.min.js 已在 index.html 中作为全局脚本加载（Cubism SDK 需要）
 */
(function () {
  var live2dPath = '/live2d/';

  // 加载 CSS
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = live2dPath + 'waifu.css';
  document.head.appendChild(link);

  /** 加载 JS 文件，包裹在 IIFE 中以隔离作用域 */
  function loadWrapped(url) {
    return fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (code) {
        return new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.textContent = '(function(){' + code + '\n})();';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
          resolve();
        });
      });
  }

  /** 按顺序加载所有脚本 */
  function init() {
    loadWrapped(live2dPath + 'chunk/index.js')
      .then(function () { return loadWrapped(live2dPath + 'chunk/index2.js'); })
      .then(function () { return loadWrapped(live2dPath + 'waifu-tips.js'); })
      .then(function () {
        if (window.initWidget) {
          window.initWidget({
            waifuPath: live2dPath + 'waifu-tips.json',
            cubism2Path: live2dPath + 'live2d.min.js',
            cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
            tools: ['hitokoto', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
            logLevel: 'warn',
            drag: true
          });
          console.log('[Live2D] Widget initialized');
        } else {
          console.warn('[Live2D] initWidget not found after loading');
        }
      })
      .catch(function (err) {
        console.error('[Live2D] Failed to load:', err);
      });
  }

  // 等待 DOM 就绪
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
