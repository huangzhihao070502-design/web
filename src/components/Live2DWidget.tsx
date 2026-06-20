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
      }
    }, 500);

    const handleVisibility = () => {
      const w = document.getElementById('waifu');
      if (w) w.style.display = document.hidden ? 'none' : 'block';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    function setupTriggers(waifu: HTMLElement) {
      // 5-click trigger
      waifu.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 3000);
        if (clickCount >= 5) { clickCount = 0; startWalk(waifu); }
      });
      // Random walk every 30-90s
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
        // Screen shake
        const container = document.querySelector('.app-container') || document.querySelector('.max-w-\\[420px\\]') || document.querySelector('.bg-warm-white');
        if (container) { container.classList.add('live2d-screen-shake'); setTimeout(() => container.classList.remove('live2d-screen-shake'), 400); }
        currentWalkTimer = null;
        scheduleNext(waifu);
      }, 12000);
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
      // Blink every 4-6s
      if (now - lastBlink > 4000 + Math.random() * 2000) {
        model.setParamFloat?.('PARAM_EYE_L_OPEN', 0.1);
        model.setParamFloat?.('PARAM_EYE_R_OPEN', 0.1);
        setTimeout(() => { model.setParamFloat?.('PARAM_EYE_L_OPEN', 1); model.setParamFloat?.('PARAM_EYE_R_OPEN', 1); }, 150);
        lastBlink = now;
      }
      // Breathe
      model.setParamFloat?.('PARAM_BREATH', 0.5 + Math.sin(Date.now() / 2000) * 0.15);
      // Eye movement
      model.setParamFloat?.('PARAM_EYE_BALL_X', Math.sin(Date.now() / 4000) * 3);
      model.setParamFloat?.('PARAM_EYE_BALL_Y', Math.cos(Date.now() / 5000) * 2);
      // Subtle body sway
      model.setParamFloat?.('PARAM_BODY_ANGLE_X', Math.sin(Date.now() / 3000) * 1.5);
      // Gentle head tilt
      model.setParamFloat?.('PARAM_ANGLE_Z', Math.sin(Date.now() / 4000) * 2);
    } catch {}
  }, 50);
}
