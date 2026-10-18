import * as THREE from "three";
import * as CANNON from "cannon-es";
import { PLAYER_CONFIG } from "./constants";
import { sound } from "../audio/Sound";

export interface KickEvent {
  power: number;
  direction: THREE.Vector3;
  isLob: boolean;
}

export class FPSController {
  camera: THREE.PerspectiveCamera;
  body: CANNON.Body;
  domElement: HTMLElement;

  // View Angles
  yaw = 0;
  pitch = 0;
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
  chargeRatio = 0; // 0 to 1 for HUD meter
  isKicking = false;
  kickAnimTimer = 0;

  onKick?: (event: KickEvent) => void;
  onLockChange?: (locked: boolean) => void;

  private euler = new THREE.Euler(0, 0, 0, "YXZ");
  private moveVec = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, body: CANNON.Body, domElement: HTMLElement) {
    this.camera = camera;
    this.body = body;
    this.domElement = domElement;

    this.bindEvents();
  }

  requestLock() {
    if (!this.domElement) return;
    try {
      const p = this.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          console.warn("Pointer lock request failed:", err);
        });
      }
    } catch (err) {
      console.warn("Pointer lock error:", err);
    }
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
      const maxPitch = Math.PI / 2.1;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
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

    // Mouse Kick Controls
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
        // Left click release: execute charged shot
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
    // Only jump if close to ground
    if (this.body.position.y <= PLAYER_CONFIG.height / 2 + 0.15) {
      this.body.velocity.y = PLAYER_CONFIG.jumpSpeed;
      sound.play("jump");
    }
  }

  private executeKick(powerRatio: number, isLob: boolean) {
    this.isKicking = true;
    this.kickAnimTimer = 0.28; // duration of kicking leg snap

    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    const actualPower =
      PLAYER_CONFIG.kickMinPower +
      powerRatio * (PLAYER_CONFIG.kickMaxPower - PLAYER_CONFIG.kickMinPower);

    this.onKick?.({
      power: actualPower,
      direction: lookDir,
      isLob,
    });
  }

  update(delta: number, ballBody: CANNON.Body) {
    // Update Camera rotation
    this.euler.x = this.pitch;
    this.euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(this.euler);

    // Position camera at player's eye height
    this.camera.position.set(
      this.body.position.x,
      this.body.position.y + PLAYER_CONFIG.eyeHeight - PLAYER_CONFIG.height / 2,
      this.body.position.z
    );

    // Charge timer
    if (this.isCharging) {
      this.chargeTime += delta;
      this.chargeRatio = Math.min(1, this.chargeTime / (PLAYER_CONFIG.maxChargeTimeMs / 1000));
    }

    // Kick animation timer
    if (this.kickAnimTimer > 0) {
      this.kickAnimTimer -= delta;
      if (this.kickAnimTimer <= 0) {
        this.isKicking = false;
      }
    }

    // WASD Movement
    const speed = this.keys.sprint ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;
    this.moveVec.set(0, 0, 0);

    if (this.keys.forward) this.moveVec.z -= 1;
    if (this.keys.backward) this.moveVec.z += 1;
    if (this.keys.left) this.moveVec.x -= 1;
    if (this.keys.right) this.moveVec.x += 1;

    if (this.moveVec.lengthSq() > 0) {
      this.moveVec.normalize();
      // Rotate movement vector by player yaw
      this.moveVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.moveVec.multiplyScalar(speed);

      this.body.velocity.x = this.moveVec.x;
      this.body.velocity.z = this.moveVec.z;
    } else {
      this.body.velocity.x *= 0.8;
      this.body.velocity.z *= 0.8;
    }

    // Dribble assist: if close to ball and running toward it, softly guide it
    const distToBall = this.body.position.distanceTo(ballBody.position);
    if (distToBall < PLAYER_CONFIG.dribbleReach && this.moveVec.lengthSq() > 1) {
      const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      ballBody.velocity.x = fwd.x * (speed * 0.95);
      ballBody.velocity.z = fwd.z * (speed * 0.95);
    }
  }

  resetPosition(pos: CANNON.Vec3, lookAtTargetZ: number) {
    this.body.position.copy(pos);
    this.body.velocity.set(0, 0, 0);
    // Face the target goal
    this.yaw = lookAtTargetZ < pos.z ? 0 : Math.PI;
    this.pitch = 0;
  }
}
