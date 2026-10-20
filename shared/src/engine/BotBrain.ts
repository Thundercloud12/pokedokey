import type { BattleControls, CreatureState } from "../types/index.js";

export type BotTrollState =
  | "neutral"
  | "shimmy"
  | "fake_afk"
  | "kiting"
  | "disrespect"
  | "ko_dance";

export interface BotTaunt {
  text: string;
  x: number;
  y: number;
}

export class BotBrain {
  private state: BotTrollState = "neutral";
  private stateTimer = 0;
  private botAttackTimer = 0;
  private fakeAfkCooldown = 260 + Math.floor(Math.random() * 160);
  private lastOppCastT = 0;
  private lastMyHurtT = 0;
  private lastOppHp = -1;
  private pendingTaunt: BotTaunt | null = null;
  private tauntCooldown = 0;
  private shimmyCounter = 0;

  private static readonly WHIFF_TAUNTS = [
    "?",
    "who you hitting? 😂",
    "nice air 🥱",
    "too slow",
    "missed :)",
    "air combo 💀",
    "swing and miss",
  ];

  private static readonly BAIT_SUCCESS_TAUNTS = [
    "SIKE! 🤡",
    "BAITED!",
    "too easy lol",
    "gotcha!",
  ];

  private static readonly BIG_HIT_TAUNTS = [
    "oof",
    "L",
    "sit down",
    "skill issue",
    "clean.",
    "ouch 😂",
  ];

  private static readonly LOW_HP_TAUNTS = [
    "one tap",
    "bonk 🔨",
    "just give up",
    "1 HP dream? 🤣",
  ];

  private static readonly KO_TAUNTS = [
    "ez 🤡",
    "rematch?",
    "cry about it",
    "gg no re",
    "bodied 💀",
    "too free",
  ];

  private static readonly KITE_TAUNTS = [
    "catch me if u can 🏃",
    "floor is lava",
    "clock is ticking ⏳",
    "can't touch this",
  ];

  public popTaunt(): BotTaunt | null {
    const t = this.pendingTaunt;
    this.pendingTaunt = null;
    return t;
  }

  public reset(): void {
    this.state = "neutral";
    this.stateTimer = 0;
    this.botAttackTimer = 0;
    this.fakeAfkCooldown = 260 + Math.floor(Math.random() * 160);
    this.lastOppCastT = 0;
    this.lastMyHurtT = 0;
    this.lastOppHp = -1;
    this.pendingTaunt = null;
    this.tauntCooldown = 0;
    this.shimmyCounter = 0;
  }

  private triggerTaunt(list: readonly string[], x: number, y: number, force = false): void {
    if (this.tauntCooldown > 0 && !force) return;
    const text = list[Math.floor(Math.random() * list.length)];
    this.pendingTaunt = { text, x, y };
    this.tauntCooldown = 90; // At least ~1.5s between taunts
  }

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

    // Track state decays
    if (this.stateTimer > 0) this.stateTimer--;
    if (this.botAttackTimer > 0) this.botAttackTimer--;
    if (this.tauntCooldown > 0) this.tauntCooldown--;
    if (this.fakeAfkCooldown > 0) this.fakeAfkCooldown--;

    const dx = opp.x - me.x;
    const dist = Math.abs(dx);

    // ==========================================
    // 1. POST-KO CELEBRATION (Teabag & Victory Hop)
    // ==========================================
    if (opp.isKo) {
      if (this.state !== "ko_dance") {
        this.state = "ko_dance";
        this.stateTimer = 180;
        this.triggerTaunt(BotBrain.KO_TAUNTS, me.x, me.y, true);
      }

      // Move toward fallen opponent
      if (dist > 18) {
        ctl.left = dx < 0;
        ctl.right = dx > 0;
      } else {
        // Rapid shimmy on top of them!
        this.shimmyCounter++;
        const wiggle = Math.floor(this.shimmyCounter / 3) % 2 === 0;
        ctl.left = wiggle;
        ctl.right = !wiggle;
        if (me.onGround && this.shimmyCounter % 20 === 0) {
          ctl.jump = true;
        }
      }
      return ctl;
    }

    // ==========================================
    // 2. WHIFF DETECTION (Player swings and misses)
    // ==========================================
    const oppJustFinishedCast = opp.castT === 0 && this.lastOppCastT > 0;
    const botWasNotHit = me.hurtT === 0 && this.lastMyHurtT === 0;

    if (oppJustFinishedCast && botWasNotHit && dist < 110) {
      // 80% chance to immediately mock player's whiff!
      if (Math.random() < 0.8 && this.state !== "fake_afk") {
        this.state = "shimmy";
        this.stateTimer = 45; // ~0.75s shimmy
        this.triggerTaunt(BotBrain.WHIFF_TAUNTS, me.x, me.y, true);
      }
    }

    // ==========================================
    // 3. BIG HIT CELEBRATION
    // ==========================================
    if (this.lastOppHp > 0 && opp.hp < this.lastOppHp - 18 && opp.hurtT > 0) {
      if (Math.random() < 0.6) {
        this.triggerTaunt(BotBrain.BIG_HIT_TAUNTS, me.x, me.y);
      }
    }

    // Save previous frame values for diffs
    this.lastOppCastT = opp.castT;
    this.lastMyHurtT = me.hurtT;
    this.lastOppHp = opp.hp;

    // ==========================================
    // 4. FAKE AFK BAIT LOGIC
    // ==========================================
    if (
      this.state === "neutral" &&
      this.fakeAfkCooldown <= 0 &&
      dist > 85 &&
      me.onGround &&
      me.hp > 25
    ) {
      // Enter Fake AFK!
      this.state = "fake_afk";
      this.stateTimer = 85; // 1.4 seconds
      this.fakeAfkCooldown = 380 + Math.floor(Math.random() * 220);
      this.triggerTaunt(["...", "zZz", "afk brb"], me.x, me.y, true);
    }

    if (this.state === "fake_afk") {
      // If player fell for the bait by charging in or swinging:
      if (dist < 55 || opp.castT > 0) {
        // THE TRAP SPRINGS! Instantly snap out and counter!
        this.state = "neutral";
        this.stateTimer = 0;
        this.triggerTaunt(BotBrain.BAIT_SUCCESS_TAUNTS, me.x, me.y, true);

        // Immediate dodge jump + projectile or rush punish
        ctl.jump = true;
        ctl.left = dx > 0;
        ctl.right = dx < 0;

        if (me.cooldowns[1] <= 0) ctl.move2 = true;
        else if (me.cooldowns[3] <= 0) ctl.move4 = true;
        else if (me.cooldowns[0] <= 0) ctl.move1 = true;

        this.botAttackTimer = 35;
        return ctl;
      }

      if (this.stateTimer <= 0) {
        this.state = "neutral";
      } else {
        // Complete stillness (feigning AFK)
        return ctl;
      }
    }

    // ==========================================
    // 5. SHIMMY / TEABAG STATE
    // ==========================================
    if (this.state === "shimmy") {
      if (this.stateTimer <= 0) {
        this.state = "neutral";
      } else {
        this.shimmyCounter++;
        const wiggle = Math.floor(this.shimmyCounter / 3) % 2 === 0;
        ctl.left = wiggle;
        ctl.right = !wiggle;
        if (me.onGround && this.stateTimer % 18 === 0) {
          ctl.jump = true;
        }
        return ctl;
      }
    }

    // ==========================================
    // 6. LOW HP DISRESPECT FINISHER
    // ==========================================
    const isDisrespectRange = opp.hp <= 18;
    if (isDisrespectRange && this.state !== "kiting") {
      if (Math.random() < 0.05) {
        this.triggerTaunt(BotBrain.LOW_HP_TAUNTS, me.x, me.y);
      }
    }

    // ==========================================
    // 7. KITING / FLOOR IS LAVA (When having big HP lead)
    // ==========================================
    const hasBigLead = me.hp > opp.hp + 25 && opp.hp > 20;
    if (hasBigLead && Math.random() < 0.02) {
      this.triggerTaunt(BotBrain.KITE_TAUNTS, me.x, me.y);
    }

    // ==========================================
    // 8. DEFENSIVE WHIFF DODGING
    // ==========================================
    // If opponent is mid-cast, immediately back away or leap over them!
    if (opp.castT > 0) {
      if (dist < 65) {
        ctl.left = dx > 0;
        ctl.right = dx < 0;
        if (me.onGround && Math.random() < 0.5) {
          ctl.jump = true;
        }
      }
      return ctl;
    }

    // ==========================================
    // 9. TROLL MOVEMENT & SPACING
    // ==========================================
    if (hasBigLead) {
      // Keep-away troll spacing
      if (dist < 80) {
        ctl.left = dx > 0;
        ctl.right = dx < 0;
      }
      ctl.jump = me.onGround && Math.random() < 0.04;
    } else {
      // Normal / Disrespect spacing (teases right around 32-38px)
      if (dist > (isDisrespectRange ? 36 : 72)) {
        ctl.left = dx < 0;
        ctl.right = dx > 0;
      } else if (dist < 28) {
        ctl.left = dx > 0;
        ctl.right = dx < 0;
      }

      // Jump if opponent is on higher platform or to mix up jump approaches
      ctl.jump =
        ((opp.y < me.y - 15 && Math.random() < 0.05) || (dist < 40 && Math.random() < 0.025)) &&
        me.onGround;
    }

    // ==========================================
    // 10. TROLL ATTACK DECISIONS
    // ==========================================
    if (this.botAttackTimer <= 0) {
      let chosenMove: number | null = null;

      // Disrespect mode: only use light poke (Move 1) or tiny projectile (Move 2)
      if (isDisrespectRange) {
        if (dist < 35 && me.cooldowns[0] <= 0) {
          chosenMove = 0; // Light jab!
        } else if (dist >= 35 && me.cooldowns[1] <= 0 && Math.random() < 0.5) {
          chosenMove = 1;
        }
      } else {
        // Normal Troll attacks:
        // 1. Close-range Melee (Move 1)
        if (dist < 34 && me.cooldowns[0] <= 0 && Math.random() < 0.6) {
          chosenMove = 0;
        }
        // 2. Mid/Long range Projectile (Move 2)
        else if (dist >= 40 && dist <= 145 && me.cooldowns[1] <= 0 && Math.random() < 0.5) {
          chosenMove = 1;
        }
        // 3. AoE Zone Attack (Move 3)
        else if (dist < 52 && me.cooldowns[2] <= 0 && Math.random() < 0.4) {
          chosenMove = 2;
        }
        // 4. Special / Rush Attack (Move 4)
        else if (dist < 65 && me.cooldowns[3] <= 0 && Math.random() < 0.35) {
          chosenMove = 3;
        }
      }

      if (chosenMove !== null) {
        if (chosenMove === 0) ctl.move1 = true;
        if (chosenMove === 1) ctl.move2 = true;
        if (chosenMove === 2) ctl.move3 = true;
        if (chosenMove === 3) ctl.move4 = true;

        this.botAttackTimer = 40 + Math.floor(Math.random() * 25);
      }
    }

    return ctl;
  }
}
