/*!
 * Live2D Widget - Init
 * Scripts loaded in index.html, this file handles CSS + init.
 */
(function () {
  var live2dPath = '/live2d/';

  // Load CSS
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = live2dPath + 'waifu.css';
  document.head.appendChild(link);

  function init() {
    if (window.initWidget) {
      window.initWidget({
        waifuPath: live2dPath + 'waifu-tips.json',
        cubism2Path: live2dPath + 'live2d.min.js',
        cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
        tools: ['hitokoto', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
        logLevel: 'warn',
        drag: true,
      });
    } else {
      console.warn('[Live2D] initWidget not found');
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
