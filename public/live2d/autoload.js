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

  /**
   * Long-press drag: hold 500ms on #waifu to activate, then drag freely anywhere.
   * - Quick taps/clicks pass through (no interference with tap-body, hover-body etc.)
   * - Touch + mouse supported
   * - Position persisted to localStorage
   * - Retries until #waifu exists (handles toggle-delayed appearance)
   */
  function setupLongPressDrag() {
    var waifu = document.getElementById('waifu');
    if (!waifu) {
      // Character DOM not yet created (hidden state, toggle will create it later)
      setTimeout(setupLongPressDrag, 300);
      return;
    }

    // Restore saved position from localStorage
    var savedPos;
    try {
      savedPos = JSON.parse(localStorage.getItem('waifu-position'));
    } catch (e) { /* ignore parse errors */ }

    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
      waifu.style.position = 'fixed';
      waifu.style.top = savedPos.top + 'px';
      waifu.style.left = savedPos.left + 'px';
      waifu.style.bottom = 'auto';
      waifu.style.right = 'auto';
    }

    // State
    var longPressTimer = null;
    var visualTimer = null;
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var offsetX = 0;
    var offsetY = 0;

    /** Get pointer coordinates from mouse or touch event */
    function getPos(e) {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    /** Activate drag mode: convert CSS layout to top/left inline, attach move handler */
    function activateDrag(e) {
      if (isDragging) return;
      isDragging = true;

      // Read current position and lock it as top/left to decouple from CSS bottom/right
      var rect = waifu.getBoundingClientRect();
      waifu.style.position = 'fixed';
      waifu.style.top = rect.top + 'px';
      waifu.style.left = rect.left + 'px';
      waifu.style.bottom = 'auto';
      waifu.style.right = 'auto';
      waifu.style.transition = 'none';

      // Visual feedback
      waifu.style.cursor = 'grabbing';
      waifu.classList.add('waifu-dragging');

      // Offset within the element (pointer position relative to element top-left corner)
      var pos = getPos(e);
      offsetX = pos.x - rect.left;
      offsetY = pos.y - rect.top;

      e.preventDefault();
    }

    function onPointerDown(e) {
      if (isDragging) return;

      // Allow clicks on tool buttons to pass through
      if (e.target && e.target.closest && e.target.closest('#waifu-tool')) return;

      var pos = getPos(e);
      startX = pos.x;
      startY = pos.y;

      // Clear stale timers
      clearTimeout(longPressTimer);
      clearTimeout(visualTimer);

      // Subtle visual feedback at 300ms to hint that hold is working
      visualTimer = setTimeout(function () {
        if (!isDragging) {
          waifu.style.cursor = 'move';
          waifu.style.opacity = '0.8';
        }
      }, 300);

      // Activate drag after 500ms hold
      longPressTimer = setTimeout(function () {
        activateDrag(e);
      }, 500);
    }

    function onPointerMove(e) {
      if (!isDragging) {
        // If pointer moves significantly before 500ms, cancel long-press
        // (prevents accidental drags during scroll or normal interaction)
        if (longPressTimer) {
          var pos = getPos(e);
          var dx = pos.x - startX;
          var dy = pos.y - startY;
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            clearTimeout(longPressTimer);
            clearTimeout(visualTimer);
            longPressTimer = null;
            visualTimer = null;
            waifu.style.cursor = '';
            waifu.style.opacity = '';
          }
        }
        return;
      }

      // Active drag: update position
      e.preventDefault();
      var pos = getPos(e);
      waifu.style.left = (pos.x - offsetX) + 'px';
      waifu.style.top = (pos.y - offsetY) + 'px';
    }

    function onPointerUp(e) {
      clearTimeout(longPressTimer);
      clearTimeout(visualTimer);
      longPressTimer = null;
      visualTimer = null;

      if (isDragging) {
        isDragging = false;

        // Remove drag visual state
        waifu.style.cursor = '';
        waifu.style.opacity = '';
        waifu.style.transition = '';
        waifu.classList.remove('waifu-dragging');

        // Persist position
        var rect = waifu.getBoundingClientRect();
        try {
          localStorage.setItem('waifu-position', JSON.stringify({
            top: rect.top,
            left: rect.left
          }));
        } catch (e) { /* storage full — silently degrade */ }

        e.preventDefault();
      }
    }

    // --- Mouse events ---
    waifu.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);

    // --- Touch events ---
    waifu.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
    document.addEventListener('touchcancel', onPointerUp);
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
            logLevel: 'warn'
            // Built-in drag disabled — we use our own long-press drag below
          });
          console.log('[Live2D] Widget initialized');

          // Attach long-press drag after widget DOM is ready
          setupLongPressDrag();
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
