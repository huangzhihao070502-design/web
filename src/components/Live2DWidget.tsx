import { useEffect } from 'react';

/**
 * Live2D 看板娘组件 — 全局加载
 * 在 index.html 或 App.tsx 中引入即可
 */
export default function Live2DWidget() {
  useEffect(() => {
    // 避免重复加载
    if (document.getElementById('waifu-css')) return;

    // 1. 加载 CSS
    const link = document.createElement('link');
    link.id = 'waifu-css';
    link.rel = 'stylesheet';
    link.href = '/live2d/waifu.css';
    document.head.appendChild(link);

    // 2. 加载 waifu-tips.js（initWidget 会在这里面定义）
    const script = document.createElement('script');
    script.id = 'waifu-tips-js';
    script.type = 'module';
    script.src = '/live2d/waifu-tips.js';
    script.onload = () => {
      // 3. 脚本加载完成后初始化
      (window as any).initWidget?.({
        waifuPath: '/live2d/waifu-tips.json',
        cubism2Path: '/live2d/live2d.min.js',
        cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
        tools: ['hitokoto', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
        logLevel: 'warn',
        drag: true,
      });
    };
    document.body.appendChild(script);

    // Cleanup
    return () => {
      // 移除看板娘 DOM
      const waifu = document.getElementById('waifu');
      if (waifu) waifu.remove();
      // 移除脚本和样式
      link.remove();
      script.remove();
    };
  }, []);

  return null; // 看板娘通过脚本直接注入 DOM，React 不渲染任何内容
}
