import { type Move } from "../data/moves.js";
import { getTypeMultiplier } from "../data/typeChart.js";
import { type Creature } from "../data/creatures.js";

export interface ActiveHitbox {
  id: string;
  casterSide: "left" | "right";
  move: Move;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  facing: 1 | -1;
  remainingFrames: number;
  hasHit: boolean;
  color: string;
}

export interface HitResult {
  hitbox: ActiveHitbox;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  statusEffect?: Move["statusEffect"];
  multiplier: number;
  hitX: number;
  hitY: number;
}

export interface TargetEntity {
  side: "left" | "right";
  x: number;
  y: number;
  w: number;
  h: number;
  creature: Creature;
}

export class HitboxManager {
  hitboxes: ActiveHitbox[] = [];
  private nextId = 1;

  spawn(
    casterSide: "left" | "right",
    move: Move,
    casterX: number,
    casterY: number,
    casterFacing: 1 | -1
  ): ActiveHitbox {
    let x = casterX;
    let y = casterY;
    let vx = 0;
    let vy = 0;
    let radius = move.range;

    if (move.shape === "melee") {
      // Offset in front of caster's chest/fist
      x = casterFacing > 0 ? casterX + 10 + move.range / 2 : casterX - 10 - move.range / 2;
      y = casterY + 8;
      radius = move.range / 2;
    } else if (move.shape === "projectile") {
      x = casterFacing > 0 ? casterX + 12 : casterX - 12;
      y = casterY + 8;
      vx = casterFacing * move.speed;
      vy = 0;
      radius = 5;
    } else if (move.shape === "aoe") {
      // Centered on caster
      x = casterX;
      y = casterY + 10;
      radius = move.range;
    }

    const hb: ActiveHitbox = {
      id: `hb_${this.nextId++}`,
      casterSide,
      move,
      x,
      y,
      vx,
      vy,
      radius,
      facing: casterFacing,
      remainingFrames: move.durationFrames,
      hasHit: false,
      color: move.color,
    };

    this.hitboxes.push(hb);
    return hb;
  }

  update(targets: TargetEntity[], onHit: (res: HitResult) => void) {
    const surviving: ActiveHitbox[] = [];

    for (const hb of this.hitboxes) {
      // Step movement
      hb.x += hb.vx;
      hb.y += hb.vy;
      hb.remainingFrames--;

      if (hb.remainingFrames <= 0) continue;

      // Check collision against opposing targets
      for (const target of targets) {
        if (target.side === hb.casterSide || hb.hasHit) continue;

        if (this.checkCircleVsBox(hb.x, hb.y, hb.radius, target.x, target.y, target.w, target.h)) {
          hb.hasHit = true;

          // Type effectiveness
          const mult = getTypeMultiplier(hb.move.type, target.creature.type);
          const finalDamage = Math.round(hb.move.power * mult);

          // Knockback based on defender weight
          const weightFactor = 1 / target.creature.weight;
          const kbX = hb.facing * hb.move.knockback * weightFactor * 1.2;
          const kbY = -Math.abs(hb.move.knockback) * weightFactor * 0.9;

          onHit({
            hitbox: hb,
            damage: finalDamage,
            knockbackX: kbX,
            knockbackY: kbY,
            statusEffect: hb.move.statusEffect,
            multiplier: mult,
            hitX: (hb.x + target.x) / 2,
            hitY: (hb.y + target.y) / 2,
          });

          // Melee and single-target projectiles dissipate on contact
          if (hb.move.shape !== "aoe") {
            hb.remainingFrames = 0;
          }
          break;
        }
      }

      if (hb.remainingFrames > 0 && (!hb.hasHit || hb.move.shape === "aoe")) {
        surviving.push(hb);
      }
    }

    this.hitboxes = surviving;
  }

  private checkCircleVsBox(
    cx: number,
    cy: number,
    r: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): boolean {
    // Clamp circle center to nearest point on box
    const nearestX = Math.max(bx, Math.min(cx, bx + bw));
    const nearestY = Math.max(by, Math.min(cy, by + bh));

    const dx = cx - nearestX;
    const dy = cy - nearestY;

    return dx * dx + dy * dy <= r * r;
  }

  clear() {
    this.hitboxes = [];
  }
}
