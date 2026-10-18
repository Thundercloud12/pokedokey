import { type Creature } from "../data/creatures";
import { MOVES } from "../data/moves";
import { HitboxManager, type HitResult, type TargetEntity } from "./Hitbox";
import { generateArenaBackground, type ArenaPlatform } from "../render/ArenaBackground";
import { drawCreature } from "../render/CreatureSprite";
import { sound } from "../audio/Sound";
import { type WorldSnapshot } from "../net/TrysteroRoom";

export type BattlePhase = "ready" | "countdown" | "battle" | "round_end" | "match_over";

export interface BattleControls {
  left: boolean;
  right: boolean;
  jump: boolean;
  move1: boolean;
  move2: boolean;
  move3: boolean;
  move4: boolean;
}

export const emptyBattleControls = (): BattleControls => ({
  left: false,
  right: false,
  jump: false,
  move1: false,
  move2: false,
  move3: false,
  move4: false,
});

export interface CreatureState {
  side: "left" | "right";
  creature: Creature;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  anim: number;
  hp: number;
  maxHp: number;
  cooldowns: [number, number, number, number]; // in ms
  castT: number;
  hurtT: number;
  stunT: number;
  slowT: number;
  burnT: number;
  isKo: boolean;
  roundsWon: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface DamagePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const GRAVITY = 0.34;
const PW = 12; // creature hitbox width
const PH = 22; // creature hitbox height

export class PhysicsEngine {
  readonly W: number;
  readonly H: number;
  readonly groundY: number;

  phase: BattlePhase = "ready";
  leftState: CreatureState;
  rightState: CreatureState;

  hitboxMgr = new HitboxManager();
  particles: Particle[] = [];
  popups: DamagePopup[] = [];
  flash = { text: "", color: "#ffffff", t: 0 };

  platforms: ArenaPlatform[] = [];
  private bgCanvas: HTMLCanvasElement;

  private p1Controls = emptyBattleControls();
  private p2Controls = emptyBattleControls();
  private prevP1Controls = emptyBattleControls();
  private prevP2Controls = emptyBattleControls();

  currentRound = 1;
  roundTimer = 0;
  phaseTimer = 0;
  shake = 0;
  frame = 0;
  isAiBot = true;
  private botAttackTimer = 0;

  onPhaseChange?: (phase: BattlePhase) => void;

  constructor(
    W: number,
    H: number,
    creatureLeft: Creature,
    creatureRight: Creature,
    isAiBot = true
  ) {
    this.W = W;
    this.H = H;
    this.groundY = H - 28;
    this.isAiBot = isAiBot;

    const arena = generateArenaBackground(W, H, this.groundY);
    this.bgCanvas = arena.canvas;
    this.platforms = arena.platforms;

    this.leftState = this.makeCreatureState("left", creatureLeft);
    this.rightState = this.makeCreatureState("right", creatureRight);

    this.resetPositions();
  }

  private makeCreatureState(side: "left" | "right", c: Creature): CreatureState {
    return {
      side,
      creature: c,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facing: side === "left" ? 1 : -1,
      onGround: true,
      anim: 0,
      hp: c.maxHp,
      maxHp: c.maxHp,
      cooldowns: [0, 0, 0, 0],
      castT: 0,
      hurtT: 0,
      stunT: 0,
      slowT: 0,
      burnT: 0,
      isKo: false,
      roundsWon: 0,
    };
  }

  setControls(p1: BattleControls, p2?: BattleControls) {
    this.p1Controls = p1;
    if (p2) this.p2Controls = p2;
  }

  startMatch() {
    this.currentRound = 1;
    this.leftState.roundsWon = 0;
    this.rightState.roundsWon = 0;
    this.startRound();
  }

  startRound() {
    this.phase = "countdown";
    this.phaseTimer = 0;
    this.resetPositions();
    this.hitboxMgr.clear();
    this.flash = { text: `ROUND ${this.currentRound}`, color: "#facc15", t: 40 };
    sound.tick();
    this.onPhaseChange?.(this.phase);
  }

  private resetPositions() {
    this.leftState.x = this.W * 0.22 - PW / 2;
    this.leftState.y = this.groundY - PH;
    this.leftState.vx = 0;
    this.leftState.vy = 0;
    this.leftState.facing = 1;
    this.leftState.onGround = true;
    this.leftState.hp = this.leftState.maxHp;
    this.leftState.isKo = false;
    this.leftState.stunT = 0;
    this.leftState.slowT = 0;
    this.leftState.burnT = 0;
    this.leftState.cooldowns = [0, 0, 0, 0];

    this.rightState.x = this.W * 0.78 - PW / 2;
    this.rightState.y = this.groundY - PH;
    this.rightState.vx = 0;
    this.rightState.vy = 0;
    this.rightState.facing = -1;
    this.rightState.onGround = true;
    this.rightState.hp = this.rightState.maxHp;
    this.rightState.isKo = false;
    this.rightState.stunT = 0;
    this.rightState.slowT = 0;
    this.rightState.burnT = 0;
    this.rightState.cooldowns = [0, 0, 0, 0];
    this.botAttackTimer = 30;
  }

  setCreatures(creatureLeft: Creature, creatureRight: Creature) {
    this.leftState = this.makeCreatureState("left", creatureLeft);
    this.rightState = this.makeCreatureState("right", creatureRight);
    this.resetPositions();
  }

  getSnapshot() {
    return {
      phase: this.phase,
      round: this.currentRound,
      left: { ...this.leftState, cooldowns: [...this.leftState.cooldowns] as [number, number, number, number] },
      right: { ...this.rightState, cooldowns: [...this.rightState.cooldowns] as [number, number, number, number] },
    };
  }

  step() {
    this.frame++;

    // 1. Countdown Phase
    if (this.phase === "countdown") {
      this.phaseTimer++;
      if (this.phaseTimer === 35) {
        this.flash = { text: "FIGHT!", color: "#4ade80", t: 30 };
        sound.go();
        this.phase = "battle";
        this.onPhaseChange?.(this.phase);
      }
      return;
    }

    // 2. Round End & Match Over
    if (this.phase === "round_end") {
      this.phaseTimer++;
      if (this.phaseTimer > 100) {
        if (this.leftState.roundsWon >= 2 || this.rightState.roundsWon >= 2) {
          this.phase = "match_over";
          sound.matchWin();
          this.onPhaseChange?.(this.phase);
        } else {
          this.currentRound++;
          this.startRound();
        }
      }
    }

    // AI inputs if playing solo
    if (this.isAiBot && this.phase === "battle") {
      this.computeBotActions();
    }

    // 3. Update Creatures (Movement, Gravity, Platform Collisions, Casting)
    this.updateCreature(this.leftState, this.p1Controls, this.prevP1Controls);
    this.updateCreature(this.rightState, this.p2Controls, this.prevP2Controls);

    this.prevP1Controls = { ...this.p1Controls };
    this.prevP2Controls = { ...this.p2Controls };

    // 4. Update Hitboxes & Resolve Damage
    if (this.phase === "battle") {
      const targets: TargetEntity[] = [
        {
          side: "left",
          x: this.leftState.x,
          y: this.leftState.y,
          w: PW,
          h: PH,
          creature: this.leftState.creature,
        },
        {
          side: "right",
          x: this.rightState.x,
          y: this.rightState.y,
          w: PW,
          h: PH,
          creature: this.rightState.creature,
        },
      ];

      this.hitboxMgr.update(targets, (hit) => this.handleHit(hit));
    }

    // 5. Update Particles & Popups
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const pop of this.popups) {
      pop.y -= 0.4;
      pop.life--;
    }
    this.popups = this.popups.filter((pop) => pop.life > 0);

    if (this.flash.t > 0) this.flash.t--;
    if (this.shake > 0) this.shake--;
  }

  private updateCreature(st: CreatureState, ctl: BattleControls, prevCtl: BattleControls) {
    if (st.isKo) return;

    // Decrement Cooldowns & Status timers
    for (let i = 0; i < 4; i++) {
      if (st.cooldowns[i] > 0) st.cooldowns[i] -= 16.6;
    }
    if (st.castT > 0) st.castT--;
    if (st.hurtT > 0) st.hurtT--;
    if (st.stunT > 0) st.stunT--;
    if (st.slowT > 0) st.slowT--;

    // Burn ticking damage
    if (st.burnT > 0) {
      st.burnT--;
      if (st.burnT % 60 === 0) {
        st.hp = Math.max(0, st.hp - 3);
        this.popups.push({ x: st.x, y: st.y - 6, text: "-3", color: "#f97316", life: 30 });
        if (st.hp <= 0) this.knockout(st);
      }
    }

    const isStunned = st.stunT > 0;
    const isSlowed = st.slowT > 0;

    if (!isStunned && this.phase === "battle") {
      // Horizontal run
      const dir = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
      const speed = st.creature.speed * (isSlowed ? 0.6 : 1.0);
      const targetVx = dir * speed;

      st.vx += (targetVx - st.vx) * (st.onGround ? 0.28 : 0.12);
      if (Math.abs(st.vx) < 0.05 && dir === 0) st.vx = 0;
      if (dir !== 0) st.facing = dir as 1 | -1;

      // Jump
      if (ctl.jump && st.onGround) {
        st.vy = st.creature.jumpPower;
        st.onGround = false;
        sound.jump();
      }

      // Moves 1-4 triggers (on key down press)
      if (ctl.move1 && !prevCtl.move1) this.castMove(st, 0);
      if (ctl.move2 && !prevCtl.move2) this.castMove(st, 1);
      if (ctl.move3 && !prevCtl.move3) this.castMove(st, 2);
      if (ctl.move4 && !prevCtl.move4) this.castMove(st, 3);
    }

    // Apply gravity
    st.vy += GRAVITY;
    st.x += st.vx;
    st.y += st.vy;

    // Arena walls bounds
    const minX = 8;
    const maxX = this.W - 8 - PW;
    st.x = Math.max(minX, Math.min(maxX, st.x));
    if (st.x === minX || st.x === maxX) st.vx = 0;

    // Platform & Ground collisions
    let landed = false;
    const feetY = st.y + PH;

    // Check floating platforms (one-way pass through jumping up)
    if (st.vy >= 0) {
      for (const plat of this.platforms) {
        const platLeft = plat.x - PW + 2;
        const platRight = plat.x + plat.w - 2;
        if (st.x >= platLeft && st.x <= platRight) {
          if (feetY >= plat.y && feetY - st.vy <= plat.y + 4) {
            st.y = plat.y - PH;
            st.vy = 0;
            landed = true;
            break;
          }
        }
      }
    }

    // Arena Ground
    if (!landed && feetY >= this.groundY) {
      st.y = this.groundY - PH;
      st.vy = 0;
      landed = true;
    }

    st.onGround = landed;
    st.anim += Math.abs(st.vx);
  }

  private castMove(st: CreatureState, slot: number) {
    if (st.cooldowns[slot] > 0) return;
    if (st.castT > 0 || st.hurtT > 0) return;

    const moveId = st.creature.moves[slot];
    const move = MOVES[moveId];
    if (!move) return;

    st.cooldowns[slot] = move.cooldownMs;
    st.castT = Math.max(14, move.windupFrames + move.durationFrames);

    // Lunge forward slightly on melee attacks
    if (move.shape === "melee") {
      st.vx += st.facing * 1.8;
    }

    // Spawn ability hitbox
    this.hitboxMgr.spawn(st.side, move, st.x, st.y, st.facing);
    sound.cast(move.type);

    // Cast burst particles
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: st.x + (st.facing > 0 ? PW : 0),
        y: st.y + 10,
        vx: (Math.random() - 0.5) * 2 + st.facing * 1.5,
        vy: (Math.random() - 0.5) * 2,
        life: 15,
        color: move.color,
      });
    }
  }

  private handleHit(hit: HitResult) {
    const target = hit.hitbox.casterSide === "left" ? this.rightState : this.leftState;
    if (target.isKo) return;

    target.hp = Math.max(0, target.hp - hit.damage);
    target.vx = hit.knockbackX;
    target.vy = hit.knockbackY;
    target.hurtT = 10;
    this.shake = Math.min(10, Math.round(hit.damage / 3));

    // Status effect
    if (hit.statusEffect) {
      if (hit.statusEffect.kind === "stun") target.stunT = Math.round(hit.statusEffect.durationMs / 16.6);
      if (hit.statusEffect.kind === "slow") target.slowT = Math.round(hit.statusEffect.durationMs / 16.6);
      if (hit.statusEffect.kind === "burn") target.burnT = Math.round(hit.statusEffect.durationMs / 16.6);
    }

    sound.hit(hit.multiplier);

    // Damage Popup
    const isCrit = hit.multiplier > 1.2;
    const txt = isCrit ? `${hit.damage}!` : `${hit.damage}`;
    const col = isCrit ? "#facc15" : "#ffffff";
    this.popups.push({ x: target.x + 4, y: target.y - 4, text: txt, color: col, life: 35 });

    // Impact Sparks
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: hit.hitX,
        y: hit.hitY,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 18 + Math.random() * 10,
        color: hit.hitbox.color,
      });
    }

    if (target.hp <= 0) {
      this.knockout(target);
    }
  }

  private knockout(victim: CreatureState) {
    victim.isKo = true;
    this.phase = "round_end";
    this.phaseTimer = 0;

    const winner = victim.side === "left" ? this.rightState : this.leftState;
    winner.roundsWon++;

    this.flash = {
      text: `${winner.creature.name.toUpperCase()} WINS ROUND!`,
      color: "#facc15",
      t: 80,
    };
    sound.ko();
    this.onPhaseChange?.(this.phase);
  }

  private computeBotActions() {
    const me = this.rightState;
    const opp = this.leftState;
    const dx = opp.x - me.x;
    const dist = Math.abs(dx);

    // Reset bot attack triggers by default every frame
    this.p2Controls.move1 = false;
    this.p2Controls.move2 = false;
    this.p2Controls.move3 = false;
    this.p2Controls.move4 = false;

    // Tick down bot attack pacing timer
    if (this.botAttackTimer > 0) {
      this.botAttackTimer--;
    }

    // Aim face towards opponent
    if (Math.abs(dx) > 6) {
      me.facing = dx > 0 ? 1 : -1;
    }

    // If bot is currently executing an attack or in hitstun/stun, don't initiate actions
    if (me.castT > 0 || me.hurtT > 0 || me.stunT > 0) {
      this.p2Controls.left = false;
      this.p2Controls.right = false;
      this.p2Controls.jump = false;
      return;
    }

    // Movement Pacing & Spacing:
    // If bot attacked recently, enter recovery / repositioning phase
    if (this.botAttackTimer > 15) {
      // Back off slightly to give the human player breathing room and a clear opening
      if (dist < 60) {
        this.p2Controls.left = dx > 0;
        this.p2Controls.right = dx < 0;
      } else {
        this.p2Controls.left = false;
        this.p2Controls.right = false;
      }
      return;
    }

    // Normal approach spacing
    if (dist > 75) {
      this.p2Controls.left = dx < 0;
      this.p2Controls.right = dx > 0;
    } else if (dist < 32) {
      this.p2Controls.left = dx > 0;
      this.p2Controls.right = dx < 0;
    } else {
      this.p2Controls.left = false;
      this.p2Controls.right = false;
    }

    // Jump if opponent is on a platform above
    this.p2Controls.jump = opp.y < me.y - 15 && Math.random() < 0.04 && me.onGround;

    // Only attack when botAttackTimer has fully elapsed (human-like pacing)
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
        if (chosenMove === 0) this.p2Controls.move1 = true;
        if (chosenMove === 1) this.p2Controls.move2 = true;
        if (chosenMove === 2) this.p2Controls.move3 = true;
        if (chosenMove === 3) this.p2Controls.move4 = true;

        // Human-like attack pacing cooldown: 45-70 frames (~0.75 - 1.15 seconds)
        this.botAttackTimer = 45 + Math.floor(Math.random() * 25);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(
        Math.round((Math.random() - 0.5) * 3),
        Math.round((Math.random() - 0.5) * 3)
      );
    }

    // 1. Draw Arena Background
    ctx.drawImage(this.bgCanvas, 0, 0);

    // 2. Creature Shadows
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (const st of [this.leftState, this.rightState]) {
      const sw = Math.round(12 - Math.min(6, (this.groundY - st.y - PH) / 10));
      ctx.fillRect(Math.round(st.x + PW / 2 - sw / 2), this.groundY, sw, 2);
    }

    // 3. Draw Creatures
    drawCreature(ctx, this.leftState.creature, {
      x: this.leftState.x,
      y: this.leftState.y,
      facing: this.leftState.facing,
      vx: this.leftState.vx,
      onGround: this.leftState.onGround,
      anim: this.leftState.anim,
      castT: this.leftState.castT,
      hurtT: this.leftState.hurtT,
      isKo: this.leftState.isKo,
    });

    drawCreature(ctx, this.rightState.creature, {
      x: this.rightState.x,
      y: this.rightState.y,
      facing: this.rightState.facing,
      vx: this.rightState.vx,
      onGround: this.rightState.onGround,
      anim: this.rightState.anim,
      castT: this.rightState.castT,
      hurtT: this.rightState.hurtT,
      isKo: this.rightState.isKo,
    });

    // 4. Draw Active Hitboxes
    for (const hb of this.hitboxMgr.hitboxes) {
      ctx.fillStyle = hb.color;
      if (hb.move.shape === "projectile") {
        ctx.fillRect(Math.round(hb.x - 3), Math.round(hb.y - 3), 6, 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(hb.x - 1), Math.round(hb.y - 1), 2, 2);
      } else if (hb.move.shape === "aoe") {
        ctx.strokeStyle = hb.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hb.x, hb.y, hb.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Melee slash arc
        ctx.fillRect(Math.round(hb.x - hb.radius), Math.round(hb.y - hb.radius), hb.radius * 2, hb.radius * 2);
      }
    }

    // 5. Draw Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }

    // 6. Draw Damage Popups
    for (const pop of this.popups) {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 9px monospace";
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }

    // 7. Flash Text Announcement
    if (this.flash.t > 0) {
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#000000";
      ctx.fillText(this.flash.text, this.W / 2 + 1, this.H * 0.35 + 1);
      ctx.fillStyle = this.flash.color;
      ctx.fillText(this.flash.text, this.W / 2, this.H * 0.35);
      ctx.textAlign = "left";
    }

    ctx.restore();
  }

  getWorldSnapshot(): WorldSnapshot {
    return {
      frame: this.frame,
      phase: this.phase,
      round: this.currentRound,
      left: {
        x: this.leftState.x,
        y: this.leftState.y,
        vx: this.leftState.vx,
        vy: this.leftState.vy,
        facing: this.leftState.facing,
        onGround: this.leftState.onGround,
        anim: this.leftState.anim,
        hp: this.leftState.hp,
        maxHp: this.leftState.maxHp,
        cooldowns: [...this.leftState.cooldowns] as [number, number, number, number],
        castT: this.leftState.castT,
        hurtT: this.leftState.hurtT,
        stunT: this.leftState.stunT,
        slowT: this.leftState.slowT,
        burnT: this.leftState.burnT,
        isKo: this.leftState.isKo,
        roundsWon: this.leftState.roundsWon,
      },
      right: {
        x: this.rightState.x,
        y: this.rightState.y,
        vx: this.rightState.vx,
        vy: this.rightState.vy,
        facing: this.rightState.facing,
        onGround: this.rightState.onGround,
        anim: this.rightState.anim,
        hp: this.rightState.hp,
        maxHp: this.rightState.maxHp,
        cooldowns: [...this.rightState.cooldowns] as [number, number, number, number],
        castT: this.rightState.castT,
        hurtT: this.rightState.hurtT,
        stunT: this.rightState.stunT,
        slowT: this.rightState.slowT,
        burnT: this.rightState.burnT,
        isKo: this.rightState.isKo,
        roundsWon: this.rightState.roundsWon,
      },
      hitboxes: this.hitboxMgr.hitboxes.map((h) => ({
        x: h.x,
        y: h.y,
        radius: h.radius,
        shape: h.move.shape,
        color: h.color,
      })),
      particles: this.particles.map((p) => ({ x: p.x, y: p.y, color: p.color })),
      popups: this.popups.map((p) => ({ x: p.x, y: p.y, text: p.text, color: p.color })),
      flash: { ...this.flash },
      shake: this.shake,
    };
  }

  renderSnapshot(ctx: CanvasRenderingContext2D, snap: WorldSnapshot) {
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
    drawCreature(ctx, this.leftState.creature, {
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

    drawCreature(ctx, this.rightState.creature, {
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
        ctx.fillRect(Math.round(hb.x - hb.radius), Math.round(hb.y - hb.radius), hb.radius * 2, hb.radius * 2);
      }
    }

    // 5. Draw Particles
    for (const p of snap.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }

    // 6. Draw Damage Popups
    for (const pop of snap.popups) {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 9px monospace";
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }

    // 7. Flash Text Announcement
    if (snap.flash.t > 0) {
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
