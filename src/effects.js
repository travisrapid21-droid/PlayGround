import * as THREE from 'three';

function makeVaporTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,.9)');
  gradient.addColorStop(0.32, 'rgba(245,252,255,.55)');
  gradient.addColorStop(1, 'rgba(230,248,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createVaporTrails(aircraftRoot) {
  const perTrail = 72;
  const total = perTrail * 2;
  const positions = new Float32Array(total * 3);
  const alphas = new Float32Array(total);
  const sizes = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    positions[i * 3 + 1] = -10000;
    alphas[i] = 0;
    sizes[i] = 1.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: makeVaporTexture() },
      uColor: { value: new THREE.Color('#eafbff') },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(uColor, tex.a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  const scene = aircraftRoot.parent;
  if (scene) scene.add(points);
  else aircraftRoot.addEventListener?.('added', () => aircraftRoot.parent?.add(points));

  let head = 0;
  let accumulator = 0;
  const localTips = [
    new THREE.Vector3(-7.16, 0.06, 2.0),
    new THREE.Vector3(7.16, 0.06, 2.0),
  ];
  const worldTip = new THREE.Vector3();
  const random = () => 0.7 + Math.random() * 0.6;

  function addPoint(tipIndex, worldPosition) {
    const base = tipIndex * perTrail;
    const index = base + (head % perTrail);
    positions[index * 3] = worldPosition.x;
    positions[index * 3 + 1] = worldPosition.y;
    positions[index * 3 + 2] = worldPosition.z;
    alphas[index] = 0.2;
    sizes[index] = 1.6;
    head++;
  }

  function update(dt, flight, trailStrength) {
    accumulator += dt;
    const emit = accumulator > 0.025;
    if (emit) accumulator = 0;
    for (let i = 0; i < total; i++) {
      alphas[i] *= Math.exp(-1.4 * dt);
    }
    if (emit && trailStrength > 0.03) {
      for (let tipIndex = 0; tipIndex < 2; tipIndex++) {
        worldTip.copy(localTips[tipIndex]).applyMatrix4(aircraftRoot.matrixWorld);
        addPoint(tipIndex, worldTip);
        const base = tipIndex * perTrail;
        for (let j = 0; j < perTrail; j++) {
          const index = base + j;
          const age = ((head + perTrail - (index % perTrail)) % perTrail) / perTrail;
          if (alphas[index] > 0) {
            sizes[index] = (0.8 + age * 5.4) * random() * 0.45;
            if (age > 0.92) alphas[index] *= 0.8;
          }
        }
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  }

  return { update, points };
}
