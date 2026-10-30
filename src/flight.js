import * as THREE from 'three';
import { terrainHeight, clamp } from './noise.js';

const UP = new THREE.Vector3(0, 1, 0);
const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

export class FlightModel {
  constructor() {
    this.position = new THREE.Vector3(0, 1960, 7600);
    this.quaternion = new THREE.Quaternion();
    this.velocityDir = new THREE.Vector3(0, 0, -1);
    this.speed = 206;
    this.throttle = 0.72;
    this.controls = { pitch: 0, roll: 0, yaw: 0 };
    this.targetControls = { pitch: 0, roll: 0, yaw: 0 };
    this.gLoad = 1;
    this.angleOfAttack = 0;
    this.stall = false;
    this.crashed = false;
    this.groundClearance = 999;
    this.tempForward = new THREE.Vector3();
    this.tempUp = new THREE.Vector3();
    this.tempRight = new THREE.Vector3();
    this.tempQuat = new THREE.Quaternion();
    this.lastVelocityDir = new THREE.Vector3(0, 0, -1);
    this.mach = 0;
    this.verticalSpeed = 0;
    this.heading = 0;
    this.pitch = 0;
    this.bank = 0;
    this.flightTime = 0;
    this.crashTime = 0;
    this.reset();
  }

  reset(airborne = true) {
    this.position.set(0, 1960, 7600);
    this.quaternion.identity();
    const initialBank = -0.075;
    this.quaternion.setFromAxisAngle(AXIS_Z, initialBank);
    this.speed = 206;
    this.throttle = Math.max(0.66, this.throttle);
    this.velocityDir.set(0, 0, -1).applyQuaternion(this.quaternion);
    this.lastVelocityDir.copy(this.velocityDir);
    this.crashed = false;
    this.crashTime = 0;
    this.stall = false;
    this.flightTime = 0;
    this.controls.pitch = this.controls.roll = this.controls.yaw = 0;
    this.targetControls.pitch = this.targetControls.roll = this.targetControls.yaw = 0;
    this.gLoad = 1;
  }

  setInput(pitch, roll, yaw) {
    this.targetControls.pitch = clamp(pitch, -1, 1);
    this.targetControls.roll = clamp(roll, -1, 1);
    this.targetControls.yaw = clamp(yaw, -1, 1);
  }

  setThrottle(value) {
    this.throttle = clamp(value, 0, 1);
  }

  readOrientation() {
    const forward = this.tempForward.copy(LOCAL_FORWARD).applyQuaternion(this.quaternion);
    const up = this.tempUp.copy(LOCAL_UP).applyQuaternion(this.quaternion);
    const right = this.tempRight.copy(LOCAL_RIGHT).applyQuaternion(this.quaternion);
    this.pitch = THREE.MathUtils.radToDeg(Math.asin(clamp(forward.y, -1, 1)));
    this.bank = THREE.MathUtils.radToDeg(Math.atan2(up.x, up.y));
    this.heading = (THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z)) + 360) % 360;
    return { forward, up, right };
  }

  update(dt, input) {
    if (this.crashed) {
      this.crashTime += dt;
      return;
    }
    dt = Math.min(dt, 0.05);
    this.flightTime += dt;

    if (input) {
      this.setInput(input.pitch, input.roll, input.yaw);
      if (input.throttle !== undefined) this.setThrottle(input.throttle);
    }

    const responsiveness = 1 - Math.exp(-7.5 * dt);
    this.controls.pitch += (this.targetControls.pitch - this.controls.pitch) * responsiveness;
    this.controls.roll += (this.targetControls.roll - this.controls.roll) * responsiveness;
    this.controls.yaw += (this.targetControls.yaw - this.controls.yaw) * responsiveness;

    const { forward, up } = this.readOrientation();
    const speedRatio = clamp(this.speed / 120, 0.2, 2.2);
    const controlAuthority = clamp(this.speed / 155, 0.04, 1.15);

    const pitchRate = 1.08 * speedRatio * controlAuthority * this.controls.pitch;
    const rollRate = 2.05 * controlAuthority * this.controls.roll;
    const yawRate = 0.48 * controlAuthority * this.controls.yaw;

    this.quaternion.multiply(this.tempQuat.setFromAxisAngle(AXIS_X, pitchRate * dt));
    this.quaternion.multiply(this.tempQuat.setFromAxisAngle(AXIS_Z, -rollRate * dt));
    this.quaternion.multiply(this.tempQuat.setFromAxisAngle(AXIS_Y, -yawRate * dt));

    this.readOrientation();
    const bankRad = THREE.MathUtils.degToRad(this.bank);
    const liftFactor = clamp(this.speed / 78, 0, 1);
    const coordinatedTurn = -Math.tan(clamp(bankRad, -1.36, 1.36)) * 9.81 / Math.max(this.speed, 55) * liftFactor;
    this.quaternion.multiply(this.tempQuat.setFromAxisAngle(AXIS_Y, coordinatedTurn * dt));

    this.readOrientation();
    this.angleOfAttack = THREE.MathUtils.radToDeg(Math.asin(clamp(-forward.y + Math.sin(bankRad) * 0.1, -1, 1))) * 0.42;

    const thrustAccel = this.throttle * 34.5;
    const dragAccel = 0.0004 * this.speed * this.speed + 0.18;
    const gravityAlongPath = 9.81 * forward.y * 0.9;
    const brake = this.throttle < 0.08 ? 1.5 : 0;
    this.speed += (thrustAccel - dragAccel - gravityAlongPath - brake) * dt;
    if (this.speed < 46) this.speed += (46 - this.speed) * dt * 0.35;
    this.speed = clamp(this.speed, 42, 370);
    this.mach = this.speed / 340;

    this.stall = this.speed < 83 && this.controls.pitch > -0.1;
    const sink = (1 - clamp(this.speed / 84, 0, 1)) * 18;
    const targetDir = this.tempForward.copy(LOCAL_FORWARD).applyQuaternion(this.quaternion);
    const align = 1 - Math.exp(-2.25 * dt);
    this.velocityDir.lerp(targetDir, align).normalize();

    const delta = this.velocityDir.clone().sub(this.lastVelocityDir);
    const lateralG = delta.length() / Math.max(dt, 0.001) * this.speed / 9.81;
    this.gLoad += (clamp(1 + lateralG, 0.1, 9) - this.gLoad) * (1 - Math.exp(-3 * dt));
    this.lastVelocityDir.copy(this.velocityDir);

    this.verticalSpeed = this.velocityDir.y * this.speed - sink;
    this.position.addScaledVector(this.velocityDir, this.speed * dt);
    this.position.y -= sink * dt;

    if (this.position.y < 4) {
      this.crash('WATER IMPACT');
      return;
    }
    if (this.position.y > 7500) {
      this.position.y = 7500;
      this.quaternion.multiply(this.tempQuat.setFromAxisAngle(AXIS_X, -0.22 * dt));
      this.speed = Math.min(this.speed, 300);
    }
    this.groundClearance = this.position.y - terrainHeight(this.position.x, this.position.z);
    if (this.groundClearance < 9) {
      this.crash('TERRAIN IMPACT');
    }
  }

  crash(reason) {
    if (this.crashed) return;
    this.crashed = true;
    this.crashTime = 0;
    this.crashReason = reason;
    this.speed *= 0.25;
  }

  crashPosition() {
    return this.position;
  }

  getForward() {
    return LOCAL_FORWARD.clone().applyQuaternion(this.quaternion);
  }

  getUp() {
    return LOCAL_UP.clone().applyQuaternion(this.quaternion);
  }
}
