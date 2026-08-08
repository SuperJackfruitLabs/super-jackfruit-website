export async function initAtmosphere(canvas: HTMLCanvasElement): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;

  try {
    const THREE = await import('three');

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.z = 12;

    // soft radial sprite texture, drawn once
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = 128;
    const ctx = spriteCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(spriteCanvas);

    // haze sprites
    const hazeColors = [0x4c054d, 0x093a4d, 0x4c054d];
    const hazes: import('three').Sprite[] = [];
    hazeColors.forEach((color, i) => {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(22, 12, 1);
      s.position.set((i - 1) * 10, -1 + i * 1.5, -6);
      scene.add(s);
      hazes.push(s);
    });

    // ground glow sprites (sidewalk shimmer)
    [0x09e6f2, 0xf2a707].forEach((color, i) => {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(16, 3, 1);
      s.position.set(i === 0 ? -6 : 7, -6.2, -4);
      scene.add(s);
    });

    // rain
    const RAIN_COUNT = 400;
    const positions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 2] = Math.random() * -8;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x8fa3b8,
      size: 0.06,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const rain = new THREE.Points(rainGeo, rainMat);
    scene.add(rain);

    let panX = 0;
    window.addEventListener('street:pan', ((e: CustomEvent<{ x: number }>) => {
      panX = e.detail.x;
    }) as EventListener);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const start = performance.now();
    renderer.setAnimationLoop(() => {
      if (document.hidden) return;
      const t = (performance.now() - start) / 1000;

      const pos = rainGeo.getAttribute('position') as import('three').BufferAttribute;
      for (let i = 0; i < RAIN_COUNT; i++) {
        let y = pos.getY(i) - 0.18;
        if (y < -12) y = 12;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + 0.01);
        if (pos.getX(i) > 20) pos.setX(i, -20);
      }
      pos.needsUpdate = true;

      hazes.forEach((h, i) => {
        h.position.x += Math.sin(t * 0.05 + i * 2) * 0.004;
      });

      camera.position.x = -panX * 0.004;
      renderer.render(scene, camera);
    });
  } catch {
    // decorative only — any failure means no atmosphere, nothing else
  }
}
