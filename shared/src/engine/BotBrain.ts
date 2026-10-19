import type { BattleControls, CreatureState } from "../types/index.js";

export class BotBrain {
  private botAttackTimer = 0;

  computeControls(me: CreatureState, opp: CreatureState): BattleControls {
    const ctl: BattleControls = {
      left: false,
      right: false,
      jump: false,
      move1: false,
      move2: false,
      move3: false,
      move4: false,
    };

    if (me.isKo) return ctl;

    if (this.botAttackTimer > 0) this.botAttackTimer--;

    const dx = opp.x - me.x;
    const dist = Math.abs(dx);

    // If opponent is mid-cast with an aoe/heavy move, back away defensively
    if (opp.castT > 0 && Math.random() < 0.6) {
      if (dist < 60) {
        ctl.left = dx > 0;
        ctl.right = dx < 0;
      }
      return ctl;
    }

    // Normal approach spacing
    if (dist > 75) {
      ctl.left = dx < 0;
      ctl.right = dx > 0;
    } else if (dist < 32) {
      ctl.left = dx > 0;
      ctl.right = dx < 0;
    }

    // Jump if opponent is on a platform above
    ctl.jump = opp.y < me.y - 15 && Math.random() < 0.04 && me.onGround;

    // Only attack when botAttackTimer has fully elapsed
    if (this.botAttackTimer <= 0) {
      let chosenMove: number | null = null;

      // 1. Close-range Melee (Move 1)
      if (dist < 34 && me.cooldowns[0] <= 0 && Math.random() < 0.5) {
        chosenMove = 0;
      }
      // 2. Mid/Long range Projectile (Move 2)
      else if (dist >= 45 && dist <= 140 && me.cooldowns[1] <= 0 && Math.random() < 0.45) {
        chosenMove = 1;
      }
      // 3. AoE Zone Attack (Move 3)
      else if (dist < 50 && me.cooldowns[2] <= 0 && Math.random() < 0.35) {
        chosenMove = 2;
      }
      // 4. Special / Rush Attack (Move 4)
      else if (dist < 60 && me.cooldowns[3] <= 0 && Math.random() < 0.3) {
        chosenMove = 3;
      }

      if (chosenMove !== null) {
        if (chosenMove === 0) ctl.move1 = true;
        if (chosenMove === 1) ctl.move2 = true;
        if (chosenMove === 2) ctl.move3 = true;
        if (chosenMove === 3) ctl.move4 = true;

        // Human-like attack pacing cooldown: 45-70 frames (~0.75 - 1.15 seconds)
        this.botAttackTimer = 45 + Math.floor(Math.random() * 25);
      }
    }

    return ctl;
  }
}
