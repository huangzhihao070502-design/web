/**
 * 3D卡通桌面宠物注入器 - Android WebView兼容版
 * 使用script标签加载Three.js（兼容Android WebView）
 */

if (window.__PET_INJECTED__) {
  console.log('[Pet] Already injected, skip');
} else {
  window.__PET_INJECTED__ = true;

  // 动态加载JS文件
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // 备用简单几何体人物
  function createSimpleCharacter(THREE) {
    const group = new THREE.Group();

    // 身体
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.8, 8, 16),
      new THREE.MeshToonMaterial({ color: 0x6C63FF })
    );
    group.add(body);

    // 头
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshToonMaterial({ color: 0xFFDBB5 })
    );
    head.position.y = 0.9;
    group.add(head);

    // 眼睛
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshToonMaterial({ color: 0x333333 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0.95, 0.3);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0.95, 0.3);
    group.add(rightEye);

    // 猫耳
    const earGeo = new THREE.ConeGeometry(0.12, 0.25, 4);
    const earMat = new THREE.MeshToonMaterial({ color: 0x6C63FF });

    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-0.2, 1.25, 0);
    leftEar.rotation.z = 0.3;
    group.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(0.2, 1.25, 0);
    rightEar.rotation.z = -0.3;
    group.add(rightEar);

    // 手臂
    const armGeo = new THREE.CapsuleGeometry(0.08, 0.4, 4, 8);
    const armMat = new THREE.MeshToonMaterial({ color: 0x6C63FF });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.45, 0.2, 0);
    leftArm.rotation.z = 0.5;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.45, 0.2, 0);
    rightArm.rotation.z = -0.5;
    group.add(rightArm);

    // 腿
    const legGeo = new THREE.CapsuleGeometry(0.1, 0.35, 4, 8);
    const legMat = new THREE.MeshToonMaterial({ color: 0x4A4A8A });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, -0.65, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, -0.65, 0);
    group.add(rightLeg);

    group.userData = { head, leftArm, rightArm, body, type: 'simple' };
    return group;
  }

  // 主注入函数
  async function injectPet() {
    // 等待页面加载
    await new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve);
    });

    // 延迟加载，避免阻塞首屏
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('[Pet] Starting injection...');

    // 加载Three.js
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
      console.log('[Pet] Three.js loaded');
    } catch (e) {
      console.error('[Pet] Failed to load Three.js:', e);
      return;
    }

    const THREE = window.THREE;
    if (!THREE) {
      console.error('[Pet] THREE not found on window');
      return;
    }

    // 创建容器
    const container = document.createElement('div');
    container.id = 'pet-3d-container';
    container.style.cssText = 'position:fixed;right:10px;bottom:80px;width:180px;height:220px;z-index:9999;pointer-events:none;';
    document.body.appendChild(container);

    // 创建Canvas
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;pointer-events:auto;cursor:grab;';
    container.appendChild(canvas);

    // 初始化渲染器
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setSize(180, 220);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
    } catch (e) {
      console.error('[Pet] WebGL not supported:', e);
      container.remove();
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 180/220, 0.1, 100);
    camera.position.set(0, 1, 4);
    camera.lookAt(0, 0.5, 0);

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 4);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0x6C63FF, 0.3);
    backLight.position.set(-2, 2, -2);
    scene.add(backLight);

    // 使用简单几何体人物（最可靠）
    console.log('[Pet] Creating character...');
    const model = createSimpleCharacter(THREE);
    scene.add(model);

    // 动画状态
    let time = 0;
    let isWaving = false;
    let waveTime = 0;
    const clock = new THREE.Clock();
    let isVisible = true;

    // 渲染循环
    function animate() {
      if (!isVisible) return;
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      time += delta;

      // 呼吸动画
      if (model.userData.body) {
        model.userData.body.scale.y = 1 + Math.sin(time * 2) * 0.02;
      }

      // 头部摆动
      if (model.userData.head) {
        model.userData.head.rotation.z = Math.sin(time * 1.5) * 0.08;
        model.userData.head.rotation.x = Math.sin(time * 1) * 0.05;
      }

      // 手臂摆动
      if (model.userData.leftArm) {
        model.userData.leftArm.rotation.z = 0.5 + Math.sin(time * 1.2) * 0.15;
      }
      if (model.userData.rightArm) {
        if (isWaving) {
          waveTime += delta;
          model.userData.rightArm.rotation.z = -1.5 + Math.sin(waveTime * 8) * 0.5;
          if (waveTime > 1.5) { isWaving = false; waveTime = 0; }
        } else {
          model.userData.rightArm.rotation.z = -0.5 + Math.sin(time * 1.2 + 1) * 0.15;
        }
      }

      // 整体浮动
      model.position.y = Math.sin(time * 1.5) * 0.05;

      renderer.render(scene, camera);
    }

    animate();
    console.log('[Pet] Animation started');

    // 点击交互
    canvas.addEventListener('click', (e) => {
      e.stopPropagation();
      isWaving = true;
      waveTime = 0;
      showBubble(container);
    });

    // 气泡消息
    function showBubble(parent) {
      const msgs = ['主人~ 你好呀！', '今天也要加油哦！', '要摸摸头吗？', '喵~', '主人辛苦啦！', '想聊天吗？', '嘿嘿~', '最喜欢主人了！'];
      const bubble = document.createElement('div');
      bubble.style.cssText = 'position:absolute;top:-40px;left:50%;transform:translateX(-50%);background:rgba(108,99,255,0.9);color:white;padding:6px 12px;border-radius:12px;font-size:12px;white-space:nowrap;pointer-events:none;animation:petBubble 2s ease-in-out forwards;z-index:10000;';
      bubble.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      parent.appendChild(bubble);
      setTimeout(() => bubble.remove(), 2000);
    }

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = '@keyframes petBubble{0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.8)}20%{opacity:1;transform:translateX(-50%) translateY(-10px) scale(1)}80%{opacity:1;transform:translateX(-50%) translateY(-20px) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-30px) scale(0.8)}}';
    document.head.appendChild(style);

    // 拖拽功能
    let isDragging = false, startX, startY, startRight, startBottom;

    canvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(container.style.right) || 10;
      startBottom = parseInt(container.style.bottom) || 80;
      canvas.style.cursor = 'grabbing';
    });

    document.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      container.style.right = `${Math.max(0, startX - e.clientX + startRight)}px`;
      container.style.bottom = `${Math.max(0, startY - e.clientY + startBottom)}px`;
    });

    document.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
        try { localStorage.setItem('pet_position', JSON.stringify({ right: container.style.right, bottom: container.style.bottom })); } catch {}
      }
    });

    // 恢复位置
    try {
      const p = JSON.parse(localStorage.getItem('pet_position'));
      if (p) { container.style.right = p.right; container.style.bottom = p.bottom; }
    } catch {}

    // 后台暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isVisible = false;
        container.style.display = 'none';
      } else {
        isVisible = true;
        container.style.display = 'block';
        clock.getDelta();
        animate();
      }
    });

    // WebGL崩溃恢复
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      container.style.display = 'none';
    });
    canvas.addEventListener('webglcontextrestored', () => {
      container.style.display = 'block';
    });

    console.log('[Pet] 3D pet injected successfully!');
  }

  injectPet().catch(e => console.error('[Pet] Injection failed:', e));
}
