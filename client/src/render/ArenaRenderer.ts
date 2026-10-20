import type { Creature, WorldSnapshot } from "@game/shared";
import { PW, PH } from "@game/shared";
import { drawCreature } from "./CreatureSprite.js";
import { generateArenaBackground } from "./ArenaBackground.js";

export class ArenaRenderer {
  readonly W: number;
  readonly H: number;
  readonly groundY: number;
  private bgCanvas: HTMLCanvasElement;

  constructor(W = 320, H = 170) {
    this.W = W;
    this.H = H;
    this.groundY = H - 28;

    const { canvas } = generateArenaBackground(W, H, this.groundY);
    this.bgCanvas = canvas;
  }

  render(
    ctx: CanvasRenderingContext2D,
    snap: WorldSnapshot,
    leftCreature: Creature,
    rightCreature: Creature
  ) {
    ctx.save();
    if (snap.shake > 0) {
      ctx.translate(
        Math.round((Math.random() - 0.5) * 3),
        Math.round((Math.random() - 0.5) * 3)
      );
    }

    // 1. Draw Arena Background
    ctx.drawImage(this.bgCanvas, 0, 0);

    // 2. Creature Shadows
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (const st of [snap.left, snap.right]) {
      const sw = Math.round(12 - Math.min(6, (this.groundY - st.y - PH) / 10));
      ctx.fillRect(Math.round(st.x + PW / 2 - sw / 2), this.groundY, sw, 2);
    }

    // 3. Draw Creatures
    drawCreature(ctx, leftCreature, {
      x: snap.left.x,
      y: snap.left.y,
      facing: snap.left.facing,
      vx: snap.left.vx,
      onGround: snap.left.onGround,
      anim: snap.left.anim,
      castT: snap.left.castT,
      hurtT: snap.left.hurtT,
      isKo: snap.left.isKo,
    });

    drawCreature(ctx, rightCreature, {
      x: snap.right.x,
      y: snap.right.y,
      facing: snap.right.facing,
      vx: snap.right.vx,
      onGround: snap.right.onGround,
      anim: snap.right.anim,
      castT: snap.right.castT,
      hurtT: snap.right.hurtT,
      isKo: snap.right.isKo,
    });

    // 4. Draw Active Hitboxes
    for (const hb of snap.hitboxes) {
      ctx.fillStyle = hb.color;
      if (hb.shape === "projectile") {
        ctx.fillRect(Math.round(hb.x - 3), Math.round(hb.y - 3), 6, 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(hb.x - 1), Math.round(hb.y - 1), 2, 2);
      } else if (hb.shape === "aoe") {
        ctx.strokeStyle = hb.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hb.x, hb.y, hb.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillRect(
          Math.round(hb.x - hb.radius),
          Math.round(hb.y - hb.radius),
          hb.radius * 2,
          hb.radius * 2
        );
      }
    }

    // 5. Draw Particles
    for (const p of snap.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }

    // 6. Draw Damage Popups & Troll Speech Bubbles
    for (const pop of snap.popups) {
      if (pop.color === "#fbbf24") {
        // Retro comic speech bubble for Troll AI taunts
        ctx.font = "bold 9px monospace";
        const textWidth = ctx.measureText(pop.text).width;
        const padX = 4;
        const bubbleW = Math.max(16, textWidth + padX * 2);
        const bubbleH = 12;
        const bx = Math.round(pop.x - bubbleW / 2);
        const by = Math.round(pop.y - bubbleH - 3);

        // Bubble background & amber border
        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.fillRect(bx, by, bubbleW, bubbleH);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bubbleW, bubbleH);

        // Speech bubble triangle pointing down
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(pop.x - 2, by + bubbleH);
        ctx.lineTo(pop.x + 2, by + bubbleH);
        ctx.lineTo(pop.x, by + bubbleH + 3);
        ctx.fill();

        // Text
        ctx.fillStyle = "#fef08a";
        ctx.textAlign = "center";
        ctx.fillText(pop.text, pop.x, by + bubbleH - 3);
        ctx.textAlign = "left";
      } else {
        ctx.fillStyle = "#000000";
        ctx.font = "bold 9px monospace";
        ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
      }
    }

    // 7. Flash Text Announcement
    if (snap.flash && snap.flash.t > 0) {
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#000000";
      ctx.fillText(snap.flash.text, this.W / 2 + 1, this.H * 0.35 + 1);
      ctx.fillStyle = snap.flash.color;
      ctx.fillText(snap.flash.text, this.W / 2, this.H * 0.35);
      ctx.textAlign = "left";
    }

    ctx.restore();
  }
}
