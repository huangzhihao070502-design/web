import { useEffect, useRef } from 'react';

/**
 * Live2D 看板娘组件
 * 脚本已在 index.html 中加载，此组件负责生命周期管理
 */
export default function Live2DWidget() {
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    // 确保 waifu DOM 存在
    const checkInterval = setInterval(() => {
      const waifu = document.getElementById('waifu');
      if (waifu) {
        waifu.style.display = 'block';
        clearInterval(checkInterval);
      }
    }, 500);

    // 页面不可见时暂停
    const handleVisibility = () => {
      const waifu = document.getElementById('waifu');
      if (waifu) {
        waifu.style.display = document.hidden ? 'none' : 'block';
      }
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
