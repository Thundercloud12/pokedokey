import { Schema, type, ArraySchema } from "@colyseus/schema";
import type { SimulationCore } from "@game/shared";

export class CreatureSchema extends Schema {
  @type("string") side: string = "left";
  @type("string") creatureId: string = "pyrokid";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("number") facing: number = 1;
  @type("boolean") onGround: boolean = true;
  @type("number") anim: number = 0;
  @type("number") hp: number = 100;
  @type("number") maxHp: number = 100;
  @type("number") cd0: number = 0;
  @type("number") cd1: number = 0;
  @type("number") cd2: number = 0;
  @type("number") cd3: number = 0;
  @type("number") castT: number = 0;
  @type("number") hurtT: number = 0;
  @type("number") stunT: number = 0;
  @type("number") slowT: number = 0;
  @type("number") burnT: number = 0;
  @type("boolean") isKo: boolean = false;
  @type("number") roundsWon: number = 0;
}

export class HitboxSchema extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") radius: number = 0;
  @type("string") shape: string = "melee";
  @type("string") color: string = "#ffffff";
}

export class ParticleSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") color: string = "#ffffff";
}

export class PopupSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") text: string = "";
  @type("string") color: string = "#ffffff";
}

export class FlashSchema extends Schema {
  @type("string") text: string = "";
  @type("string") color: string = "#ffffff";
  @type("number") t: number = 0;
}

export class BattleState extends Schema {
  @type("string") phase: string = "waiting"; // "waiting" | "lobby" | "countdown" | "battle" | "round_end" | "match_over"
  @type("number") round: number = 1;
  @type("number") shake: number = 0;

  // Online Connection & Pre-match Lobby state
  @type("boolean") p1Connected: boolean = true;
  @type("boolean") p2Connected: boolean = false;
  @type("boolean") p1Ready: boolean = false;
  @type("boolean") p2Ready: boolean = false;
  @type("string") p1CreatureId: string = "pyrokid";
  @type("string") p2CreatureId: string = "aquanaut";
  @type("number") lobbyCountdown: number = -1; // -1 when inactive; 3, 2, 1 when launching

  @type(CreatureSchema) left: CreatureSchema = new CreatureSchema();
  @type(CreatureSchema) right: CreatureSchema = new CreatureSchema();
  @type([HitboxSchema]) hitboxes: ArraySchema<HitboxSchema> = new ArraySchema<HitboxSchema>();
  @type([ParticleSchema]) particles: ArraySchema<ParticleSchema> = new ArraySchema<ParticleSchema>();
  @type([PopupSchema]) popups: ArraySchema<PopupSchema> = new ArraySchema<PopupSchema>();
  @type(FlashSchema) flash: FlashSchema = new FlashSchema();
}

export function syncSimulationToSchema(sim: SimulationCore, state: BattleState) {
  if (state.phase !== "waiting" && state.phase !== "lobby") {
    state.phase = sim.phase;
  }
  state.round = sim.currentRound;
  state.shake = sim.shake;

  // Left creature
  const l = state.left;
  const ls = sim.leftState;
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
  const rs = sim.rightState;
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
  state.flash.text = sim.flash.text;
  state.flash.color = sim.flash.color;
  state.flash.t = sim.flash.t;

  // Hitboxes
  const activeHb = sim.hitboxMgr.hitboxes;
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
  const sampledParticles = sim.particles.slice(0, 24);
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
  while (state.popups.length > sim.popups.length) {
    state.popups.pop();
  }
  for (let i = 0; i < sim.popups.length; i++) {
    const pop = sim.popups[i];
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
