/**
 * 3D桌面宠物注入器 - 支持真实3D模型
 */

if (window.__PET_INJECTED__) {
  console.log('[Pet] Already injected, skip');
} else {
  window.__PET_INJECTED__ = true;

  // 加载JS文件
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // 精致的卡通猫耳娘几何体
  function createCuteCatGirl(THREE) {
    const group = new THREE.Group();

    // 材质
    const skinMat = new THREE.MeshToonMaterial({ color: 0xFFE0BD });
    const hairMat = new THREE.MeshToonMaterial({ color: 0x2C1810 });
    const dressMat = new THREE.MeshToonMaterial({ color: 0xFF69B4 });
    const earMat = new THREE.MeshToonMaterial({ color: 0xFFB6C1 });
    const eyeMat = new THREE.MeshToonMaterial({ color: 0x4169E1 });
    const whiteMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF });
    const mouthMat = new THREE.MeshToonMaterial({ color: 0xFF6B6B });

    // 身体（裙子形状）
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.4, 0.7, 16);
    const body = new THREE.Mesh(bodyGeo, dressMat);
    body.position.y = 0.1;
    group.add(body);

    // 头
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), skinMat);
    head.position.y = 0.75;
    head.scale.set(1, 1.05, 0.95);
    group.add(head);

    // 头发（前发）
    const frontHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hairMat
    );
    frontHair.position.y = 0.82;
    group.add(frontHair);

    // 头发（后发）
    const backHair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.08, 0.6, 8),
      hairMat
    );
    backHair.position.set(0, 0.4, -0.2);
    group.add(backHair);

    // 猫耳（左）
    const earGeo = new THREE.ConeGeometry(0.1, 0.22, 4);
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-0.18, 1.08, 0);
    leftEar.rotation.z = 0.3;
    group.add(leftEar);

    // 猫耳（右）
    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(0.18, 1.08, 0);
    rightEar.rotation.z = -0.3;
    group.add(rightEar);

    // 内耳
    const innerEarGeo = new THREE.ConeGeometry(0.05, 0.12, 4);
    const innerEarMat = new THREE.MeshToonMaterial({ color: 0xFFB6C1 });
    const leftInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
    leftInnerEar.position.set(-0.18, 1.06, 0.03);
    leftInnerEar.rotation.z = 0.3;
    group.add(leftInnerEar);
    const rightInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
    rightInnerEar.position.set(0.18, 1.06, 0.03);
    rightInnerEar.rotation.z = -0.3;
    group.add(rightInnerEar);

    // 眼睛（左）
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 0.78, 0.28);
    group.add(leftEye);

    // 眼睛（右）
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 0.78, 0.28);
    group.add(rightEye);

    // 眼白高光
    const highlightGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const leftHighlight = new THREE.Mesh(highlightGeo, whiteMat);
    leftHighlight.position.set(-0.08, 0.8, 0.33);
    group.add(leftHighlight);
    const rightHighlight = new THREE.Mesh(highlightGeo, whiteMat);
    rightHighlight.position.set(0.12, 0.8, 0.33);
    group.add(rightHighlight);

    // 嘴巴
    const mouthGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 0.67, 0.3);
    mouth.scale.set(1.5, 0.8, 1);
    group.add(mouth);

    // 腮红
    const blushGeo = new THREE.CircleGeometry(0.04, 8);
    const blushMat = new THREE.MeshToonMaterial({ color: 0xFFB6C1, transparent: true, opacity: 0.5 });
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-0.18, 0.72, 0.3);
    leftBlush.lookAt(0, 0.72, 1);
    group.add(leftBlush);
    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(0.18, 0.72, 0.3);
    rightBlush.lookAt(0, 0.72, 1);
    group.add(rightBlush);

    // 手臂
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.3, 4, 8);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.35, 0.15, 0);
    leftArm.rotation.z = 0.4;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.35, 0.15, 0);
    rightArm.rotation.z = -0.4;
    group.add(rightArm);

    // 腿
    const legGeo = new THREE.CapsuleGeometry(0.07, 0.25, 4, 8);
    const legMat = new THREE.MeshToonMaterial({ color: 0x2C1810 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.12, -0.5, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.12, -0.5, 0);
    group.add(rightLeg);

    // 鞋子
    const shoeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const shoeMat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.12, -0.65, 0.03);
    leftShoe.scale.set(1, 0.6, 1.3);
    group.add(leftShoe);
    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.12, -0.65, 0.03);
    rightShoe.scale.set(1, 0.6, 1.3);
    group.add(rightShoe);

    // 猫尾巴
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, -0.3),
      new THREE.Vector3(0, 0.3, -0.5),
      new THREE.Vector3(0.1, 0.5, -0.4),
      new THREE.Vector3(0.15, 0.6, -0.2),
    ]);
    const tailGeo = new THREE.TubeGeometry(tailCurve, 20, 0.04, 8, false);
    const tail = new THREE.Mesh(tailGeo, hairMat);
    group.add(tail);

    // 存储动画引用
    group.userData = {
      head, leftArm, rightArm, body, tail,
      leftEar, rightEar, leftLeg, rightLeg,
      type: 'catgirl'
    };

    return group;
  }

  async function injectPet() {
    await new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve);
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

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
      console.error('[Pet] THREE not found');
      return;
    }

    // 加载GLTFLoader
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/loaders/GLTFLoader.js');
      console.log('[Pet] GLTFLoader loaded');
    } catch (e) {
      console.warn('[Pet] GLTFLoader failed, using geometric character');
    }

    // 创建容器
    const container = document.createElement('div');
    container.id = 'pet-3d-container';
    container.style.cssText = 'position:fixed;right:10px;bottom:80px;width:180px;height:250px;z-index:9999;pointer-events:none;';
    document.body.appendChild(container);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;pointer-events:auto;cursor:grab;';
    container.appendChild(canvas);

    // 渲染器
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(180, 250);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (e) {
      console.error('[Pet] WebGL not supported');
      container.remove();
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 180/250, 0.1, 100);
    camera.position.set(0, 0.8, 3.5);
    camera.lookAt(0, 0.3, 0);

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
    mainLight.position.set(2, 3, 4);
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0xFFB6C1, 0.3);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);

    // 尝试加载GLB模型
    let model = null;
    let mixer = null;
    let usingGLTF = false;

    if (window.THREE.GLTFLoader) {
      const loader = new THREE.GLTFLoader();
      const modelUrls = [
        'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Michelle.glb',
        'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
      ];

      for (const url of modelUrls) {
        try {
          const gltf = await new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          });
          model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const scale = 1.5 / size.y;
          model.scale.set(scale, scale, scale);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center.multiplyScalar(scale));
          scene.add(model);

          if (gltf.animations?.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            const idleClip = gltf.animations[0];
            mixer.clipAction(idleClip).play();
          }
          usingGLTF = true;
          console.log('[Pet] GLB model loaded:', url);
          break;
        } catch (e) {
          console.warn('[Pet] Failed:', url);
        }
      }
    }

    // 如果GLB加载失败，使用精致猫耳娘
    if (!model) {
      console.log('[Pet] Using cat girl character');
      model = createCuteCatGirl(THREE);
      scene.add(model);
    }

    // 动画
    let time = 0;
    let isWaving = false;
    let waveTime = 0;
    const clock = new THREE.Clock();
    let isVisible = true;

    function animate() {
      if (!isVisible) return;
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      time += delta;

      if (mixer) {
        mixer.update(delta);
      }

      if (!usingGLTF && model.userData) {
        const d = model.userData;

        // 呼吸
        if (d.body) d.body.scale.x = 1 + Math.sin(time * 2) * 0.02;

        // 头部摆动
        if (d.head) {
          d.head.rotation.z = Math.sin(time * 1.2) * 0.1;
          d.head.rotation.x = Math.sin(time * 0.8) * 0.05;
        }

        // 猫耳抖动
        if (d.leftEar) d.leftEar.rotation.z = 0.3 + Math.sin(time * 3) * 0.1;
        if (d.rightEar) d.rightEar.rotation.z = -0.3 + Math.sin(time * 3 + 0.5) * 0.1;

        // 手臂摆动
        if (d.leftArm) d.leftArm.rotation.z = 0.4 + Math.sin(time * 1.5) * 0.15;
        if (d.rightArm) {
          if (isWaving) {
            waveTime += delta;
            d.rightArm.rotation.z = -1.8 + Math.sin(waveTime * 10) * 0.6;
            if (waveTime > 1.2) { isWaving = false; waveTime = 0; }
          } else {
            d.rightArm.rotation.z = -0.4 + Math.sin(time * 1.5 + 1) * 0.15;
          }
        }

        // 尾巴摇摆
        if (d.tail) d.tail.rotation.y = Math.sin(time * 2) * 0.3;

        // 腿微动
        if (d.leftLeg) d.leftLeg.rotation.x = Math.sin(time * 1.2) * 0.05;
        if (d.rightLeg) d.rightLeg.rotation.x = Math.sin(time * 1.2 + 1) * 0.05;

        // 整体浮动
        model.position.y = Math.sin(time * 1.5) * 0.03;
      }

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

    function showBubble(parent) {
      const msgs = ['主人~ 你好呀！', '喵~', '要摸摸头吗？', '今天也要加油！', '最喜欢主人了！', '嘿嘿~', '想聊天吗？', '主人辛苦啦！'];
      const bubble = document.createElement('div');
      bubble.style.cssText = 'position:absolute;top:-35px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#FF69B4,#FF1493);color:white;padding:6px 14px;border-radius:15px;font-size:12px;white-space:nowrap;pointer-events:none;animation:petBubble 2.5s ease-in-out forwards;z-index:10000;box-shadow:0 2px 8px rgba(255,105,180,0.4);';
      bubble.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      parent.appendChild(bubble);
      setTimeout(() => bubble.remove(), 2500);
    }

    const style = document.createElement('style');
    style.textContent = '@keyframes petBubble{0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.5)}15%{opacity:1;transform:translateX(-50%) translateY(-15px) scale(1)}75%{opacity:1;transform:translateX(-50%) translateY(-25px) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-40px) scale(0.8)}}';
    document.head.appendChild(style);

    // 拖拽
    let isDragging = false, sx, sy, sr, sb;
    canvas.addEventListener('pointerdown', (e) => { isDragging = true; sx = e.clientX; sy = e.clientY; sr = parseInt(container.style.right)||10; sb = parseInt(container.style.bottom)||80; });
    document.addEventListener('pointermove', (e) => { if (!isDragging) return; container.style.right = `${Math.max(0, sx-e.clientX+sr)}px`; container.style.bottom = `${Math.max(0, sy-e.clientY+sb)}px`; });
    document.addEventListener('pointerup', () => { if (isDragging) { isDragging = false; try { localStorage.setItem('pet_pos', JSON.stringify({r:container.style.right,b:container.style.bottom})); } catch {} } });

    try { const p = JSON.parse(localStorage.getItem('pet_pos')); if (p) { container.style.right = p.r; container.style.bottom = p.b; } } catch {}

    // 后台暂停
    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      container.style.display = document.hidden ? 'none' : 'block';
      if (!document.hidden) { clock.getDelta(); animate(); }
    });

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); container.style.display = 'none'; });
    canvas.addEventListener('webglcontextrestored', () => { container.style.display = 'block'; });

    console.log('[Pet] 3D pet injected!');
  }

  injectPet().catch(e => console.error('[Pet] Error:', e));
}
