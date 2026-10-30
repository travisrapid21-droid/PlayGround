import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './world.js';
import { createAircraft } from './aircraft.js';
import { FlightModel } from './flight.js';
import { createHUD } from './hud.js';
import { createAudioEngine } from './audio.js';
import { createVaporTrails } from './effects.js';
import { clamp } from './noise.js';
import './style.css';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
const gl = renderer.getContext();
const rendererInfoExtension = gl.getExtension('WEBGL_debug_renderer_info');
const rendererName = rendererInfoExtension
  ? gl.getParameter(rendererInfoExtension.UNMASKED_RENDERER_WEBGL)
  : renderer.getContext().getParameter(gl.RENDERER);
const softwareRenderer = /swiftshader|llvmpipe|software/i.test(String(rendererName));
const quality = softwareRenderer
  ? { terrainSegments: 180, cloudClusters: 9, minPuffs: 5, puffRange: 3, highClouds: 10, trees: 350 }
  : { terrainSegments: 264, cloudClusters: 18, minPuffs: 7, puffRange: 5, highClouds: 32, trees: 900 };

function effectivePixelRatio() {
  const width = window.innerWidth;
  if (softwareRenderer) return width > 900 ? 0.78 : 1;
  return Math.min(window.devicePixelRatio || 1, width < 800 ? 1.5 : 1.65);
}

renderer.setPixelRatio(effectivePixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = !softwareRenderer;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 80000);
camera.position.set(13, 6, 18);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
let bloom = null;
if (!softwareRenderer) {
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.16, 0.45, 1.24);
  composer.addPass(bloom);
}
composer.addPass(new OutputPass());

const world = createWorld(scene, renderer, camera, quality);
const flight = new FlightModel();
const aircraft = createAircraft();
aircraft.root.position.copy(flight.position);
aircraft.root.quaternion.copy(flight.quaternion);
scene.add(aircraft.root);
const vapor = createVaporTrails(aircraft.root);
const hud = createHUD(flight, world.gates);
const audio = createAudioEngine();

const intro = document.getElementById('intro');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderCopy = document.getElementById('loaderCopy');
const startButton = document.getElementById('startButton');
const tiltButton = document.getElementById('tiltButton');
const cameraButton = document.getElementById('cameraButton');
const pauseButton = document.getElementById('pauseButton');
const soundButton = document.getElementById('soundButton');
const throttleFill = document.getElementById('throttleFill');
const throttleKnob = document.getElementById('throttleKnob');
const throttleReadout = document.getElementById('throttleReadout');
const throttleTrack = document.getElementById('throttleTrack');
const throttleWrap = document.getElementById('throttleWrap');
const stickWrap = document.getElementById('stickWrap');
const stickKnob = document.getElementById('stickKnob');
const toast = document.getElementById('toast');
const flightStatus = document.getElementById('flightStatus');

let lastFrameTime = performance.now();
const state = {
  started: false,
  paused: false,
  menuTime: 0,
  elapsed: 0,
  cameraMode: 'chase',
  transition: 0,
  transitionFrom: new THREE.Vector3(),
  transitionLook: new THREE.Vector3(),
  cameraLook: new THREE.Vector3(),
  desiredLook: new THREE.Vector3(),
  cameraUp: new THREE.Vector3(0, 1, 0),
  tiltEnabled: false,
  tiltPitch: 0,
  tiltRoll: 0,
  tiltBaseline: null,
  joystick: { x: 0, y: 0 },
  yawTouch: 0,
  stickPointer: null,
  throttlePointer: null,
  toastTimer: 0,
  pausedToast: false,
  gatesCleared: 0,
  lastCrash: 0,
  impact: false,
  audioMuted: false,
  fpsFrames: 0,
  fpsTime: 0,
  fps: 60,
};

const impactFlash = document.createElement('div');
impactFlash.className = 'impact-flash';
document.getElementById('app').appendChild(impactFlash);

const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();

function showToast(message, duration = 2600) {
  toast.textContent = message;
  toast.classList.add('show');
  state.toastTimer = duration;
}

function resetGates() {
  state.gatesCleared = 0;
  hud.setGate(0);
  for (const gate of world.gates) {
    gate.userData.core.material.emissiveIntensity = 1.9;
    gate.userData.halo.material.opacity = 0.075;
    gate.userData.ticks.visible = true;
    gate.userData.passed = false;
  }
}

function beginFlight() {
  if (state.started) return;
  state.started = true;
  flight.reset();
  resetGates();
  intro.classList.add('hidden');
  document.getElementById('app').classList.add('flying');
  hud.setActive(true);
  state.transition = 1;
  snapCameraToFlight();
  lastFrameTime = performance.now();
  renderer.setAnimationLoop(animate);
  audio.start();
  audio.setMuted(state.audioMuted);
  showToast('FLIGHT SYSTEMS ONLINE · THROTTLE 72%', 3200);
  if (navigator.vibrate) navigator.vibrate(18);
}

function snapCameraToFlight() {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(flight.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(flight.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(flight.quaternion);
  camera.position.copy(flight.position)
    .addScaledVector(right, 3.55)
    .addScaledVector(up, 3.45)
    .addScaledVector(forward, -23.5);
  state.cameraLook.copy(flight.position)
    .addScaledVector(forward, 20)
    .addScaledVector(up, 1.15)
    .addScaledVector(right, 0.4);
  camera.up.set(0, 1, 0);
  camera.lookAt(state.cameraLook);
  camera.fov = 54.5;
  camera.updateProjectionMatrix();
}

function togglePause() {
  if (!state.started) return;
  state.paused = !state.paused;
  pauseButton.classList.toggle('active', state.paused);
  if (state.paused) {
    showToast('SIMULATION PAUSED · PRESS P TO RESUME', 0);
    state.pausedToast = true;
  } else {
    toast.classList.remove('show');
    state.pausedToast = false;
  }
}

function resetFlight() {
  flight.reset();
  aircraft.root.visible = true;
  state.impact = false;
  impactFlash.classList.remove('show');
  hud.setActive(true);
  showToast('AIRFRAME RESET · FLIGHT RESTORED');
  if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
}

function toggleCamera() {
  if (!state.started) return;
  state.cameraMode = state.cameraMode === 'chase' ? 'cockpit' : 'chase';
  aircraft.setCockpit(state.cameraMode === 'cockpit');
  cameraButton.classList.toggle('active', state.cameraMode === 'cockpit');
  cameraButton.querySelector('.button-label').textContent = state.cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE';
  showToast(state.cameraMode === 'cockpit' ? 'CAMERA · COCKPIT' : 'CAMERA · CHASE');
}

function toggleSound() {
  state.audioMuted = audio.toggleMuted();
  soundButton.classList.toggle('active', state.audioMuted);
  soundButton.setAttribute('aria-label', state.audioMuted ? 'Unmute sound' : 'Mute sound');
  showToast(state.audioMuted ? 'AUDIO MUTED' : 'AUDIO ENABLED');
}

async function enableTilt() {
  if (!state.started) {
    showToast('START A FLIGHT FIRST');
    return;
  }
  if (state.tiltEnabled) {
    state.tiltEnabled = false;
    state.tiltPitch = 0;
    state.tiltRoll = 0;
    tiltButton.classList.remove('active');
    tiltButton.querySelector('.button-label').textContent = 'TILT';
    showToast('MOTION TILT DISABLED');
    return;
  }
  if (!window.DeviceMotionEvent) {
    showToast('MOTION SENSOR NOT AVAILABLE');
    return;
  }
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') {
        showToast('MOTION ACCESS DENIED · CHECK SETTINGS');
        return;
      }
    }
    window.addEventListener('devicemotion', handleMotion, { passive: true });
    state.tiltEnabled = true;
    state.tiltBaseline = null;
    tiltButton.classList.add('active');
    tiltButton.querySelector('.button-label').textContent = 'TILT ON';
    tiltButton.setAttribute('aria-label', 'Disable motion tilt');
    showToast('MOTION TILT ENABLED · HOLD DEVICE LEVEL TO CALIBRATE', 3800);
  } catch (error) {
    showToast('MOTION ACCESS UNAVAILABLE');
    console.warn(error);
  }
}

function handleMotion(event) {
  if (!state.tiltEnabled) return;
  const beta = event.beta || 0;
  const gamma = event.gamma || 0;
  if (!state.tiltBaseline) {
    state.tiltBaseline = { beta, gamma };
    return;
  }
  const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  let deltaPitch = 0;
  let deltaRoll = 0;
  if (screenAngle === 90) {
    deltaRoll = beta - state.tiltBaseline.beta;
    deltaPitch = -(gamma - state.tiltBaseline.gamma);
  } else if (screenAngle === 270) {
    deltaRoll = -(beta - state.tiltBaseline.beta);
    deltaPitch = gamma - state.tiltBaseline.gamma;
  } else if (screenAngle === 180) {
    deltaRoll = -(gamma - state.tiltBaseline.gamma);
    deltaPitch = -(beta - state.tiltBaseline.beta);
  } else {
    deltaRoll = gamma - state.tiltBaseline.gamma;
    deltaPitch = beta - state.tiltBaseline.beta;
  }
  state.tiltRoll = clamp(deltaRoll / 26, -1, 1) * 0.78;
  state.tiltPitch = clamp(deltaPitch / 26, -1, 1) * 0.78;
}

function setThrottleFromClientY(clientY) {
  const rect = throttleTrack.getBoundingClientRect();
  const value = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
  flight.setThrottle(value);
  updateThrottleUI(value);
}

function updateThrottleUI(value) {
  const percent = Math.round(value * 100);
  throttleFill.style.height = `${Math.max(2, value * 100)}%`;
  throttleKnob.style.bottom = `calc(${Math.max(0.5, value * 100)}% - 6px)`;
  throttleReadout.textContent = `${percent}%`;
}

throttleTrack.addEventListener('pointerdown', (event) => {
  if (!state.started) return;
  event.preventDefault();
  state.throttlePointer = event.pointerId;
  throttleTrack.setPointerCapture(event.pointerId);
  throttleWrap.classList.add('active');
  setThrottleFromClientY(event.clientY);
});
throttleTrack.addEventListener('pointermove', (event) => {
  if (state.throttlePointer !== event.pointerId) return;
  setThrottleFromClientY(event.clientY);
});
function endThrottle(event) {
  if (state.throttlePointer !== event.pointerId) return;
  state.throttlePointer = null;
  throttleWrap.classList.remove('active');
  if (throttleTrack.hasPointerCapture(event.pointerId)) throttleTrack.releasePointerCapture(event.pointerId);
}
throttleTrack.addEventListener('pointerup', endThrottle);
throttleTrack.addEventListener('pointercancel', endThrottle);

const stickRadius = 52;
function updateStick(clientX, clientY) {
  const rect = stickWrap.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const distance = Math.hypot(dx, dy);
  if (distance > stickRadius) {
    dx = (dx / distance) * stickRadius;
    dy = (dy / distance) * stickRadius;
  }
  const nx = dx / stickRadius;
  const ny = dy / stickRadius;
  state.joystick.x = nx;
  state.joystick.y = ny;
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}
stickWrap.addEventListener('pointerdown', (event) => {
  if (!state.started) return;
  event.preventDefault();
  state.stickPointer = event.pointerId;
  stickWrap.setPointerCapture(event.pointerId);
  stickWrap.classList.add('active');
  updateStick(event.clientX, event.clientY);
});
stickWrap.addEventListener('pointermove', (event) => {
  if (state.stickPointer !== event.pointerId) return;
  updateStick(event.clientX, event.clientY);
});
function endStick(event) {
  if (state.stickPointer !== event.pointerId) return;
  state.stickPointer = null;
  state.joystick.x = 0;
  state.joystick.y = 0;
  stickKnob.style.transform = 'translate(0px, 0px)';
  stickWrap.classList.remove('active');
  if (stickWrap.hasPointerCapture(event.pointerId)) stickWrap.releasePointerCapture(event.pointerId);
}
stickWrap.addEventListener('pointerup', endStick);
stickWrap.addEventListener('pointercancel', endStick);

function setupHoldButton(id, onDown, onUp) {
  const button = document.getElementById(id);
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    onDown();
  });
  const release = (event) => {
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    onUp();
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', (event) => {
    if (event.buttons === 0) onUp();
  });
}
setupHoldButton('yawLeft', () => { state.yawTouch = -1; }, () => { state.yawTouch = 0; });
setupHoldButton('yawRight', () => { state.yawTouch = 1; }, () => { state.yawTouch = 0; });

const keys = new Set();
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'r') {
    resetFlight();
    return;
  }
  if (key === 'c') {
    toggleCamera();
    return;
  }
  if (key === 'p' || key === ' ') {
    togglePause();
    return;
  }
  if (key === 'm') {
    toggleSound();
    return;
  }
  if (key === 't') {
    enableTilt();
    return;
  }
  keys.add(key);
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});
window.addEventListener('blur', () => keys.clear());

function getKeyboardInput(dt) {
  let pitch = 0;
  let roll = 0;
  let yaw = 0;
  if (keys.has('w') || keys.has('arrowup')) pitch += 1;
  if (keys.has('s') || keys.has('arrowdown')) pitch -= 1;
  if (keys.has('a') || keys.has('arrowleft')) roll -= 1;
  if (keys.has('d') || keys.has('arrowright')) roll += 1;
  if (keys.has('q')) yaw -= 1;
  if (keys.has('e')) yaw += 1;
  if (keys.has('shift')) flight.setThrottle(flight.throttle + 0.45 * dt);
  if (keys.has('control')) flight.setThrottle(flight.throttle - 0.45 * dt);
  return { pitch, roll, yaw };
}

function getInput(dt) {
  const keyboard = getKeyboardInput(dt);
  const pitch = clamp(keyboard.pitch + (-state.joystick.y) + state.tiltPitch, -1, 1);
  const roll = clamp(keyboard.roll + state.joystick.x + state.tiltRoll, -1, 1);
  const yaw = clamp(keyboard.yaw + state.yawTouch, -1, 1);
  return { pitch, roll, yaw, throttle: flight.throttle };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function computeCinematicCamera() {
  const t = state.menuTime;
  const forward = tempVector.set(0, 0, -1).applyQuaternion(flight.quaternion);
  const right = tempVector2.set(1, 0, 0).applyQuaternion(flight.quaternion);
  const offset = new THREE.Vector3()
    .addScaledVector(right, 15.5 + Math.sin(t * 0.2) * 1.2)
    .addScaledVector(forward, -28.5)
    .add(new THREE.Vector3(0, 6.8 + Math.sin(t * 0.34) * 0.3, 0));
  const position = flight.position.clone().add(offset);
  const look = flight.position.clone()
    .addScaledVector(right, -8.2)
    .add(new THREE.Vector3(0, 1.1, 0));
  return { position, look };
}

function updateCamera(dt) {
  if (!state.started) {
    const cinematic = computeCinematicCamera();
    camera.position.copy(cinematic.position);
    state.cameraLook.copy(cinematic.look);
    camera.up.set(0, 1, 0);
    camera.lookAt(state.cameraLook);
    camera.fov = 49;
    camera.updateProjectionMatrix();
    return;
  }

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(flight.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(flight.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(flight.quaternion);
  const shakeStrength = clamp((flight.speed - 180) / 500, 0, 0.09) + (flight.stall ? 0.08 : 0);
  const shake = new THREE.Vector3(
    Math.sin(state.elapsed * 12.1) * shakeStrength,
    Math.sin(state.elapsed * 9.7 + 1.3) * shakeStrength * 0.7,
    Math.sin(state.elapsed * 14.3 + 0.4) * shakeStrength * 0.5
  );

  let desiredPosition;
  let desiredLook;
  let desiredUp;
  let targetFov;

  if (state.cameraMode === 'cockpit') {
    desiredPosition = flight.position.clone()
      .addScaledVector(up, 1.43)
      .addScaledVector(forward, -3.0)
      .addScaledVector(right, 0.0);
    desiredLook = desiredPosition.clone().addScaledVector(forward, 55).addScaledVector(up, 0.25);
    desiredUp = up;
    targetFov = 66 + clamp((flight.speed - 180) * 0.018, 0, 6);
  } else {
    desiredPosition = flight.position.clone()
      .addScaledVector(right, 3.55)
      .addScaledVector(up, 3.45)
      .addScaledVector(forward, -23.5);
    desiredLook = flight.position.clone()
      .addScaledVector(forward, 20)
      .addScaledVector(up, 1.15)
      .addScaledVector(right, 0.4);
    desiredUp = new THREE.Vector3(0, 1, 0).lerp(up, 0.34).normalize();
    targetFov = 54.5 + clamp((flight.speed - 170) * 0.02, 0, 7);
  }

  desiredPosition.add(shake);
  const terrainClearance = world.terrainHeight(desiredPosition.x, desiredPosition.z) + 10;
  if (desiredPosition.y < terrainClearance) desiredPosition.y = terrainClearance;

  state.transition = Math.min(1, state.transition + dt / 0.78);
  const ease = easeOutCubic(state.transition);
  if (state.transition < 1) {
    camera.position.lerpVectors(state.transitionFrom, desiredPosition, ease);
    state.cameraLook.lerpVectors(state.transitionLook, desiredLook, ease);
  } else {
    const follow = 1 - Math.exp(-dt * (state.cameraMode === 'cockpit' ? 18 : 11));
    camera.position.lerp(desiredPosition, follow);
    state.cameraLook.lerp(desiredLook, 1 - Math.exp(-dt * 6.2));
  }
  state.cameraUp.lerp(desiredUp, 1 - Math.exp(-dt * 4));
  if (state.cameraMode === 'cockpit') {
    camera.quaternion.slerp(
      tempQuat.copy(flight.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.04)),
      1 - Math.exp(-dt * 8)
    );
  } else {
    camera.up.copy(state.cameraUp);
    camera.lookAt(state.cameraLook);
  }
  camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 2.5));
  camera.updateProjectionMatrix();
}

function checkGate() {
  const gateIndex = hud.getCurrentGate();
  const gate = world.gates[gateIndex];
  if (!gate || gate.userData.passed) return;
  const distance = flight.position.distanceTo(gate.position);
  if (distance < 135) {
    gate.userData.passed = true;
    gate.userData.core.material.emissiveIntensity = 0.2;
    gate.userData.halo.material.opacity = 0.015;
    gate.userData.ticks.visible = false;
    state.gatesCleared++;
    if (navigator.vibrate) navigator.vibrate([8, 35, 8]);
    if (state.gatesCleared >= world.gates.length) {
      showToast('COURSE COMPLETE · ALL WAYPOINTS CLEARED', 4200);
      setTimeout(() => {
        resetGates();
        showToast('COURSE RESET · GATE 01');
      }, 2600);
    } else {
      hud.nextGate();
      showToast(`WAYPOINT ${String(state.gatesCleared).padStart(2, '0')} CLEARED · NEXT GATE`, 2600);
    }
  }
}

function triggerCrash() {
  if (state.impact) return;
  state.impact = true;
  state.lastCrash = state.elapsed;
  aircraft.root.visible = false;
  impactFlash.classList.add('show');
  if (navigator.vibrate) navigator.vibrate([30, 50, 80]);
  showToast(`${flight.crashReason || 'IMPACT'} · AIRFRAME RESETTING`, 2400);
  setTimeout(() => {
    impactFlash.classList.remove('show');
  }, 500);
  setTimeout(() => {
    resetFlight();
  }, 2300);
}

function animate(now = performance.now()) {
  const dt = Math.min(Math.max((now - lastFrameTime) / 1000, 0.0001), 0.05);
  lastFrameTime = now;
  state.elapsed += dt;
  state.fpsFrames++;
  state.fpsTime += dt;
  if (state.fpsTime > 1) {
    state.fps = Math.round(state.fpsFrames / state.fpsTime);
    state.fpsFrames = 0;
    state.fpsTime = 0;
  }

  if (!state.started) {
    state.menuTime += dt;
  } else if (!state.paused && !flight.crashed) {
    flight.update(dt, getInput(dt));
    if (flight.crashed) triggerCrash();
    checkGate();
    if (bloom && state.fps < 34 && bloom.strength > 0.09) {
      bloom.strength = Math.max(0.09, bloom.strength - 0.01);
    }
  }

  if (state.paused) {
    audio.update(0.08, 0, 1);
  } else {
    audio.update(flight.throttle, flight.speed, flight.gLoad);
  }

  aircraft.root.position.copy(flight.position);
  aircraft.root.quaternion.copy(flight.quaternion);
  if (aircraft.root.visible) {
    aircraft.update(dt, flight.throttle, flight.speed);
  }
  updateCamera(dt);

  const trailStrength = clamp((flight.gLoad - 1.2) / 3.6, 0, 1) * 0.8 + (flight.stall ? 0.3 : 0);
  vapor.update(dt, flight, state.started && !state.paused ? trailStrength : 0);
  world.update(dt, flight.position, camera.position);
  hud.draw(dt, camera);

  if (state.toastTimer > 0) {
    state.toastTimer -= dt * 1000;
    if (state.toastTimer <= 0 && !state.pausedToast) toast.classList.remove('show');
  }

  if (softwareRenderer) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }
}

startButton.addEventListener('click', beginFlight);
pauseButton.addEventListener('click', togglePause);
cameraButton.addEventListener('click', toggleCamera);
soundButton.addEventListener('click', toggleSound);
tiltButton.addEventListener('click', enableTilt);

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(effectivePixelRatio());
  renderer.setSize(width, height);
  composer.setSize(width, height);
  hud.resize();
  if (!state.started) renderMenuFrame();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.started && !state.paused) togglePause();
});

window.addEventListener('beforeunload', () => {
  audio.setMuted(true);
});

updateThrottleUI(flight.throttle);
loaderFill.style.width = '100%';
loaderCopy.textContent = 'FLIGHT SYSTEMS READY';

function renderMenuFrame() {
  aircraft.root.position.copy(flight.position);
  aircraft.root.quaternion.copy(flight.quaternion);
  aircraft.update(0.016, flight.throttle, flight.speed);
  state.menuTime += 0.016;
  updateCamera(0.016);
  world.update(0.016, flight.position, camera.position);
  if (softwareRenderer) renderer.render(scene, camera);
  else composer.render();
}

renderMenuFrame();
setTimeout(() => {
  loader.classList.add('hidden');
}, 120);

window.__sim = { scene, camera, renderer, flight, aircraft, world, state, composer, bloom, softwareRenderer, quality, renderMenuFrame };
