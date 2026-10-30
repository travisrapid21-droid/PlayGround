import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { terrainHeight } from './noise.js';

const SRGB = THREE.SRGBColorSpace;

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeEnvironment(renderer, sunDirection) {
  const canvas = createCanvas(1024, 512);
  const ctx = canvas.getContext('2d');
  const skyGradient = ctx.createLinearGradient(0, 0, 0, 512);
  skyGradient.addColorStop(0, '#1e528c');
  skyGradient.addColorStop(0.3, '#5c8fba');
  skyGradient.addColorStop(0.49, '#d8e1df');
  skyGradient.addColorStop(0.52, '#8c9d96');
  skyGradient.addColorStop(1, '#263b34');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, 1024, 512);

  const sunX = ((Math.atan2(sunDirection.x, -sunDirection.z) / (Math.PI * 2)) + 0.5) * 1024;
  const sunY = (0.5 - Math.asin(THREE.MathUtils.clamp(sunDirection.y, -1, 1)) / Math.PI) * 512;
  const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 155);
  glow.addColorStop(0, 'rgba(255,249,223,1)');
  glow.addColorStop(0.08, 'rgba(255,224,164,.9)');
  glow.addColorStop(0.35, 'rgba(255,188,112,.32)');
  glow.addColorStop(1, 'rgba(255,168,84,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 27; i++) {
    const y = 155 + Math.random() * 90;
    const x = Math.random() * 1024;
    const w = 80 + Math.random() * 280;
    const h = 6 + Math.random() * 22;
    const cloud = ctx.createRadialGradient(x, y, 1, x, y, w);
    cloud.addColorStop(0, 'rgba(255,245,231,.85)');
    cloud.addColorStop(1, 'rgba(255,245,231,0)');
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = SRGB;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();
  return target.texture;
}

function createSunGlow(sunDirection) {
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,255,246,1)');
  glow.addColorStop(0.05, 'rgba(255,248,218,1)');
  glow.addColorStop(0.15, 'rgba(255,218,151,.62)');
  glow.addColorStop(0.4, 'rgba(255,171,86,.18)');
  glow.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = SRGB;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xfff5dc,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(sunDirection).multiplyScalar(48000);
  sprite.scale.setScalar(1650);
  sprite.renderOrder = -2;
  return sprite;
}

function makeDetailTexture() {
  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const random = seededRandom(9182);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;
      let amplitude = 0.55;
      let frequency = 1;
      for (let octave = 0; octave < 4; octave++) {
        const sx = x * frequency / size;
        const sy = y * frequency / size;
        const n = Math.sin((sx * 23.1 + sy * 17.7) * Math.PI * 2 + random() * 0.2) * 0.5 + 0.5;
        value += n * amplitude;
        amplitude *= 0.48;
        frequency *= 2;
      }
      const grain = random() * 25;
      const shade = Math.max(0, Math.min(255, 55 + value * 165 + grain));
      const index = (y * size + x) * 4;
      image.data[index] = shade;
      image.data[index + 1] = shade;
      image.data[index + 2] = shade;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(140, 140);
  texture.anisotropy = 4;
  return texture;
}

function createTerrain(segments) {
  const size = 39000;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  const random = seededRandom(713);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const height = terrainHeight(x, z);
    position.setY(i, height);
  }
  geometry.computeVertexNormals();
  const normal = geometry.attributes.normal;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const height = position.getY(i);
    const slope = normal.getY(i);
    const variation = (Math.sin(x * 0.017 + z * 0.009) * 0.5 + 0.5) * 0.35 + random() * 0.65;
    const patch = Math.sin(x * 0.0031 + 1.7) * Math.cos(z * 0.0027 - 0.9) * 0.5 + 0.5;

    if (height < 8) {
      color.setRGB(0.24, 0.22, 0.16, SRGB);
    } else if (height < 34 + variation * 20) {
      color.setHSL(0.10, 0.24, 0.47 + variation * 0.09, SRGB);
    } else {
      const lush = THREE.MathUtils.clamp(height / 680, 0, 1);
      const hue = 0.285 - lush * 0.055 + variation * 0.018;
      const saturation = 0.23 + variation * 0.12;
      const lightness = 0.19 + variation * 0.085 + (1 - lush) * 0.025;
      color.setHSL(hue, saturation, lightness, SRGB);

      const rockAmount = THREE.MathUtils.clamp((0.83 - slope) * 3.4, 0, 1);
      if (rockAmount > 0.02) {
        const rock = new THREE.Color().setHSL(0.075, 0.1, 0.2 + variation * 0.13, SRGB);
        color.lerp(rock, rockAmount * (0.72 + patch * 0.28));
      }
      if (height > 1710 + variation * 120) {
        const snow = new THREE.Color().setHSL(0.55, 0.07, 0.82 + variation * 0.09, SRGB);
        const snowAmount = THREE.MathUtils.clamp((height - (1720 + variation * 130)) / 360, 0, 1) * THREE.MathUtils.smoothstep(slope, 0.6, 0.88);
        color.lerp(snow, snowAmount * 0.86);
      }
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const detail = makeDetailTexture();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    bumpMap: detail,
    bumpScale: 1.0,
    envMapIntensity: 0.38,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld; varying vec3 vTerrainNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float tFbm(vec2 p) {
  return tNoise(p) * 0.62 + tNoise(p * 2.17 + 11.3) * 0.26 + tNoise(p * 4.43 - 7.1) * 0.12;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float macro = tFbm(vTerrainWorld.xz * 0.00072);
  float detailN = tFbm(vTerrainWorld.xz * 0.012 + macro * 3.2);
  float micro = tNoise(vTerrainWorld.xz * 0.16);
  float slope = clamp(vTerrainNormal.y, 0.0, 1.0);
  float rockMask = smoothstep(0.86, 0.44, slope) * (0.62 + macro * 0.6);
  vec3 rockA = vec3(0.09, 0.083, 0.073);
  vec3 rockB = vec3(0.23, 0.2, 0.17);
  vec3 rock = mix(rockA, rockB, detailN);
  diffuseColor.rgb = mix(diffuseColor.rgb, rock, clamp(rockMask, 0.0, 0.88));
  float alpine = smoothstep(860.0, 1420.0, vTerrainWorld.y) * smoothstep(0.44, 0.76, slope);
  vec3 alpineColor = mix(vec3(0.17, 0.16, 0.135), vec3(0.3, 0.27, 0.22), detailN);
  diffuseColor.rgb = mix(diffuseColor.rgb, alpineColor, alpine * 0.58);
  float dry = smoothstep(0.48, 0.74, macro) * (1.0 - smoothstep(1040.0, 1520.0, vTerrainWorld.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 1.03, 0.73), dry * 0.34);
  float forest = smoothstep(0.42, 0.72, tFbm(vTerrainWorld.xz * 0.0045 + 4.1)) * smoothstep(60.0, 240.0, vTerrainWorld.y) * (1.0 - smoothstep(1020.0, 1380.0, vTerrainWorld.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.66, 0.78, 0.64), forest * 0.5);
  float snowLine = smoothstep(1740.0, 1980.0, vTerrainWorld.y);
  float snowSlope = smoothstep(0.5, 0.76, slope);
  float snowPatch = smoothstep(0.32, 0.68, tFbm(vTerrainWorld.xz * 0.006 + 9.7));
  float snow = snowLine * snowSlope * (0.36 + snowPatch * 0.58);
  vec3 snowColor = vec3(0.64, 0.71, 0.75);
  diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, clamp(snow, 0.0, 0.84));
  diffuseColor.rgb *= 0.79 + detailN * 0.32 + micro * 0.075;`);
  };
  material.customProgramCacheKey = () => 'terrain-detail-v2';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function createOcean(sunDirection) {
  const geometry = new THREE.PlaneGeometry(70000, 70000, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDirection: { value: sunDirection.clone() },
      uDeep: { value: new THREE.Color('#05242e') },
      uShallow: { value: new THREE.Color('#0c4d55') },
      uSky: { value: new THREE.Color('#7bb4d5') },
      uHorizon: { value: new THREE.Color('#d4e0dc') },
      uFog: { value: new THREE.Color('#b7ced8') },
      uFogDensity: { value: 0.000038 },
      uCamera: { value: new THREE.Vector3() },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uHorizon;
      uniform vec3 uFog;
      uniform float uFogDensity;
      uniform vec3 uCamera;
      varying vec3 vWorld;

      vec3 waveNormal(vec2 p, float t) {
        vec2 d1 = normalize(vec2(0.94, 0.34));
        vec2 d2 = normalize(vec2(-0.41, 0.91));
        vec2 d3 = normalize(vec2(0.23, -0.97));
        vec2 d4 = normalize(vec2(-0.83, -0.55));
        float h1 = sin(dot(p, d1) * 0.062 + t * 1.22) * 0.66;
        float h2 = sin(dot(p, d2) * 0.113 + t * 1.67) * 0.31;
        float h3 = sin(dot(p, d3) * 0.227 - t * 2.11) * 0.16;
        float h4 = sin(dot(p, d4) * 0.481 + t * 2.83) * 0.08;
        float dx = cos(dot(p, d1) * 0.062 + t * 1.22) * 0.062 * d1.x * 0.66
                 + cos(dot(p, d2) * 0.113 + t * 1.67) * 0.113 * d2.x * 0.31
                 + cos(dot(p, d3) * 0.227 - t * 2.11) * 0.227 * d3.x * 0.16
                 + cos(dot(p, d4) * 0.481 + t * 2.83) * 0.481 * d4.x * 0.08;
        float dz = cos(dot(p, d1) * 0.062 + t * 1.22) * 0.062 * d1.y * 0.66
                 + cos(dot(p, d2) * 0.113 + t * 1.67) * 0.113 * d2.y * 0.31
                 + cos(dot(p, d3) * 0.227 - t * 2.11) * 0.227 * d3.y * 0.16
                 + cos(dot(p, d4) * 0.481 + t * 2.83) * 0.481 * d4.y * 0.08;
        vec3 n = normalize(vec3(-dx * 8.5, 1.0, -dz * 8.5));
        return n;
      }

      void main() {
        vec3 viewDir = normalize(uCamera - vWorld);
        vec3 n = waveNormal(vWorld.xz, uTime);
        float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 4.6);
        vec3 reflected = reflect(-viewDir, n);
        float skyMix = smoothstep(-0.04, 0.72, reflected.y);
        vec3 reflection = mix(uHorizon, uSky, skyMix);
        vec3 water = mix(uDeep, uShallow, 0.24 + 0.24 * n.y);

        vec3 sunReflect = reflect(-uSunDirection, n);
        float spec = pow(max(dot(sunReflect, viewDir), 0.0), 420.0);
        float broadGlint = pow(max(dot(sunReflect, viewDir), 0.0), 34.0) * 0.18;

        vec3 color = mix(water, reflection, clamp(fresnel * 1.42, 0.0, 0.9));
        color += vec3(1.0, 0.72, 0.42) * (spec * 3.1 + broadGlint);
        color += vec3(0.45, 0.7, 0.76) * pow(n.y, 8.0) * 0.025;

        float distanceToCamera = length(uCamera - vWorld);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * distanceToCamera * distanceToCamera);
        color = mix(color, uFog, clamp(fog, 0.0, 1.0));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;
  mesh.name = 'ocean';
  mesh.receiveShadow = true;
  return mesh;
}

function createCloudTexture(seed) {
  const random = seededRandom(seed);
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 22; i++) {
    const x = 50 + random() * 156;
    const y = 82 + random() * 92;
    const radius = 22 + random() * 58;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
    const brightness = 0.78 + random() * 0.22;
    gradient.addColorStop(0, `rgba(255,255,255,${0.36 * brightness})`);
    gradient.addColorStop(0.45, `rgba(254,252,246,${0.2 * brightness})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = SRGB;
  return texture;
}

function createClouds(quality) {
  const group = new THREE.Group();
  group.name = 'clouds';
  const textures = [createCloudTexture(17), createCloudTexture(46), createCloudTexture(93)];
  const materials = textures.map((map, index) => new THREE.SpriteMaterial({
    map,
    color: index === 1 ? 0xffe9d1 : 0xfff8ec,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: true,
  }));
  const random = seededRandom(8213);
  const puffs = [];

  const clusterCount = quality.cloudClusters;
  for (let c = 0; c < clusterCount; c++) {
    const angle = random() * Math.PI * 2;
    const radius = 3800 + random() * 13800;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius - 1200;
    const cy = 1250 + random() * 1200;
    const spread = 380 + random() * 520;
    const count = quality.minPuffs + Math.floor(random() * quality.puffRange);
    for (let p = 0; p < count; p++) {
      const sprite = new THREE.Sprite(materials[Math.floor(random() * materials.length)]);
      const px = cx + (random() - 0.5) * spread * 2.2;
      const py = cy + (random() - 0.5) * spread * 0.72;
      const pz = cz + (random() - 0.5) * spread * 1.7;
      const size = spread * (0.62 + random() * 0.62);
      sprite.position.set(px, py, pz);
      sprite.scale.set(size, size * (0.55 + random() * 0.18), 1);
      sprite.material.opacity = 0.2 + random() * 0.2;
      sprite.userData.speed = 2 + random() * 4;
      group.add(sprite);
      puffs.push(sprite);
    }
  }

  for (let i = 0; i < quality.highClouds; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 9000 + random() * 21000;
    const sprite = new THREE.Sprite(materials[Math.floor(random() * materials.length)]);
    sprite.position.set(Math.cos(angle) * radius, 3100 + random() * 2300, Math.sin(angle) * radius - 3000);
    const size = 950 + random() * 1900;
    sprite.scale.set(size, size * (0.28 + random() * 0.14), 1);
    sprite.material.opacity = 0.055 + random() * 0.08;
    group.add(sprite);
  }
  return { group, puffs };
}

function createGate(position, rotationY) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.TorusGeometry(125, 2.2, 8, 96),
    new THREE.MeshStandardMaterial({
      color: 0x0a3238,
      emissive: 0x4ce8ff,
      emissiveIntensity: 1.9,
      metalness: 0.4,
      roughness: 0.32,
      toneMapped: false,
    })
  );
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(125, 7, 8, 96),
    new THREE.MeshBasicMaterial({
      color: 0x5cecff,
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  const ticks = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 16, 1.5),
      new THREE.MeshBasicMaterial({ color: 0x95f7ff, toneMapped: false })
    );
    tick.position.set(Math.cos(angle) * 133, Math.sin(angle) * 133, 0);
    tick.rotation.z = angle;
    ticks.add(tick);
  }
  group.add(core, halo, ticks);
  group.position.copy(position);
  group.rotation.y = rotationY;
  group.userData = { core, halo, ticks, passed: false };
  return group;
}

export function createWorld(scene, renderer, camera, quality = {}) {
  const settings = {
    terrainSegments: 264,
    cloudClusters: 18,
    minPuffs: 7,
    puffRange: 5,
    highClouds: 32,
    trees: 900,
    ...quality,
  };
  const sunDirection = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - 16.5),
    THREE.MathUtils.degToRad(292)
  );

  const sky = new Sky();
  sky.scale.setScalar(500000);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 7.8;
  skyUniforms.rayleigh.value = 1.12;
  skyUniforms.mieCoefficient.value = 0.0055;
  skyUniforms.mieDirectionalG.value = 0.82;
  skyUniforms.sunPosition.value.copy(sunDirection);
  scene.add(sky);

  scene.fog = new THREE.FogExp2(0xb7ced8, 0.000038);
  scene.environment = makeEnvironment(renderer, sunDirection);
  scene.environmentIntensity = 0.8;

  const sunGlow = createSunGlow(sunDirection);
  scene.add(sunGlow);

  const hemi = new THREE.HemisphereLight(0xa9cce8, 0x3b3b2f, 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd7a6, 3.25);
  sun.position.copy(sunDirection).multiplyScalar(700);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 980;
  sun.shadow.camera.left = -72;
  sun.shadow.camera.right = 72;
  sun.shadow.camera.top = 72;
  sun.shadow.camera.bottom = -72;
  sun.shadow.bias = -0.00016;
  sun.shadow.normalBias = 0.045;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x81b5d9, 0.62);
  fill.position.set(-sunDirection.x, 0.4, -sunDirection.z).multiplyScalar(500);
  scene.add(fill);

  const terrain = createTerrain(settings.terrainSegments);
  scene.add(terrain);

  const ocean = createOcean(sunDirection);
  scene.add(ocean);

  const { group: clouds, puffs } = createClouds(settings);
  scene.add(clouds);

  const gateData = [
    new THREE.Vector3(-80, 1680, 2700),
    new THREE.Vector3(1800, 1840, -900),
    new THREE.Vector3(-1200, 2260, -5100),
    new THREE.Vector3(-4800, 1760, -8800),
    new THREE.Vector3(-8200, 2180, -3900),
  ];
  const gates = gateData.map((position, index) => {
    const next = gateData[(index + 1) % gateData.length];
    const heading = Math.atan2(next.x - position.x, next.z - position.z);
    const gate = createGate(position, heading);
    scene.add(gate);
    return gate;
  });

  {
    const random = seededRandom(4412);
    const geometry = new THREE.ConeGeometry(4.1, 18, 5);
    const material = new THREE.MeshStandardMaterial({ color: 0x1d3829, roughness: 1, flatShading: true });
    const count = settings.trees;
    const trees = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    let placed = 0;
    for (let attempts = 0; attempts < 9000 && placed < count; attempts++) {
      const x = (random() - 0.5) * 16500;
      const z = (random() - 0.5) * 19000 - 2500;
      const h = terrainHeight(x, z);
      if (h < 90 || h > 740) continue;
      const normalY = (terrainHeight(x + 8, z) - terrainHeight(x - 8, z)) / 16;
      if (Math.abs(normalY) > 0.52) continue;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
      const s = 0.55 + random() * 1.2;
      scale.set(s, s * (0.8 + random() * 0.5), s);
      matrix.compose(new THREE.Vector3(x, h, z), quaternion, scale);
      trees.setMatrixAt(placed++, matrix);
    }
    trees.count = placed;
    trees.instanceMatrix.needsUpdate = true;
    trees.castShadow = true;
    trees.receiveShadow = true;
    scene.add(trees);
  }

  camera.far = 80000;
  camera.updateProjectionMatrix();

  let elapsed = 0;
  return {
    sunDirection,
    sun,
    terrain,
    ocean,
    clouds,
    puffs,
    gates,
    sky,
    sunGlow,
    get terrainHeight() { return terrainHeight; },
    update(dt, aircraftPosition, cameraPosition) {
      elapsed += dt;
      ocean.material.uniforms.uTime.value = elapsed;
      ocean.material.uniforms.uCamera.value.copy(cameraPosition);
      for (const puff of puffs) {
        puff.position.x += puff.userData.speed * dt;
        if (puff.position.x > 26000) puff.position.x = -26000;
      }
      for (const gate of gates) {
        const pulse = 1 + Math.sin(elapsed * 2.1 + gate.position.x * 0.001) * 0.03;
        gate.userData.halo.scale.setScalar(pulse);
        gate.userData.ticks.rotation.z += dt * 0.14;
      }
      sun.target.position.copy(aircraftPosition);
      sun.position.copy(aircraftPosition).addScaledVector(sunDirection, 520);
      sun.target.updateMatrixWorld();
      sky.position.copy(cameraPosition);
      sunGlow.position.copy(cameraPosition).addScaledVector(sunDirection, 53000);
    },
  };
}
