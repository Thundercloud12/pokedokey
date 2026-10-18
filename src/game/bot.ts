import * as CANNON from "cannon-es";
import * as THREE from "three";
import { GOAL, PLAYER_CONFIG, DRIBBLE_CONFIG, TEAMS, type TeamId } from "./constants";
import { sound } from "../audio/Sound";

export type BotState = "defend" | "approach" | "dribble" | "shoot";

export class FootballBot {
  body: CANNON.Body;
  teamId: TeamId;
  targetGoalZ: number;
  ownGoalZ: number;

  state: BotState = "approach";
  speed = 10.0;
  kickCooldown = 0;
  isKicking = false;
  kickTimer = 0;
  isDribbling = false;

  constructor(body: CANNON.Body, teamId: TeamId = "blue") {
    this.body = body;
    this.teamId = teamId;
    this.targetGoalZ = TEAMS[teamId].targetGoalZ;
    this.ownGoalZ = TEAMS[teamId].goalZ;
  }

  update(delta: number, ballBody: CANNON.Body, _playerPos?: CANNON.Vec3) {
    if (this.kickCooldown > 0) this.kickCooldown -= delta;
    if (this.kickTimer > 0) {
      this.kickTimer -= delta;
      if (this.kickTimer <= 0) this.isKicking = false;
    }

    const bp = ballBody.position;
    const mp = this.body.position;

    const distToBall = Math.hypot(mp.x - bp.x, mp.z - bp.z);
    const distToTargetGoal = Math.abs(mp.z - this.targetGoalZ);
    const isBallInDefensiveHalf =
      this.teamId === "blue" ? bp.z < -6 : bp.z > 6;

    // 1. Determine State
    if (isBallInDefensiveHalf && distToBall > 12) {
      this.state = "defend";
    } else if (distToBall < DRIBBLE_CONFIG.captureRadius && bp.y < 1.8) {
      if (distToTargetGoal < 24 && this.kickCooldown <= 0) {
        this.state = "shoot";
      } else {
        this.state = "dribble";
      }
    } else {
      this.state = "approach";
    }

    // 2. Execute State
    let targetX = 0;
    let targetZ = 0;
    let moveSpeed = this.speed;

    switch (this.state) {
      case "defend": {
        // Guard center of own goal line
        targetX = THREE.MathUtils.clamp(bp.x * 0.65, -GOAL.width * 0.4, GOAL.width * 0.4);
        targetZ = this.ownGoalZ + (this.teamId === "blue" ? 5.5 : -5.5);
        this.isDribbling = false;
        break;
      }

      case "approach": {
        // Circle behind the ball relative to target goal
        const behindZ = this.teamId === "blue" ? -1.6 : 1.6;
        targetX = bp.x;
        targetZ = bp.z + behindZ;
        this.isDribbling = false;
        break;
      }

      case "dribble": {
        // Push forward towards target goal
        targetX = bp.x * 0.5;
        targetZ = this.targetGoalZ;
        moveSpeed = this.speed * 0.9;
        this.isDribbling = true;

        // Apply soft dribble touch to ball
        ballBody.velocity.x += (this.body.velocity.x - ballBody.velocity.x) * 0.2;
        ballBody.velocity.z += (this.body.velocity.z - ballBody.velocity.z) * 0.2;
        break;
      }

      case "shoot": {
        this.isDribbling = false;
        this.shoot(ballBody);
        break;
      }
    }

    // 3. Move Body toward target with smooth acceleration
    const dx = targetX - mp.x;
    const dz = targetZ - mp.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.3) {
      const desiredVx = (dx / dist) * moveSpeed;
      const desiredVz = (dz / dist) * moveSpeed;

      const accel = PLAYER_CONFIG.accel * delta;
      this.body.velocity.x += THREE.MathUtils.clamp(desiredVx - this.body.velocity.x, -accel, accel);
      this.body.velocity.z += THREE.MathUtils.clamp(desiredVz - this.body.velocity.z, -accel, accel);
    } else {
      this.body.velocity.x *= 0.8;
      this.body.velocity.z *= 0.8;
    }

    // Aerial jump for floating ball
    if (distToBall < 2.4 && bp.y > 1.8 && mp.y <= PLAYER_CONFIG.height / 2 + 0.15) {
      this.body.velocity.y = PLAYER_CONFIG.jumpSpeed;
    }
  }

  private shoot(ballBody: CANNON.Body) {
    this.isKicking = true;
    this.kickTimer = 0.3;
    this.kickCooldown = 1.0;

    // Aim toward left or right corner of goal
    const targetCornerX = (Math.random() > 0.5 ? 1 : -1) * (GOAL.width * 0.38);
    const targetZ = this.targetGoalZ;

    const dx = targetCornerX - ballBody.position.x;
    const dz = targetZ - ballBody.position.z;
    const len = Math.hypot(dx, dz);

    const nx = dx / len;
    const nz = dz / len;

    const power = 22 + Math.random() * 8;
    const elevation = THREE.MathUtils.degToRad(18 + Math.random() * 8);

    const hSpeed = Math.cos(elevation) * power;
    const vSpeed = Math.sin(elevation) * power;

    ballBody.velocity.set(nx * hSpeed, vSpeed, nz * hSpeed);
    ballBody.angularVelocity.set(-nz * 2, 0, nx * 2);

    sound.play("kick", power / 30);
  }

  resetPosition(pos: CANNON.Vec3) {
    this.body.position.copy(pos);
    this.body.velocity.set(0, 0, 0);
    this.state = "approach";
    this.isDribbling = false;
  }
}
