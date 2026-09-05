// The mark uses the same polygon paths as the brand SVG.
export function createLogo(THREE, paths, front, edge) {
  const logo = new THREE.Group();
  for (const path of paths) {
    const points = [...path.matchAll(/[-+]?\d*\.?\d+/g)].map(match => Number(match[0]));
    const shape = new THREE.Shape();
    for (let i = 0; i < points.length; i += 2) {
      const x = (points[i] - 250) / 100;
      const y = (184 - points[i + 1]) / 100;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: .38, bevelEnabled: true, bevelSegments: 4,
      steps: 1, bevelSize: .025, bevelThickness: .035, curveSegments: 1
    });
    geometry.translate(0, 0, -.19);
    logo.add(new THREE.Mesh(geometry, [front, edge]));
  }
  return logo;
}

async function start() {
  const host = document.querySelector('.hero-art');
  const control = document.querySelector('.motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const THREE = await import('./assets/vendor/three.module.js');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    control.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 50);
  camera.position.set(0, .1, 10.5);
  camera.lookAt(0, -.05, 0);

  // Studio softboxes reflected in the bevels; no external textures or HDR downloads.
  const studio = document.createElement('canvas');
  studio.width = 1024; studio.height = 512;
  const ctx = studio.getContext('2d');
  ctx.fillStyle = '#18201e'; ctx.fillRect(0, 0, 1024, 512);
  const wash = ctx.createLinearGradient(0, 0, 0, 512);
  wash.addColorStop(0, '#85938b'); wash.addColorStop(.5, '#202c26'); wash.addColorStop(1, '#070b09');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#f5fff8'; ctx.fillRect(100, 20, 150, 350);
  ctx.fillStyle = '#bdcfca'; ctx.fillRect(550, 90, 100, 270);
  ctx.fillStyle = '#2deb92'; ctx.fillRect(810, 170, 110, 270);
  const map = new THREE.CanvasTexture(studio);
  map.colorSpace = THREE.SRGBColorSpace;
  map.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(map);
  scene.environment = environment.texture;
  map.dispose(); pmrem.dispose();
  const front = new THREE.MeshPhysicalMaterial({ color: 0xa0b7ab, metalness: .97, roughness: .21, clearcoat: 1, clearcoatRoughness: .18, envMapIntensity: 1.8 });
  const edge = new THREE.MeshPhysicalMaterial({ color: 0x078951, metalness: .85, roughness: .2, clearcoat: 1, envMapIntensity: 2.1 });
  const paths = [...host.querySelectorAll('.symbol path')].map(path => path.getAttribute('d'));
  const logo = createLogo(THREE, paths, front, edge);
  scene.add(logo);
  const key = new THREE.DirectionalLight(0xecfff3, 5);
  key.position.set(-3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x35ff9c, 6);
  rim.position.set(4, 1, -2); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9bc8ee, 2);
  fill.position.set(-5, -2, 3); scene.add(fill);

  let visible = true, paused = reduced.matches, lost = false, frame = 0;
  let elapsed = 0, previous = 0, lastPaint = 0;
  const target = { x: 0, y: 0 }, pointer = { x: 0, y: 0 };
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  host.addEventListener('pointermove', event => {
    if (!fine.matches || paused) return;
    const bounds = host.getBoundingClientRect();
    target.x = (event.clientX - bounds.left) / bounds.width - .5;
    target.y = (event.clientY - bounds.top) / bounds.height - .5;
  });
  host.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });
  function paint() {
    pointer.x += (target.x - pointer.x) * .045;
    pointer.y += (target.y - pointer.y) * .045;
    const motion = elapsed;
    logo.rotation.set(.12 + Math.sin(motion * .45) * .065 + pointer.y * .13, -.38 + Math.sin(motion * .3) * .19 + pointer.x * .38, -.055 + Math.sin(motion * .23) * .035);
    logo.position.y = Math.sin(motion * .55) * .11;
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0;
    if (paused || !visible || document.hidden || lost) return;
    if (now - lastPaint >= 1000 / 30) {
      elapsed += previous ? Math.min((now - previous) / 1000, .06) : 0;
      previous = now; lastPaint = now; paint();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    control.textContent = paused ? 'Retomar movimento' : 'Pausar movimento';
    control.setAttribute('aria-pressed', String(paused));
    if (!paused && visible && !document.hidden && !lost) frame = requestAnimationFrame(tick);
  }
  control.addEventListener('click', () => { paused = !paused; sync(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; target.x = target.y = pointer.x = pointer.y = 0; paint(); sync(); });
  document.addEventListener('visibilitychange', sync);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(host);
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.position.z = camera.aspect < .85 ? 12.6 : 10.5;
    camera.updateProjectionMatrix(); renderer.setSize(width, height); paint();
  });
  resize.observe(host);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; host.classList.remove('scene-ready'); control.hidden = true; sync(); });
  renderer.domElement.addEventListener('webglcontextrestored', () => { lost = false; paint(); host.classList.add('scene-ready'); control.hidden = false; sync(); });
  paint(); host.classList.add('scene-ready'); control.hidden = false; sync();
  addEventListener('pagehide', event => {
    if (event.persisted) return;
    cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
    logo.children.forEach(mesh => mesh.geometry.dispose());
    front.dispose(); edge.dispose(); environment.dispose(); renderer.dispose();
  });
}
if (typeof document !== 'undefined') start().catch(() => {
  document.querySelector('.hero-art')?.classList.remove('scene-ready');
  const button = document.querySelector('.motion-toggle');
  if (button) button.hidden = true;
});
