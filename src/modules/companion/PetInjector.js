/**
 * Live2D 猫耳娘桌面宠物注入器
 * 基于 fghrsh/live2d_demo 开源方案
 */

if (window.__PET_INJECTED__) {
  console.log('[Pet] Already injected, skip');
} else {
  window.__PET_INJECTED__ = true;

  function injectPet() {
    // 等待页面加载
    if (document.readyState === 'loading') {
      document.addEventListener('load', () => setTimeout(injectPet, 500));
      return;
    }

    console.log('[Pet] Injecting Live2D...');

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      #pet-container {
        position: fixed;
        right: 0;
        bottom: 0;
        z-index: 9999;
        pointer-events: none;
      }
      #pet-container canvas {
        pointer-events: auto;
        cursor: grab;
      }
      #pet-container .waifu-tool {
        pointer-events: auto;
      }
      #pet-toggle {
        position: fixed;
        right: 10px;
        bottom: 10px;
        z-index: 10000;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #FF69B4, #FF1493);
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(255,105,180,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s;
        pointer-events: auto;
      }
      #pet-toggle:hover {
        transform: scale(1.1);
      }
      #pet-toggle.hidden {
        transform: scale(0);
      }
    `;
    document.head.appendChild(style);

    // 创建切换按钮
    const toggle = document.createElement('button');
    toggle.id = 'pet-toggle';
    toggle.innerHTML = '🐱';
    toggle.title = '显示/隐藏宠物';
    document.body.appendChild(toggle);

    // 创建容器
    const container = document.createElement('div');
    container.id = 'pet-container';
    document.body.appendChild(container);

    // 加载Live2D核心
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/fghrsh/live2d_demo@master/assets/live2d.js';
    script.onload = () => {
      console.log('[Pet] Live2D loaded');

      // 初始化Live2D
      if (window.L2Dwidget) {
        L2Dwidget.init({
          model: {
            jsonPath: 'https://cdn.jsdelivr.net/gh/fghrsh/live2d_demo@master/assets/hijiki.model.json',
            scale: 1
          },
          display: {
            position: 'right',
            width: 150,
            height: 300,
            hOffset: 0,
            vOffset: -20
          },
          mobile: {
            show: true,
            scale: 0.8,
            motion: true
          },
          react: {
            opacityDefault: 0.9,
            opacityOnHover: 1
          },
          dialog: {
            enable: true,
            script: {
              'tap body': '哎呀！别碰我！',
              'tap face': '人家在认真工作呢~',
              'tap idle': '主人~ 你好呀！',
              'hitokoto': '主人，你知道吗？',
              'welcome': '欢迎回来，主人！'
            }
          }
        });

        // 添加点击交互
        setTimeout(() => {
          const canvas = container.querySelector('canvas');
          if (canvas) {
            canvas.addEventListener('click', () => {
              const messages = [
                '主人~ 你好呀！',
                '喵~',
                '要摸摸头吗？',
                '今天也要加油哦！',
                '最喜欢主人了！',
                '嘿嘿~',
                '主人辛苦啦！',
                '想聊天吗？'
              ];
              showBubble(messages[Math.floor(Math.random() * messages.length)]);
            });
          }
        }, 2000);

        console.log('[Pet] Live2D initialized');
      } else {
        console.error('[Pet] L2Dwidget not found');
        // 降级：使用简单动画
        injectFallback();
      }
    };

    script.onerror = () => {
      console.warn('[Pet] Live2D load failed, using fallback');
      injectFallback();
    };

    document.head.appendChild(script);

    // 降级方案：简单CSS动画猫耳娘
    function injectFallback() {
      container.innerHTML = `
        <div style="width:120px;height:180px;position:relative;cursor:pointer;pointer-events:auto;" id="fallback-pet">
          <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);text-align:center;">
            <div style="font-size:80px;line-height:1;animation:petBounce 2s ease-in-out infinite;">🐱</div>
            <div style="font-size:12px;color:#FF69B4;font-weight:bold;margin-top:5px;">喵~</div>
          </div>
        </div>
      `;

      const animStyle = document.createElement('style');
      animStyle.textContent = `
        @keyframes petBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `;
      document.head.appendChild(animStyle);

      document.getElementById('fallback-pet').addEventListener('click', () => {
        const messages = ['主人~ 你好呀！', '喵~', '要摸摸头吗？', '今天也要加油！'];
        showBubble(messages[Math.floor(Math.random() * messages.length)]);
      });
    }

    // 气泡消息
    function showBubble(text) {
      const bubble = document.createElement('div');
      bubble.style.cssText = `
        position:fixed;right:160px;bottom:200px;
        background:linear-gradient(135deg,#FF69B4,#FF1493);
        color:white;padding:8px 16px;border-radius:15px;
        font-size:13px;max-width:200px;z-index:10001;
        box-shadow:0 3px 10px rgba(255,105,180,0.4);
        animation:petBubbleAnim 3s ease-in-out forwards;
        pointer-events:none;
      `;
      bubble.textContent = text;
      document.body.appendChild(bubble);
      setTimeout(() => bubble.remove(), 3000);
    }

    // 气泡动画
    const bubbleStyle = document.createElement('style');
    bubbleStyle.textContent = `
      @keyframes petBubbleAnim {
        0% { opacity:0; transform:translateY(0) scale(0.8); }
        15% { opacity:1; transform:translateY(-10px) scale(1); }
        80% { opacity:1; transform:translateY(-20px) scale(1); }
        100% { opacity:0; transform:translateY(-30px) scale(0.8); }
      }
    `;
    document.head.appendChild(bubbleStyle);

    // 切换显示/隐藏
    let isVisible = true;
    toggle.addEventListener('click', () => {
      isVisible = !isVisible;
      container.style.display = isVisible ? 'block' : 'none';
      toggle.innerHTML = isVisible ? '🐱' : '😺';
    });

    // 后台暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        container.style.display = 'none';
      } else if (isVisible) {
        container.style.display = 'block';
      }
    });

    // 拖拽位置记忆
    let isDragging = false, startX, startY, startRight, startBottom;

    document.addEventListener('pointerdown', (e) => {
      if (e.target.id === 'pet-toggle') return;
      const canvas = container.querySelector('canvas');
      if (canvas && canvas.contains(e.target)) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = container.getBoundingClientRect();
        startRight = window.innerWidth - rect.right;
        startBottom = window.innerHeight - rect.bottom;
      }
    });

    document.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const newRight = Math.max(0, startRight + (startX - e.clientX));
      const newBottom = Math.max(0, startBottom + (startY - e.clientY));
      container.style.right = newRight + 'px';
      container.style.bottom = newBottom + 'px';
    });

    document.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        try {
          localStorage.setItem('pet_pos', JSON.stringify({
            right: container.style.right,
            bottom: container.style.bottom
          }));
        } catch {}
      }
    });

    // 恢复位置
    try {
      const pos = JSON.parse(localStorage.getItem('pet_pos'));
      if (pos) {
        container.style.right = pos.right;
        container.style.bottom = pos.bottom;
      }
    } catch {}

    console.log('[Pet] Live2D pet injected!');
  }

  injectPet();
}
