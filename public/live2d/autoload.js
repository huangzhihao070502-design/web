/*!
 * Live2D Widget - Modified for Capacitor WebView
 * All scripts loaded as regular (not ES modules)
 */

const live2d_path = '/live2d/';

function loadScript(url, wrapInIIFE) {
  return new Promise((resolve, reject) => {
    if (wrapInIIFE) {
      // Fetch, wrap in IIFE, inject as textContent
      fetch(url).then(r => r.text()).then(code => {
        const tag = document.createElement('script');
        tag.textContent = '(function(){' + code + '})();';
        document.body.appendChild(tag);
        resolve(url);
      }).catch(reject);
    } else {
      const tag = document.createElement('script');
      tag.src = url;
      tag.onload = () => resolve(url);
      tag.onerror = () => reject(new Error('Failed to load ' + url));
      document.body.appendChild(tag);
    }
  });
}

(async () => {
  // 1. CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = live2d_path + 'waifu.css';
  document.head.appendChild(link);

  // 2. Scripts: runtime first (chunks depend on it), then chunks+waifu-tips wrapped in IIFE
  await loadScript(live2d_path + 'live2d.min.js', false);
  await loadScript(live2d_path + 'chunk/index.js', true);
  await loadScript(live2d_path + 'chunk/index2.js', true);
  await loadScript(live2d_path + 'waifu-tips.js', true);

  // 3. Init
  if (window.initWidget) {
    window.initWidget({
      waifuPath: live2d_path + 'waifu-tips.json',
      cubism2Path: live2d_path + 'live2d.min.js',
      cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
      tools: ['hitokoto', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
      logLevel: 'info',
      drag: true,
    });
  }
})();
