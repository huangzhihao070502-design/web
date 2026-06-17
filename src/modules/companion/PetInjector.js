/**
 * 3D卡通桌面宠物注入器
 * 全局注入，非侵入式，不影响现有业务逻辑
 */

if (window.__PET_INJECTED__) {
  console.log('[Pet] Already injected, skip');
} else {
  window.__PET_INJECTED__ = true;

  const MODEL_URLS = [
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Michelle.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Monster/Monster.glb',
  ];

  function createSimpleCharacter() {
    const THREE = window.THREE;
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.8, 8, 16),
      new THREE.MeshToonMaterial({ color: 0x6C63FF })
    );
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshToonMaterial({ color: 0xFFDBB5 })
    );
    head.position.y = 0.9;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshToonMaterial({ color: 0x333333 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0.95, 0.3);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0.95, 0.3);
    group.add(rightEye);

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

    const smileCurve = new THREE.EllipseCurve(0, 0, 0.1, 0.05, 0, Math.PI, false, 0);
    const smilePoints = smileCurve.getPoints(20);
    const smileGeo = new THREE.BufferGeometry().setFromPoints(smilePoints);
    const smile = new THREE.Line(smileGeo, new THREE.LineBasicMaterial({ color: 0x333333 }));
    smile.position.set(0, 0.82, 0.32);
    group.add(smile);

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

  async function injectPet() {
    await new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve);
    });

    await new Promise(resolve => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(resolve, { timeout: 3000 });
      } else {
        setTimeout(resolve, 2000);
      }
    });

    let THREE, GLTFLoader;
    try {
      const threeModule = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
      THREE = threeModule;
      const loaderModule = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
      GLTFLoader = loaderModule.GLTFLoader;
    } catch (e) {
      console.error('[Pet] Failed to load Three.js:', e);
      return;
    }

    const container = document.createElement('div');
    container.id = 'pet-3d-container';
    container.style.cssText = 'position:fixed;right:10px;bottom:80px;width:180px;height:220px;z-index:9999;pointer-events:none;transition:transform 0.3s ease;';
    document.body.appendChild(container);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;pointer-events:auto;cursor:grab;';
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setSize(180, 220);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 180/220, 0.1, 100);
    camera.position.set(0, 1, 4);
    camera.lookAt(0, 0.5, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 4);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0x6C63FF, 0.3);
    backLight.position.set(-2, 2, -2);
    scene.add(backLight);

    let model = null, mixer = null, currentAction = null, modelType = 'simple';

    if (GLTFLoader) {
      const loader = new GLTFLoader();
      for (const url of MODEL_URLS) {
        try {
          const gltf = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
          model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          model.position.y += 0.5;
          scene.add(model);
          if (gltf.animations?.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle') || gltf.animations[0];
            if (idleClip) { currentAction = mixer.clipAction(idleClip); currentAction.play(); }
          }
          modelType = 'gltf';
          console.log('[Pet] Model loaded:', url);
          break;
        } catch (e) { console.warn('[Pet] Failed:', url); }
      }
    }

    if (!model) { model = createSimpleCharacter(); scene.add(model); }

    let time = 0, isWaving = false, waveTime = 0;
    const clock = new THREE.Clock();
    let isVisible = true;

    function animate() {
      if (!isVisible) return;
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      time += delta;
      if (mixer) mixer.update(delta);

      if (modelType === 'simple' && model.userData) {
        if (model.userData.body) model.userData.body.scale.y = 1 + Math.sin(time * 2) * 0.02;
        if (model.userData.head) { model.userData.head.rotation.z = Math.sin(time * 1.5) * 0.05; model.userData.head.rotation.x = Math.sin(time) * 0.03; }
        if (model.userData.leftArm) model.userData.leftArm.rotation.z = 0.5 + Math.sin(time * 1.2) * 0.1;
        if (model.userData.rightArm) model.userData.rightArm.rotation.z = -0.5 + Math.sin(time * 1.2 + 1) * 0.1;
      }

      if (isWaving && model.userData?.rightArm) {
        waveTime += delta;
        model.userData.rightArm.rotation.z = -1.5 + Math.sin(waveTime * 8) * 0.5;
        if (waveTime > 1.5) { isWaving = false; waveTime = 0; }
      }

      renderer.render(scene, camera);
    }
    animate();

    canvas.addEventListener('click', (e) => {
      e.stopPropagation();
      if (modelType === 'simple' && model.userData) { isWaving = true; waveTime = 0; }
      showBubble(container);
    });

    function showBubble(parent) {
      const msgs = ['主人~ 你好呀！', '今天也要加油哦！', '要摸摸头吗？', '喵~', '主人辛苦啦！', '想聊天吗？', '嘿嘿~', '最喜欢主人了！'];
      const bubble = document.createElement('div');
      bubble.style.cssText = 'position:absolute;top:-40px;left:50%;transform:translateX(-50%);background:rgba(108,99,255,0.9);color:white;padding:6px 12px;border-radius:12px;font-size:12px;white-space:nowrap;pointer-events:none;animation:petBubble 2s ease-in-out forwards;z-index:10000;';
      bubble.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      parent.appendChild(bubble);
      setTimeout(() => bubble.remove(), 2000);
    }

    const style = document.createElement('style');
    style.textContent = '@keyframes petBubble{0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.8)}20%{opacity:1;transform:translateX(-50%) translateY(-10px) scale(1)}80%{opacity:1;transform:translateX(-50%) translateY(-20px) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-30px) scale(0.8)}}';
    document.head.appendChild(style);

    let isDragging = false, startX, startY, startRight, startBottom;
    canvas.addEventListener('pointerdown', (e) => { isDragging = true; startX = e.clientX; startY = e.clientY; startRight = parseInt(container.style.right); startBottom = parseInt(container.style.bottom); canvas.style.cursor = 'grabbing'; });
    document.addEventListener('pointermove', (e) => { if (!isDragging) return; container.style.right = `${Math.max(0, startX - e.clientX + startRight)}px`; container.style.bottom = `${Math.max(0, startY - e.clientY + startBottom)}px`; });
    document.addEventListener('pointerup', () => { if (isDragging) { isDragging = false; canvas.style.cursor = 'grab'; try { localStorage.setItem('pet_position', JSON.stringify({ right: container.style.right, bottom: container.style.bottom })); } catch {} } });

    try { const p = JSON.parse(localStorage.getItem('pet_position')); if (p) { container.style.right = p.right; container.style.bottom = p.bottom; } } catch {}

    document.addEventListener('visibilitychange', () => { if (document.hidden) { isVisible = false; container.style.display = 'none'; } else { isVisible = true; container.style.display = 'block'; clock.getDelta(); animate(); } });

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); container.style.display = 'none'; });
    canvas.addEventListener('webglcontextrestored', () => { container.style.display = 'block'; });

    console.log('[Pet] 3D pet injected successfully!');
  }

  injectPet().catch(e => console.error('[Pet] Injection failed:', e));
}
