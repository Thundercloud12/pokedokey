import * as THREE from "three";
import * as CANNON from "cannon-es";
import {
  PLAYER_CONFIG,
  CAMERA_CONFIG,
  type CameraViewMode,
} from "./constants";
import { sound } from "../audio/Sound";

export interface KickEvent {
  power: number;
  direction: THREE.Vector3;
  isLob: boolean;
  elevationAngle: number; // in radians
}

export class FPSController {
  camera: THREE.PerspectiveCamera;
  body: CANNON.Body;
  domElement: HTMLElement;

  // View Mode: defaults to thirdPerson for ideal spatial awareness
  viewMode: CameraViewMode = "thirdPerson";

  // Angles
  yaw = 0;
  pitch = -0.1; // slight natural look-down angle
  isLocked = false;

  // Key states
  keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  };

  // Kick charge
  isCharging = false;
  chargeTime = 0;
  chargeRatio = 0;
  isKicking = false;
  kickAnimTimer = 0;

  // Possession & Reach status
  ballInRange = false;
  isDribbling = false;

  onKick?: (event: KickEvent) => void;
  onLockChange?: (locked: boolean) => void;
  onViewModeChange?: (mode: CameraViewMode) => void;

  private euler = new THREE.Euler(0, 0, 0, "YXZ");
  private smoothCamPos = new THREE.Vector3();
  private smoothTarget = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, body: CANNON.Body, domElement: HTMLElement) {
    this.camera = camera;
    this.body = body;
    this.domElement = domElement;

    this.smoothCamPos.set(body.position.x, body.position.y + 2, body.position.z + 4);
    this.smoothTarget.set(body.position.x, body.position.y + 1, body.position.z);

    this.bindEvents();
  }

  requestLock() {
    if (!this.domElement) return;
    try {
      const p = this.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          console.warn("Pointer lock request rejected:", err);
        });
      }
    } catch (err) {
      console.warn("Pointer lock error:", err);
    }
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === "thirdPerson" ? "firstPerson" : "thirdPerson";
    this.camera.fov =
      this.viewMode === "thirdPerson"
        ? CAMERA_CONFIG.thirdPerson.fov
        : CAMERA_CONFIG.firstPerson.fov;
    this.camera.updateProjectionMatrix();
    this.onViewModeChange?.(this.viewMode);
  }

  setViewMode(mode: CameraViewMode) {
    this.viewMode = mode;
    this.camera.fov =
      this.viewMode === "thirdPerson"
        ? CAMERA_CONFIG.thirdPerson.fov
        : CAMERA_CONFIG.firstPerson.fov;
    this.camera.updateProjectionMatrix();
    this.onViewModeChange?.(this.viewMode);
  }

  private bindEvents() {
    this.domElement.addEventListener("click", () => {
      if (!this.isLocked) {
        this.requestLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      this.onLockChange?.(this.isLocked);
    });

    document.addEventListener("pointerlockerror", (e) => {
      console.warn("Pointer lock error event:", e);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isLocked) return;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;

      // Clamp vertical look angle
      const maxPitch = Math.PI / 2.3;
      const minPitch = -Math.PI / 2.5;
      this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
    });

    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          this.keys.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          this.keys.backward = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          this.keys.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          this.keys.right = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          this.keys.sprint = true;
          break;
        case "Space":
          this.triggerJump();
          break;
        case "KeyV":
        case "KeyC":
          // Quick camera perspective toggle!
          this.toggleViewMode();
          break;
      }
    });

    window.addEventListener("keyup", (e) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          this.keys.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          this.keys.backward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          this.keys.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          this.keys.right = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          this.keys.sprint = false;
          break;
      }
    });

    // Mouse Controls
    window.addEventListener("mousedown", (e) => {
      if (!this.isLocked) return;
      if (e.button === 0) {
        // Left click: begin charge
        this.isCharging = true;
        this.chargeTime = 0;
      } else if (e.button === 2) {
        // Right click: instant lob/chip shot
        this.executeKick(0.55, true);
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (!this.isLocked) return;
      if (e.button === 0 && this.isCharging) {
        // Left click release: execute shot
        const powerNorm = Math.min(1, this.chargeTime / (PLAYER_CONFIG.maxChargeTimeMs / 1000));
        this.executeKick(Math.max(0.2, powerNorm), false);
        this.isCharging = false;
        this.chargeTime = 0;
        this.chargeRatio = 0;
      }
    });

    window.addEventListener("contextmenu", (e) => {
      if (this.isLocked) e.preventDefault();
    });
  }

  private triggerJump() {
    // Only jump if on ground
    if (this.body.position.y <= PLAYER_CONFIG.height / 2 + 0.2) {
      this.body.velocity.y = PLAYER_CONFIG.jumpSpeed;
      sound.play("jump");
    }
  }

  private executeKick(powerRatio: number, isLob: boolean) {
    this.isKicking = true;
    this.kickAnimTimer = 0.3;

    // Horizontal direction from camera yaw
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const dir = new THREE.Vector3(fwdX, 0, fwdZ).normalize();

    // Guaranteed upward elevation arc
    // Normal shot: 18° up to 30° based on camera pitch
    // Lob shot: 42° soaring arc
    const elevationAngle = isLob
      ? THREE.MathUtils.degToRad(42)
      : THREE.MathUtils.degToRad(18 + Math.max(0, this.pitch) * 22);

    const actualPower =
      PLAYER_CONFIG.kickMinPower +
      powerRatio * (PLAYER_CONFIG.kickMaxPower - PLAYER_CONFIG.kickMinPower);

    this.onKick?.({
      power: actualPower,
      direction: dir,
      isLob,
      elevationAngle,
    });
  }

  update(delta: number, ballBody: CANNON.Body) {
    // 1. Check ball proximity & reach
    const pPos = this.body.position;
    const bPos = ballBody.position;
    const dist = Math.hypot(pPos.x - bPos.x, pPos.z - bPos.z);
    this.ballInRange = dist < PLAYER_CONFIG.kickReach && bPos.y < 2.4;

    // 2. Charge timer
    if (this.isCharging) {
      this.chargeTime += delta;
      this.chargeRatio = Math.min(1, this.chargeTime / (PLAYER_CONFIG.maxChargeTimeMs / 1000));
    }

    // 3. Kick animation timer
    if (this.kickAnimTimer > 0) {
      this.kickAnimTimer -= delta;
      if (this.kickAnimTimer <= 0) {
        this.isKicking = false;
      }
    }

    // 4. Movement with smooth acceleration & deceleration
    const maxSpeed = this.keys.sprint ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;
    let inputX = 0;
    let inputZ = 0;

    if (this.keys.forward) inputZ -= 1;
    if (this.keys.backward) inputZ += 1;
    if (this.keys.left) inputX -= 1;
    if (this.keys.right) inputX += 1;

    // Transform input relative to camera yaw
    let targetVx = 0;
    let targetVz = 0;

    if (inputX !== 0 || inputZ !== 0) {
      const len = Math.hypot(inputX, inputZ);
      const nx = inputX / len;
      const nz = inputZ / len;

      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);

      // (nx * cos - nz * sin, nx * sin + nz * cos)
      targetVx = (nx * cos + nz * sin) * maxSpeed;
      targetVz = (-nx * sin + nz * cos) * maxSpeed;

      // Accelerate towards target
      const accel = PLAYER_CONFIG.accel * delta;
      this.body.velocity.x += THREE.MathUtils.clamp(targetVx - this.body.velocity.x, -accel, accel);
      this.body.velocity.z += THREE.MathUtils.clamp(targetVz - this.body.velocity.z, -accel, accel);
    } else {
      // Decelerate smoothly
      const decel = PLAYER_CONFIG.decel * delta;
      if (Math.abs(this.body.velocity.x) > decel) {
        this.body.velocity.x -= Math.sign(this.body.velocity.x) * decel;
      } else {
        this.body.velocity.x = 0;
      }
      if (Math.abs(this.body.velocity.z) > decel) {
        this.body.velocity.z -= Math.sign(this.body.velocity.z) * decel;
      } else {
        this.body.velocity.z = 0;
      }
    }

    // 5. Update Camera Rig
    if (this.viewMode === "thirdPerson") {
      // Third-Person Over-the-Shoulder follow camera
      const cfg = CAMERA_CONFIG.thirdPerson;
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      // Desired camera position behind player
      const idealCamX = pPos.x + sinY * cfg.distance;
      const idealCamZ = pPos.z + cosY * cfg.distance;
      const idealCamY = pPos.y + cfg.height + Math.sin(this.pitch) * 1.4;

      // Smooth camera follow lerp
      const t = Math.min(1, delta * 14);
      this.smoothCamPos.lerp(new THREE.Vector3(idealCamX, idealCamY, idealCamZ), t);
      this.camera.position.copy(this.smoothCamPos);

      // Look slightly ahead of player
      const lookDist = 8;
      const targetX = pPos.x - sinY * lookDist;
      const targetZ = pPos.z - cosY * lookDist;
      const targetY = pPos.y + 1.2 + Math.tan(this.pitch) * 4;

      this.smoothTarget.lerp(new THREE.Vector3(targetX, targetY, targetZ), t);
      this.camera.lookAt(this.smoothTarget);
    } else {
      // First-Person Mode
      this.euler.x = this.pitch;
      this.euler.y = this.yaw;
      this.camera.quaternion.setFromEuler(this.euler);

      this.camera.position.set(
        pPos.x,
        pPos.y + PLAYER_CONFIG.eyeHeight - PLAYER_CONFIG.height / 2,
        pPos.z
      );
    }
  }

  resetPosition(pos: CANNON.Vec3, lookAtTargetZ: number) {
    this.body.position.copy(pos);
    this.body.velocity.set(0, 0, 0);
    this.yaw = lookAtTargetZ < pos.z ? 0 : Math.PI;
    this.pitch = -0.1;

    // Reset camera smoothing
    const cfg = CAMERA_CONFIG.thirdPerson;
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    this.smoothCamPos.set(pos.x + sinY * cfg.distance, pos.y + cfg.height, pos.z + cosY * cfg.distance);
    this.smoothTarget.set(pos.x, pos.y + 1.2, pos.z);
  }
}
