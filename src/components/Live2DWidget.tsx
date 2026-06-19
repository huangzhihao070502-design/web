import { useEffect, useRef } from 'react';

/**
 * Live2D 看板娘组件
 * - 管理生命周期（显示/隐藏）
 * - 注入微笑动画 + 眨眼优化
 */
export default function Live2DWidget() {
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    const checkInterval = setInterval(() => {
      const waifu = document.getElementById('waifu');
      if (waifu) {
        waifu.style.display = 'block';
        clearInterval(checkInterval);
        setTimeout(injectAnimations, 3000);
      }
    }, 500);

    const handleVisibility = () => {
      const waifu = document.getElementById('waifu');
      if (waifu) waifu.style.display = document.hidden ? 'none' : 'block';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(checkInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      const waifu = document.getElementById('waifu');
      if (waifu) waifu.style.display = 'none';
    };
  }, []);

  return null;
}

/**
 * 注入微笑和眨眼动画
 * 通过 Hook Canvas 的 WebGL context 来操控 Live2D 模型参数
 */
function injectAnimations() {
  const canvas = document.getElementById('live2d') as HTMLCanvasElement | null;
  if (!canvas) { setTimeout(injectAnimations, 1000); return; }

  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) { console.log('[Live2D] WebGL not ready'); return; }

  let lastSmile = Date.now();
  let isSmiling = false;

  // 使用 CSS 动画给 waifu 容器加轻微的左右摇摆
  const waifu = document.getElementById('waifu');
  if (waifu) {
    const style = document.createElement('style');
    style.id = 'live2d-animations';
    style.textContent = `
      @keyframes live2d-tilt {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(1.5deg); }
        75% { transform: rotate(-1.5deg); }
      }
      @keyframes live2d-blink-overlay {
        0%, 90%, 100% { opacity: 0; }
        92%, 98% { opacity: 1; }
      }
      #waifu-canvas {
        animation: live2d-tilt 8s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  // 每30秒随机微笑，每5秒眨眼脉冲
  setInterval(() => {
    const now = Date.now();

    // 微笑：每30秒触发一次，持续3秒
    if (!isSmiling && now - lastSmile > 30000) {
      isSmiling = true;
      lastSmile = now;
      setTimeout(() => { isSmiling = false; }, 3000);
    }

    // 通过 Live2D 全局 API 设置参数
    try {
      const live2dCanvas = document.getElementById('live2d') as any;
      if (live2dCanvas && window.Live2D) {
        // 尝试通过 Live2D 框架设置参数
        const model = (window as any).__live2d_model;
        if (model) {
          // 微笑
          if (isSmiling) {
            model.setParamFloat?.('PARAM_MOUTH_FORM', 0.6);
          } else {
            model.setParamFloat?.('PARAM_MOUTH_FORM', 0);
          }
          // 微微歪头 — 随机左右
          const tilt = Math.sin(Date.now() / 3000) * 3;
          model.setParamFloat?.('PARAM_ANGLE_Z', tilt);
        }
      }
    } catch (e) { /* 静默处理 */ }
  }, 1000);

  console.log('[Live2D] Animations injected — smile every 30s, tilt every 1s');
}
