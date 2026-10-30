import * as THREE from 'three';

const TAU = Math.PI * 2;
const wrapDegrees = (value) => ((value % 360) + 360) % 360;

export function createHUD(flight, gates) {
  const canvas = document.getElementById('hud');
  const ctx = canvas.getContext('2d');
  const speedValue = document.getElementById('speedValue');
  const altValue = document.getElementById('altValue');
  const machValue = document.getElementById('machValue');
  const vsValue = document.getElementById('vsValue');
  const status = document.getElementById('flightStatus');
  const waypointName = document.getElementById('waypointName');
  const waypointDistance = document.getElementById('waypointDistance');
  const waypointProgress = document.getElementById('waypointProgress');
  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = false;
  let domTimer = 0;
  let currentGate = 0;
  let time = 0;
  const projected = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function setActive(value) {
    active = value;
  }

  function formatNumber(value, digits = 0) {
    return Math.round(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function updateDOM(dt) {
    domTimer += dt;
    if (domTimer < 0.08) return;
    domTimer = 0;
    speedValue.textContent = formatNumber(flight.speed * 3.6);
    altValue.textContent = formatNumber(Math.max(0, flight.position.y));
    machValue.textContent = flight.mach.toFixed(2);
    const vs = flight.verticalSpeed;
    vsValue.textContent = `${vs >= 0 ? '+' : ''}${(vs * 3.6).toFixed(1)}`;
    if (flight.stall) {
      status.textContent = 'STALL';
      status.classList.add('visible');
    } else if (flight.groundClearance < 90) {
      status.textContent = 'TERRAIN';
      status.classList.add('visible');
    } else if (flight.gLoad > 6) {
      status.textContent = 'OVER G';
      status.classList.add('visible');
    } else {
      status.classList.remove('visible');
    }
    const gate = gates[currentGate];
    if (gate) {
      const distance = flight.position.distanceTo(gate.position);
      waypointDistance.textContent = distance > 1000 ? `${(distance / 1000).toFixed(1)} KM` : `${Math.round(distance)} M`;
      waypointName.textContent = `GATE ${String(currentGate + 1).padStart(2, '0')}`;
      waypointProgress.style.width = `${Math.max(4, (1 - Math.min(distance / 6000, 1)) * 100)}%`;
    }
  }

  function drawHeadingTape(cx, y, scale) {
    const pxPerDegree = 3.1;
    const halfWidth = Math.min(180, width * 0.28);
    const current = flight.heading;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - halfWidth, y - 24, halfWidth * 2, 54);
    ctx.clip();

    ctx.strokeStyle = 'rgba(213, 247, 250, 0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - halfWidth, y);
    ctx.lineTo(cx + halfWidth, y);
    ctx.stroke();

    const start = Math.floor((current - halfWidth / pxPerDegree) / 5) * 5;
    const end = current + halfWidth / pxPerDegree;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let angle = start; angle <= end; angle += 5) {
      let delta = angle - current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const x = cx + delta * pxPerDegree;
      const normalized = wrapDegrees(angle);
      const major = normalized % 30 === 0;
      ctx.strokeStyle = major ? 'rgba(220,251,253,.67)' : 'rgba(220,251,253,.32)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - (major ? 8 : 5));
      ctx.stroke();
      if (major) {
        const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[normalized];
        ctx.fillStyle = cardinal ? 'rgba(255,197,122,.88)' : 'rgba(221,248,251,.55)';
        ctx.font = `${cardinal ? 10 : 8}px "Manrope", sans-serif`;
        ctx.fillText(cardinal || String(normalized).padStart(3, '0'), x, y - 22);
      }
    }
    ctx.restore();

    ctx.fillStyle = '#ffc170';
    ctx.beginPath();
    ctx.moveTo(cx, y + 1);
    ctx.lineTo(cx - 5, y + 8);
    ctx.lineTo(cx + 5, y + 8);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,197,122,.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 21, y + 11, 42, 16);
    ctx.fillStyle = 'rgba(255,225,187,.96)';
    ctx.font = '600 10px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round(current)).padStart(3, '0'), cx, y + 19.5);
    ctx.fillStyle = 'rgba(217,247,251,.38)';
    ctx.font = '600 6px "Manrope", sans-serif';
    ctx.fillText('HDG', cx - 33, y + 19.5);
    ctx.textAlign = 'left';
  }

  function drawPitchLadder(cx, cy, pitch, bank, pitchScale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-THREE.MathUtils.degToRad(bank));
    const fontSize = width < 700 ? 7 : 8;
    ctx.font = `600 ${fontSize}px "Manrope", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    for (let angle = -80; angle <= 80; angle += 10) {
      if (angle === 0) continue;
      const y = (pitch - angle) * pitchScale;
      if (Math.abs(y) > height * 0.37) continue;
      const positive = angle > 0;
      const length = Math.abs(angle) === 10 || Math.abs(angle) === 20 ? 52 : 38;
      ctx.strokeStyle = positive ? 'rgba(196, 243, 244, 0.55)' : 'rgba(196, 243, 244, 0.4)';
      ctx.setLineDash(positive ? [] : [4, 5]);
      ctx.beginPath();
      ctx.moveTo(-length, y);
      ctx.lineTo(-18, y);
      ctx.moveTo(18, y);
      ctx.lineTo(length, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = positive ? 'rgba(202, 249, 250, 0.58)' : 'rgba(202, 249, 250, 0.42)';
      ctx.fillText(String(Math.abs(angle)), length + 5, y);
      if (positive) {
        ctx.beginPath();
        ctx.moveTo(-length, y - 3);
        ctx.lineTo(-length + 2, y);
        ctx.lineTo(-length, y + 3);
        ctx.moveTo(length, y - 3);
        ctx.lineTo(length - 2, y);
        ctx.lineTo(length, y + 3);
        ctx.stroke();
      }
    }

    const horizonY = pitch * pitchScale;
    if (Math.abs(horizonY) < height * 0.42) {
      ctx.strokeStyle = 'rgba(234, 251, 250, 0.66)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-Math.min(235, width * 0.3), horizonY);
      ctx.lineTo(-49, horizonY);
      ctx.moveTo(49, horizonY);
      ctx.lineTo(Math.min(235, width * 0.3), horizonY);
      ctx.stroke();
      ctx.fillStyle = 'rgba(234, 251, 250, 0.52)';
      ctx.beginPath();
      ctx.moveTo(-54, horizonY - 4);
      ctx.lineTo(-47, horizonY);
      ctx.lineTo(-54, horizonY + 4);
      ctx.moveTo(54, horizonY - 4);
      ctx.lineTo(47, horizonY);
      ctx.lineTo(54, horizonY + 4);
      ctx.stroke();
    }

    const rollRadius = Math.min(128, width * 0.18);
    ctx.strokeStyle = 'rgba(218, 249, 250, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, rollRadius, THREE.MathUtils.degToRad(-120), THREE.MathUtils.degToRad(-60));
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 190, 104, 0.85)';
    const bankAngle = THREE.MathUtils.degToRad(-bank) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(bankAngle) * rollRadius, Math.sin(bankAngle) * rollRadius);
    ctx.lineTo(Math.cos(bankAngle - 0.018) * (rollRadius + 6), Math.sin(bankAngle - 0.018) * (rollRadius + 6));
    ctx.lineTo(Math.cos(bankAngle + 0.018) * (rollRadius + 6), Math.sin(bankAngle + 0.018) * (rollRadius + 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawReticle(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(235, 255, 252, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-37, 0);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-10, 5);
    ctx.lineTo(-4, 5);
    ctx.moveTo(37, 0);
    ctx.lineTo(16, 0);
    ctx.lineTo(10, 5);
    ctx.lineTo(4, 5);
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 3);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 190, 104, 0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, 1.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(218, 249, 250, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawFPM(camera) {
    if (flight.speed < 35) return;
    const x = flight.velocityDir.x;
    const y = flight.velocityDir.y;
    const z = flight.velocityDir.z;
    const point = new THREE.Vector3(
      camera.position.x + x * 2500,
      camera.position.y + y * 2500,
      camera.position.z + z * 2500
    ).project(camera);
    if (point.z < -1 || point.z > 1) return;
    const px = (point.x * 0.5 + 0.5) * width;
    const py = (-point.y * 0.5 + 0.5) * height;
    if (px < 30 || px > width - 30 || py < 110 || py > height - 110) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(170, 255, 221, 0.58)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, TAU);
    ctx.moveTo(px - 14, py);
    ctx.lineTo(px - 5, py);
    ctx.moveTo(px + 5, py);
    ctx.lineTo(px + 14, py);
    ctx.moveTo(px, py - 9);
    ctx.lineTo(px, py - 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawWaypoint(camera) {
    const gate = gates[currentGate];
    if (!gate) return;
    projected.copy(gate.position).project(camera);
    if (projected.z < -1 || projected.z > 1) return;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    if (x < 20 || x > width - 20 || y < 70 || y > height - 130) return;
    const distance = flight.position.distanceTo(gate.position);
    const size = clampNumber(11 - distance / 2200, 5, 11);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = 'rgba(105, 245, 255, 0.86)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
    ctx.fillStyle = 'rgba(151, 249, 255, 0.75)';
    ctx.font = '600 7px "Manrope", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(distance > 1000 ? `${(distance / 1000).toFixed(1)} KM` : `${Math.round(distance)} M`, x, y + size + 13);
    ctx.textAlign = 'left';
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function draw(dt, camera) {
    time += dt;
    if (!active) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    cameraPosition.copy(camera.position);

    const cx = width / 2;
    const cy = height * 0.485;
    const pitchScale = clampNumber(height / 150, 3.3, 6.2);

    drawPitchLadder(cx, cy, flight.pitch, flight.bank, pitchScale);
    drawReticle(cx, cy);
    drawFPM(camera);
    drawWaypoint(camera);
    drawHeadingTape(cx, width < 700 ? 78 : 92, 1);

    ctx.fillStyle = 'rgba(214, 247, 250, 0.28)';
    ctx.font = '600 6.5px "Manrope", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`G ${flight.gLoad.toFixed(1)}`, 17, height - 17);
    ctx.textAlign = 'right';
    ctx.fillText(`THR ${Math.round(flight.throttle * 100)}%`, width - 17, height - 17);

    if (flight.stall && Math.sin(time * 10) > -0.2) {
      ctx.fillStyle = 'rgba(255, 167, 73, 0.92)';
      ctx.font = '600 11px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STALL', cx, cy + 78);
      ctx.textAlign = 'left';
    }

    updateDOM(dt);
  }

  function nextGate() {
    currentGate = (currentGate + 1) % gates.length;
  }

  function setGate(index) {
    currentGate = index % gates.length;
  }

  function getCurrentGate() {
    return currentGate;
  }

  resize();
  return { resize, draw, setActive, nextGate, getCurrentGate, setGate };
}
