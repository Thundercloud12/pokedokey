import * as CANNON from "cannon-es";
import * as THREE from "three";
import { GOAL, PLAYER_CONFIG, TEAMS, type TeamId } from "./constants";
import { sound } from "../audio/Sound";

export class FootballBot {
  body: CANNON.Body;
  teamId: TeamId;
  targetGoalZ: number;
  ownGoalZ: number;

  speed = 10.5;
  kickCooldown = 0;
  isKicking = false;
  kickTimer = 0;

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

    // Desired destination
    // If the ball is between bot and own goal: sprint back to defend
    // If bot is behind the ball: push forward toward opponent goal
    const behindBallOffset = this.teamId === "blue" ? -1.8 : 1.8;
    const targetX = bp.x * 0.9;
    const targetZ = bp.z + behindBallOffset;

    const dx = targetX - mp.x;
    const dz = targetZ - mp.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.4) {
      const vx = (dx / dist) * this.speed;
      const vz = (dz / dist) * this.speed;
      this.body.velocity.x = vx;
      this.body.velocity.z = vz;
    } else {
      this.body.velocity.x *= 0.5;
      this.body.velocity.z *= 0.5;
    }

    // Check kick opportunity
    const distToBall = mp.distanceTo(bp);
    if (distToBall < PLAYER_CONFIG.kickReach && this.kickCooldown <= 0) {
      this.shoot(ballBody);
    }

    // Aerial header if ball is floating above head
    if (distToBall < 2.5 && bp.y > 1.8 && mp.y <= PLAYER_CONFIG.height / 2 + 0.1) {
      this.body.velocity.y = PLAYER_CONFIG.jumpSpeed;
    }
  }

  private shoot(ballBody: CANNON.Body) {
    this.isKicking = true;
    this.kickTimer = 0.28;
    this.kickCooldown = 0.75;

    // Aim toward target goal with slight random variance
    const aimX = (Math.random() - 0.5) * (GOAL.width * 0.65);
    const aimZ = this.targetGoalZ;
    const aimY = 0.8 + Math.random() * 1.6;

    const dir = new THREE.Vector3(
      aimX - ballBody.position.x,
      aimY - ballBody.position.y,
      aimZ - ballBody.position.z
    ).normalize();

    const power = 18 + Math.random() * 12;
    ballBody.velocity.set(dir.x * power, dir.y * power * 0.6, dir.z * power);

    sound.play("kick", power / 30);
  }

  resetPosition(pos: CANNON.Vec3) {
    this.body.position.copy(pos);
    this.body.velocity.set(0, 0, 0);
  }
}
