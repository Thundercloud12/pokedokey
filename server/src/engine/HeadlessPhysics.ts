import { type Creature } from "../data/creatures.js";
import { MOVES } from "../data/moves.js";
import { HitboxManager, type HitResult, type TargetEntity } from "./Hitbox.js";
import {
  BattleState,
  HitboxSchema,
  ParticleSchema,
  PopupSchema,
} from "../rooms/schema/BattleState.js";

export type BattlePhase =
  | "waiting"
  | "ready"
  | "countdown"
  | "battle"
  | "round_end"
  | "match_over";

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
  cooldowns: [number, number, number, number];
  castT: number;
  hurtT: number;
  stunT: number;
  slowT: number;
  burnT: number;
  isKo: boolean;
  roundsWon: number;
}

export interface ArenaPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
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
const PW = 12;
const PH = 22;

export class HeadlessPhysics {
  readonly W: number;
  readonly H: number;
  readonly groundY: number;

  phase: BattlePhase = "waiting";
  leftState: CreatureState;
  rightState: CreatureState;

  hitboxMgr = new HitboxManager();
  particles: Particle[] = [];
  popups: DamagePopup[] = [];
  flash = { text: "", color: "#ffffff", t: 0 };

  platforms: ArenaPlatform[];

  p1Controls = emptyBattleControls();
  p2Controls = emptyBattleControls();
  private prevP1Controls = emptyBattleControls();
  private prevP2Controls = emptyBattleControls();

  currentRound = 1;
  phaseTimer = 0;
  shake = 0;
  frame = 0;

  constructor(
    W = 320,
    H = 170,
    creatureLeft: Creature,
    creatureRight: Creature
  ) {
    this.W = W;
    this.H = H;
    this.groundY = H - 28;

    this.platforms = [
      { x: Math.round(W / 2 - 28), y: this.groundY - 40, w: 56, h: 5 },
      { x: Math.round(W * 0.22 - 20), y: this.groundY - 22, w: 40, h: 5 },
      { x: Math.round(W * 0.78 - 20), y: this.groundY - 22, w: 40, h: 5 },
    ];

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

  setCreatures(creatureLeft: Creature, creatureRight: Creature) {
    this.leftState = this.makeCreatureState("left", creatureLeft);
    this.rightState = this.makeCreatureState("right", creatureRight);
    this.resetPositions();
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
  }

  step() {
    this.frame++;

    if (this.phase === "waiting") {
      return;
    }

    // 1. Countdown Phase
    if (this.phase === "countdown") {
      this.phaseTimer++;
      if (this.phaseTimer === 35) {
        this.flash = { text: "FIGHT!", color: "#4ade80", t: 30 };
        this.phase = "battle";
      }
      return;
    }

    // 2. Round End & Match Over
    if (this.phase === "round_end") {
      this.phaseTimer++;
      if (this.phaseTimer > 100) {
        if (this.leftState.roundsWon >= 2 || this.rightState.roundsWon >= 2) {
          this.phase = "match_over";
        } else {
          this.currentRound++;
          this.startRound();
        }
      }
    }

    // 3. Update Creatures (Movement, Gravity, Platforms, Attacks)
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

  private updateCreature(
    st: CreatureState,
    ctl: BattleControls,
    prevCtl: BattleControls
  ) {
    if (st.isKo) return;

    for (let i = 0; i < 4; i++) {
      if (st.cooldowns[i] > 0) st.cooldowns[i] -= 16.6;
    }
    if (st.castT > 0) st.castT--;
    if (st.hurtT > 0) st.hurtT--;
    if (st.stunT > 0) st.stunT--;
    if (st.slowT > 0) st.slowT--;

    if (st.burnT > 0) {
      st.burnT--;
      if (st.burnT % 60 === 0) {
        st.hp = Math.max(0, st.hp - 3);
        this.popups.push({
          x: st.x,
          y: st.y - 6,
          text: "-3",
          color: "#f97316",
          life: 30,
        });
        if (st.hp <= 0) this.knockout(st);
      }
    }

    const isStunned = st.stunT > 0;
    const isSlowed = st.slowT > 0;

    if (!isStunned && this.phase === "battle") {
      const dir = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
      const speed = st.creature.speed * (isSlowed ? 0.6 : 1.0);
      const targetVx = dir * speed;

      st.vx += (targetVx - st.vx) * (st.onGround ? 0.28 : 0.12);
      if (Math.abs(st.vx) < 0.05 && dir === 0) st.vx = 0;
      if (dir !== 0) st.facing = dir as 1 | -1;

      if (ctl.jump && st.onGround) {
        st.vy = st.creature.jumpPower;
        st.onGround = false;
      }

      if (ctl.move1 && !prevCtl.move1) this.castMove(st, 0);
      if (ctl.move2 && !prevCtl.move2) this.castMove(st, 1);
      if (ctl.move3 && !prevCtl.move3) this.castMove(st, 2);
      if (ctl.move4 && !prevCtl.move4) this.castMove(st, 3);
    }

    st.vy += GRAVITY;
    st.x += st.vx;
    st.y += st.vy;

    const minX = 8;
    const maxX = this.W - 8 - PW;
    st.x = Math.max(minX, Math.min(maxX, st.x));
    if (st.x === minX || st.x === maxX) st.vx = 0;

    let landed = false;
    const feetY = st.y + PH;

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

    if (move.shape === "melee") {
      st.vx += st.facing * 1.8;
    }

    this.hitboxMgr.spawn(st.side, move, st.x, st.y, st.facing);

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
    const target =
      hit.hitbox.casterSide === "left" ? this.rightState : this.leftState;
    if (target.isKo) return;

    target.hp = Math.max(0, target.hp - hit.damage);
    target.vx = hit.knockbackX;
    target.vy = hit.knockbackY;
    target.hurtT = 10;
    this.shake = Math.min(10, Math.round(hit.damage / 3));

    if (hit.statusEffect) {
      if (hit.statusEffect.kind === "stun")
        target.stunT = Math.round(hit.statusEffect.durationMs / 16.6);
      if (hit.statusEffect.kind === "slow")
        target.slowT = Math.round(hit.statusEffect.durationMs / 16.6);
      if (hit.statusEffect.kind === "burn")
        target.burnT = Math.round(hit.statusEffect.durationMs / 16.6);
    }

    const isCrit = hit.multiplier > 1.2;
    const txt = isCrit ? `${hit.damage}!` : `${hit.damage}`;
    const col = isCrit ? "#facc15" : "#ffffff";
    this.popups.push({
      x: target.x + 4,
      y: target.y - 4,
      text: txt,
      color: col,
      life: 35,
    });

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
  }

  syncToSchema(state: BattleState) {
    state.phase = this.phase;
    state.round = this.currentRound;
    state.shake = this.shake;

    // Left creature
    const l = state.left;
    const ls = this.leftState;
    l.side = "left";
    l.creatureId = ls.creature.id;
    l.x = ls.x;
    l.y = ls.y;
    l.vx = ls.vx;
    l.vy = ls.vy;
    l.facing = ls.facing;
    l.onGround = ls.onGround;
    l.anim = ls.anim;
    l.hp = ls.hp;
    l.maxHp = ls.maxHp;
    l.cd0 = Math.max(0, ls.cooldowns[0]);
    l.cd1 = Math.max(0, ls.cooldowns[1]);
    l.cd2 = Math.max(0, ls.cooldowns[2]);
    l.cd3 = Math.max(0, ls.cooldowns[3]);
    l.castT = ls.castT;
    l.hurtT = ls.hurtT;
    l.stunT = ls.stunT;
    l.slowT = ls.slowT;
    l.burnT = ls.burnT;
    l.isKo = ls.isKo;
    l.roundsWon = ls.roundsWon;

    // Right creature
    const r = state.right;
    const rs = this.rightState;
    r.side = "right";
    r.creatureId = rs.creature.id;
    r.x = rs.x;
    r.y = rs.y;
    r.vx = rs.vx;
    r.vy = rs.vy;
    r.facing = rs.facing;
    r.onGround = rs.onGround;
    r.anim = rs.anim;
    r.hp = rs.hp;
    r.maxHp = rs.maxHp;
    r.cd0 = Math.max(0, rs.cooldowns[0]);
    r.cd1 = Math.max(0, rs.cooldowns[1]);
    r.cd2 = Math.max(0, rs.cooldowns[2]);
    r.cd3 = Math.max(0, rs.cooldowns[3]);
    r.castT = rs.castT;
    r.hurtT = rs.hurtT;
    r.stunT = rs.stunT;
    r.slowT = rs.slowT;
    r.burnT = rs.burnT;
    r.isKo = rs.isKo;
    r.roundsWon = rs.roundsWon;

    // Flash
    state.flash.text = this.flash.text;
    state.flash.color = this.flash.color;
    state.flash.t = this.flash.t;

    // Hitboxes
    const activeHb = this.hitboxMgr.hitboxes;
    while (state.hitboxes.length > activeHb.length) {
      state.hitboxes.pop();
    }
    for (let i = 0; i < activeHb.length; i++) {
      const hb = activeHb[i];
      let target = state.hitboxes[i];
      if (!target) {
        target = new HitboxSchema();
        state.hitboxes.push(target);
      }
      target.id = hb.id;
      target.x = hb.x;
      target.y = hb.y;
      target.radius = hb.radius;
      target.shape = hb.move.shape;
      target.color = hb.color;
    }

    // Particles (sample up to 24 for delta bandwidth conservation)
    const sampledParticles = this.particles.slice(0, 24);
    while (state.particles.length > sampledParticles.length) {
      state.particles.pop();
    }
    for (let i = 0; i < sampledParticles.length; i++) {
      const p = sampledParticles[i];
      let target = state.particles[i];
      if (!target) {
        target = new ParticleSchema();
        state.particles.push(target);
      }
      target.x = p.x;
      target.y = p.y;
      target.color = p.color;
    }

    // Popups
    while (state.popups.length > this.popups.length) {
      state.popups.pop();
    }
    for (let i = 0; i < this.popups.length; i++) {
      const pop = this.popups[i];
      let target = state.popups[i];
      if (!target) {
        target = new PopupSchema();
        state.popups.push(target);
      }
      target.x = pop.x;
      target.y = pop.y;
      target.text = pop.text;
      target.color = pop.color;
    }
  }
}
