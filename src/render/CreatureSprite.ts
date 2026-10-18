import { type Creature } from "../data/creatures";

export interface SpriteRenderState {
  x: number;
  y: number;
  facing: 1 | -1;
  vx: number;
  onGround: boolean;
  anim: number;
  castT: number;
  hurtT: number;
  isKo: boolean;
}

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  st: SpriteRenderState
) {
  const cx = Math.round(st.x + 6);
  const top = Math.round(st.y);
  const f = st.facing;
  const pal = creature.palette;

  // Hurt flash
  if (st.hurtT > 0 && Math.floor(st.hurtT / 2) % 2 === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 7, top, 14, 22);
    return;
  }

  // KO pose (lying down)
  if (st.isKo) {
    ctx.fillStyle = pal.body;
    ctx.fillRect(cx - 10, top + 15, 20, 6);
    ctx.fillStyle = pal.bodyDark;
    ctx.fillRect(cx - 10, top + 17, 8, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 7, top + 16, 2, 2);
    return;
  }

  const R = (dx: number, dy: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(f > 0 ? cx + dx : cx - dx - w, top + dy, w, h);
  };

  const air = !st.onGround;
  const run = !air && Math.abs(st.vx) > 0.3;
  const ph = run ? Math.floor(st.anim / 4) % 2 : 0;
  const casting = st.castT > 0;

  // Custom silhouettes per creature type
  switch (creature.id) {
    case "pyrokid": {
      // Fire horn crest
      R(-2, -3, 4, 3, pal.accent);
      R(-1, -5, 2, 2, "#ef4444");
      // Head
      R(-4, 0, 8, 6, pal.body);
      R(1, 2, 2, 2, pal.eye);
      // Torso
      R(-4, 6, 8, 7, pal.body);
      R(-3, 8, 6, 3, pal.bodyDark);
      // Back Flame tail
      R(-7, 8 + (run ? ph : 0), 3, 3, pal.accent);
      // Legs
      if (air) {
        R(-3, 14, 3, 5, pal.limb); R(1, 14, 3, 4, pal.limb);
      } else if (run) {
        R(-3 + (ph ? 1 : -1), 13, 3, 7, pal.limb);
        R(1 - (ph ? 1 : -1), 13, 3, 7, pal.limb);
      } else {
        R(-3, 13, 3, 7, pal.limb); R(1, 13, 3, 7, pal.limb);
      }
      // Arm (thrust forward if casting)
      if (casting) {
        R(2, 6, 7, 3, pal.limb);
        R(7, 5, 4, 5, pal.accent);
      } else {
        R(2, 7 + (run ? (ph ? 0 : 1) : 0), 2, 5, pal.limb);
      }
      break;
    }

    case "golex": {
      // Bulky stone head with orange optic
      R(-5, -2, 10, 6, pal.bodyDark);
      R(1, 0, 3, 2, pal.eye);
      // Massive granite shoulders
      R(-7, 4, 14, 4, pal.body);
      R(-6, 8, 12, 6, pal.limbDark);
      // Sturdy legs
      if (run) {
        R(-5 + (ph ? 1 : -1), 14, 4, 7, pal.limb);
        R(1 - (ph ? 1 : -1), 14, 4, 7, pal.limb);
      } else {
        R(-5, 14, 4, 7, pal.limb); R(1, 14, 4, 7, pal.limb);
      }
      // Heavy stone fist
      if (casting) {
        R(3, 5, 8, 5, pal.bodyDark);
      } else {
        R(3, 7, 3, 6, pal.limb);
      }
      break;
    }

    case "zephyros": {
      // Sleek falcon beak and crest
      R(-3, -2, 6, 2, pal.accent);
      R(-3, 0, 7, 6, pal.body);
      R(2, 2, 3, 2, pal.eye); // sharp eye
      // Winged arms
      R(-4, 6, 8, 7, pal.body);
      if (air || casting) {
        // Wings spread wide!
        R(-7, 4, 4, 6, pal.limb);
        R(3, 4, 6, 6, pal.limb);
      } else {
        R(-5, 6, 3, 6, pal.limb);
        R(2, 6, 3, 6, pal.limb);
      }
      // Taloned feet
      R(-3, 13, 3, 7, pal.accent);
      R(1, 13, 3, 7, pal.accent);
      break;
    }

    case "voltix": {
      // Zigzag thunderbolt antennae
      R(-2, -4, 2, 2, pal.accent);
      R(0, -6, 2, 3, pal.accent);
      // Sleek head & visor
      R(-4, 0, 8, 6, pal.body);
      R(1, 2, 3, 2, pal.accent);
      // Lightning bolt chest emblem
      R(-4, 6, 8, 7, pal.bodyDark);
      R(-2, 7, 4, 5, pal.accent);
      // Running legs
      if (run) {
        R(-3 + (ph ? 2 : -2), 13, 3, 7, pal.limb);
        R(1 - (ph ? 2 : -2), 13, 3, 7, pal.limb);
      } else {
        R(-3, 13, 3, 7, pal.limb); R(1, 13, 3, 7, pal.limb);
      }
      // Sparking hands
      if (casting) {
        R(2, 5, 7, 3, pal.accent);
      } else {
        R(2, 7, 2, 5, pal.limb);
      }
      break;
    }

    case "aquanaut": {
      // Diving visor
      R(-4, -1, 8, 7, pal.body);
      R(0, 1, 4, 3, pal.accent);
      // Scuba-style torso
      R(-4, 6, 8, 7, pal.bodyDark);
      // Water-resistant flipper boots
      if (run) {
        R(-4 + (ph ? 1 : -1), 13, 4, 7, pal.limb);
        R(0 - (ph ? 1 : -1), 13, 4, 7, pal.limb);
      } else {
        R(-4, 13, 4, 7, pal.limb); R(0, 13, 4, 7, pal.limb);
      }
      // Water jet cannon arm
      if (casting) {
        R(2, 6, 7, 4, pal.accent);
      } else {
        R(2, 7, 2, 5, pal.limb);
      }
      break;
    }

    case "flora":
    default: {
      // Sprout leaf on head
      R(-1, -4, 3, 3, pal.accent);
      // Flower bud head
      R(-4, 0, 8, 6, pal.body);
      R(1, 2, 2, 2, pal.eye);
      // Vine torso
      R(-4, 6, 8, 7, pal.bodyDark);
      R(-3, 7, 6, 4, pal.body);
      // Root legs
      if (run) {
        R(-3 + (ph ? 1 : -1), 13, 3, 7, pal.limb);
        R(1 - (ph ? 1 : -1), 13, 3, 7, pal.limb);
      } else {
        R(-3, 13, 3, 7, pal.limb); R(1, 13, 3, 7, pal.limb);
      }
      // Thorn whip arm
      if (casting) {
        R(2, 5, 8, 3, pal.accent);
      } else {
        R(2, 7, 2, 5, pal.limb);
      }
      break;
    }
  }
}
