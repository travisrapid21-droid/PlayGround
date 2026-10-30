import * as THREE from 'three';

const SRGB = THREE.SRGBColorSpace;

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,240,205,.75)');
  gradient.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = SRGB;
  return texture;
}

function makeDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(255, 178, 83, 0.92)';
  ctx.fillRect(758, 54, 7, 54);
  ctx.fillStyle = 'rgba(232, 249, 252, 0.92)';
  ctx.font = '600 80px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('AERONYX', 48, 133);
  ctx.fillStyle = 'rgba(255, 178, 83, 0.78)';
  ctx.font = '600 31px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.letterSpacing = '7px';
  ctx.fillText('NX-07  //  PACIFIC', 52, 188);
  ctx.strokeStyle = 'rgba(220,245,248,.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 218);
  ctx.lineTo(470, 218);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = SRGB;
  texture.anisotropy = 8;
  return texture;
}


function makePanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 1024, 512);
  base.addColorStop(0, '#d4d8d9');
  base.addColorStop(0.48, '#bfc4c6');
  base.addColorStop(1, '#cdd1d2');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const w = 25 + Math.random() * 180;
    const h = 2 + Math.random() * 14;
    ctx.fillStyle = Math.random() > 0.5 ? '#767d80' : '#eef0ef';
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(65, 72, 75, .48)';
  ctx.lineWidth = 1.4;
  const rows = [0, 63, 121, 186, 252, 310, 374, 438, 512];
  const cols = [0, 89, 172, 260, 351, 438, 527, 614, 704, 793, 883, 972, 1024];
  for (const y of rows) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  for (const x of cols) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.27;
  for (const y of rows) {
    for (let x = 12; x < 1024; x += 26) {
      ctx.fillStyle = Math.random() > 0.5 ? '#5c6264' : '#eef0ee';
      ctx.beginPath();
      ctx.arc(x, y + 5, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.lineCap = 'round';
  for (let i = 0; i < 55; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const length = 17 + Math.random() * 95;
    ctx.strokeStyle = `rgba(91, 101, 103, ${0.06 + Math.random() * 0.12})`;
    ctx.lineWidth = 1 + Math.random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 7, y + length);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = SRGB;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function makeFuselageGeometry() {
  const profile = [
    [-9.1, 0.03, 0.03, 0.08],
    [-8.7, 0.18, 0.16, 0.06],
    [-8.0, 0.42, 0.36, 0.03],
    [-7.0, 0.65, 0.55, 0.01],
    [-5.8, 0.94, 0.78, 0.03],
    [-4.6, 1.20, 0.95, 0.08],
    [-3.2, 1.38, 1.05, 0.12],
    [-1.6, 1.46, 1.04, 0.12],
    [0.2, 1.42, 0.98, 0.08],
    [2.0, 1.30, 0.90, 0.04],
    [3.8, 1.12, 0.78, 0.02],
    [5.6, 0.92, 0.65, 0.0],
    [7.1, 0.62, 0.48, 0.0],
    [8.2, 0.32, 0.30, 0.0],
    [8.6, 0.20, 0.22, 0.0],
  ];
  const radialSegments = 36;
  const rings = [];
  const segments = 68;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const scaled = t * (profile.length - 1);
    const i0 = Math.min(Math.floor(scaled), profile.length - 2);
    const f = scaled - i0;
    const smoothF = f * f * (3 - 2 * f);
    const p0 = profile[i0];
    const p1 = profile[i0 + 1];
    const z = THREE.MathUtils.lerp(p0[0], p1[0], smoothF);
    let rx = THREE.MathUtils.lerp(p0[1], p1[1], smoothF);
    let ry = THREE.MathUtils.lerp(p0[2], p1[2], smoothF);
    const cy = THREE.MathUtils.lerp(p0[3], p1[3], smoothF);
    const flatten = THREE.MathUtils.smoothstep(z, -1.5, 3.0);
    rx *= 1.0 + flatten * 0.08;
    ry *= 1.0 - flatten * 0.06;
    const ring = [];
    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const x = Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      ring.push(new THREE.Vector3(x, y, z));
    }
    rings.push(ring);
  }

  const positions = [];
  const indices = [];
  const uvs = [];
  for (let i = 0; i < rings.length; i++) {
    for (let j = 0; j <= radialSegments; j++) {
      const v = rings[i][j];
      positions.push(v.x, v.y, v.z);
      uvs.push(j / radialSegments, i / (rings.length - 1));
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + 1;
      const c = a + radialSegments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const nose = positions.length / 3;
  positions.push(0, 0.04, -9.13);
  uvs.push(0.5, 0);
  const tail = positions.length / 3;
  positions.push(0, 0, 8.61);
  uvs.push(0.5, 1);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(nose, j + 1, j);
    const base = (rings.length - 1) * (radialSegments + 1);
    indices.push(tail, base + j, base + j + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeWingGeometry(span, rootLeading, tipLeading, tipTrailing, thickness, mirrored = false) {
  const shape = new THREE.Shape();
  const sign = mirrored ? -1 : 1;
  shape.moveTo(0.72 * sign, rootLeading);
  shape.bezierCurveTo(
    0.35 * span * sign, rootLeading + (tipLeading - rootLeading) * 0.45,
    0.72 * span * sign, tipLeading - 0.05,
    span * sign, tipLeading
  );
  shape.lineTo(span * sign, tipTrailing);
  shape.bezierCurveTo(
    0.66 * span * sign, tipTrailing + 0.12,
    0.30 * span * sign, 3.02,
    0.72 * sign, 3.18
  );
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.055,
    bevelThickness: 0.045,
    curveSegments: 14,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(0, -center.y, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function makeFinGeometry(height, chordRoot, chordTip, thickness) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(chordRoot, 0);
  shape.lineTo(chordTip + 0.72, height);
  shape.lineTo(chordTip, height);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 4,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(-center.x, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function shadowize(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export function createAircraft() {
  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  const glowTexture = makeGlowTexture();

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7d8588,
    map: makePanelTexture(),
    metalness: 0.68,
    roughness: 0.31,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.45,
  });
  const darkMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x11181b,
    metalness: 0.78,
    roughness: 0.3,
    clearcoat: 0.75,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.1,
  });
  const accentMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb35a2b,
    metalness: 0.55,
    roughness: 0.3,
    clearcoat: 0.8,
    envMapIntensity: 1.2,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x919a9c,
    metalness: 0.96,
    roughness: 0.24,
    envMapIntensity: 1.6,
  });
  const nozzleMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f4547,
    metalness: 0.92,
    roughness: 0.26,
    envMapIntensity: 1.4,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0d2c34,
    metalness: 0.12,
    roughness: 0.055,
    transparent: true,
    opacity: 0.38,
    transmission: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const decalMaterial = new THREE.MeshBasicMaterial({
    map: makeDecalTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    toneMapped: false,
    opacity: 0.92,
  });

  const fuselage = new THREE.Mesh(makeFuselageGeometry(), bodyMaterial);
  model.add(fuselage);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    glassMaterial
  );
  canopy.scale.set(0.88, 0.72, 2.3);
  canopy.position.set(0, 0.95, -3.45);
  canopy.name = 'canopy';
  model.add(canopy);

  const canopyFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.038, 7, 48),
    darkMaterial
  );
  canopyFrame.rotation.x = Math.PI / 2;
  canopyFrame.scale.z = 2.46;
  canopyFrame.position.set(0, 1.02, -3.45);
  model.add(canopyFrame);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 6.1), darkMaterial);
  spine.position.set(0, 1.7, 1.1);
  spine.rotation.x = 0.06;
  model.add(spine);

  const wingGeometry = makeWingGeometry(7.15, -1.65, 1.6, 2.75, 0.28, false);
  const leftWingGeometry = makeWingGeometry(7.15, -1.65, 1.6, 2.75, 0.28, true);
  const rightWing = new THREE.Mesh(wingGeometry, bodyMaterial);
  rightWing.position.y = -0.03;
  model.add(rightWing);
  const leftWing = new THREE.Mesh(leftWingGeometry, bodyMaterial);
  leftWing.position.y = -0.03;
  model.add(leftWing);

  const wingAccentRight = new THREE.Mesh(
    makeWingGeometry(2.0, -1.3, 0.88, 1.18, 0.04, false),
    accentMaterial
  );
  wingAccentRight.position.set(5.06, 0.16, 0);
  model.add(wingAccentRight);
  const wingAccentLeft = new THREE.Mesh(
    makeWingGeometry(2.0, -1.3, 0.88, 1.18, 0.04, true),
    accentMaterial
  );
  wingAccentLeft.position.set(-5.06, 0.16, 0);
  model.add(wingAccentLeft);

  const stabilizerRight = new THREE.Mesh(
    makeWingGeometry(3.5, -1.25, 0.72, 1.32, 0.18, false),
    bodyMaterial
  );
  stabilizerRight.position.set(0.8, 0.2, 5.15);
  model.add(stabilizerRight);
  const stabilizerLeft = new THREE.Mesh(
    makeWingGeometry(3.5, -1.25, 0.72, 1.32, 0.18, true),
    bodyMaterial
  );
  stabilizerLeft.position.set(-0.8, 0.2, 5.15);
  model.add(stabilizerLeft);

  const finGeometry = makeFinGeometry(2.55, 2.2, 0.86, 0.16);
  const finRight = new THREE.Mesh(finGeometry, bodyMaterial);
  finRight.position.set(1.02, 0.55, 4.42);
  finRight.rotation.z = -0.24;
  model.add(finRight);
  const finLeft = new THREE.Mesh(finGeometry, bodyMaterial);
  finLeft.position.set(-1.02, 0.55, 4.42);
  finLeft.rotation.z = 0.24;
  model.add(finLeft);

  const finCaps = [];
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.78, 0.15), accentMaterial);
    cap.position.set(side * 1.38, 2.85, 6.64);
    cap.rotation.z = side * 0.24;
    model.add(cap);
    finCaps.push(cap);
  }

  const engines = [];
  const flames = [];
  const engineLights = [];
  for (const side of [-1, 1]) {
    const engineGroup = new THREE.Group();
    engineGroup.position.set(side * 1.62, -0.62, 0.95);

    const nacelle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.59, 0.66, 4.35, 32, 1, false),
      bodyMaterial
    );
    nacelle.rotation.x = Math.PI / 2;
    engineGroup.add(nacelle);

    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.075, 8, 32),
      metalMaterial
    );
    lip.position.z = -2.18;
    engineGroup.add(lip);

    const intake = new THREE.Mesh(
      new THREE.CircleGeometry(0.54, 32),
      new THREE.MeshBasicMaterial({ color: 0x05090a, side: THREE.DoubleSide })
    );
    intake.position.z = -2.2;
    intake.rotation.y = Math.PI;
    engineGroup.add(intake);

    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.47, 0.58, 1.05, 28, 1, true),
      nozzleMaterial
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 2.55;
    engineGroup.add(nozzle);

    const nozzleInner = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 28),
      new THREE.MeshBasicMaterial({
        color: 0xff9b41,
        transparent: true,
        opacity: 0.55,
        toneMapped: false,
      })
    );
    nozzleInner.position.z = 3.03;
    engineGroup.add(nozzleInner);

    const flameOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.43, 3.1, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff7a2e,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    flameOuter.rotation.x = Math.PI / 2;
    flameOuter.position.z = 4.55;
    engineGroup.add(flameOuter);

    const flameInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.23, 2.2, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x9fdcff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    flameInner.rotation.x = Math.PI / 2;
    flameInner.position.z = 4.05;
    engineGroup.add(flameInner);

    const engineLight = new THREE.PointLight(0xff8742, 0, 44, 2.1);
    engineLight.position.set(0, 0, 3.4);
    engineGroup.add(engineLight);

    flames.push({ outer: flameOuter, inner: flameInner });
    engineLights.push(engineLight);
    engines.push(engineGroup);
    model.add(engineGroup);
  }

  const missileMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9bcb9,
    metalness: 0.55,
    roughness: 0.36,
  });
  for (const side of [-1, 1]) {
    const missileGroup = new THREE.Group();
    missileGroup.position.set(side * 4.4, -0.34, 0.2);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 2.85, 14), missileMaterial);
    body.rotation.x = Math.PI / 2;
    missileGroup.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 14), missileMaterial);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -1.66;
    missileGroup.add(tip);
    for (const finSide of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.52), darkMaterial);
      fin.position.set(finSide * 0.14, 0, 1.0);
      missileGroup.add(fin);
    }
    model.add(missileGroup);
  }

  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), decalMaterial);
    decal.position.set(side * 1.505, 0.15, -0.15);
    decal.rotation.y = side * Math.PI / 2;
    model.add(decal);
  }

  const navLights = [];
  for (const side of [-1, 1]) {
    const color = side < 0 ? 0xff473b : 0x47ffb1;
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 8),
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    );
    nav.position.set(side * 7.16, 0.03, 2.0);
    model.add(nav);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }));
    glow.scale.setScalar(1.15);
    glow.position.copy(nav.position);
    model.add(glow);
    navLights.push({ nav, glow });
  }

  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffb85d,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  }));
  beacon.position.set(0, 1.85, 1.25);
  beacon.scale.setScalar(1.5);
  model.add(beacon);

  shadowize(model);

  const state = {
    root,
    model,
    canopy,
    flames,
    engineLights,
    navLights,
    beacon,
    time: 0,
    setCockpit(cockpit) {
      canopy.visible = !cockpit;
      canopyFrame.visible = !cockpit;
    },
    update(dt, throttle, speed) {
      state.time += dt;
      const thrust = THREE.MathUtils.clamp((throttle - 0.42) / 0.58, 0, 1);
      const flicker = 0.82 + Math.sin(state.time * 52 + 1.3) * 0.11 + Math.sin(state.time * 31.7) * 0.07;
      for (const flame of state.flames) {
        flame.outer.material.opacity = thrust * 0.62 * flicker;
        flame.outer.scale.set(0.82 + thrust * 0.3, 0.55 + thrust * 1.85, 0.82 + thrust * 0.3);
        flame.inner.material.opacity = thrust * 0.68 * flicker;
        flame.inner.scale.set(1, 0.45 + thrust * 1.2, 1);
      }
      for (const light of state.engineLights) {
        light.intensity = thrust * 24 * flicker;
      }
      for (let i = 0; i < state.navLights.length; i++) {
        const light = state.navLights[i];
        const blink = Math.sin(state.time * 3.4 + i * Math.PI) > 0.72 ? 0.1 : 0.62;
        light.nav.material.transparent = true;
        light.nav.material.opacity = blink;
        light.glow.material.opacity = blink;
      }
      beacon.material.opacity = Math.sin(state.time * 4.2) > 0.4 ? 0.7 : 0.0;
      model.updateMatrixWorld();
    },
  };
  return state;
}
