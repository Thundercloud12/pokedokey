import { Schema, type, ArraySchema } from "@colyseus/schema";

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
  @type("string") phase: string = "waiting"; // "waiting" | "countdown" | "battle" | "round_end" | "match_over"
  @type("number") round: number = 1;
  @type("number") shake: number = 0;
  @type(CreatureSchema) left: CreatureSchema = new CreatureSchema();
  @type(CreatureSchema) right: CreatureSchema = new CreatureSchema();
  @type([HitboxSchema]) hitboxes: ArraySchema<HitboxSchema> = new ArraySchema<HitboxSchema>();
  @type([ParticleSchema]) particles: ArraySchema<ParticleSchema> = new ArraySchema<ParticleSchema>();
  @type([PopupSchema]) popups: ArraySchema<PopupSchema> = new ArraySchema<PopupSchema>();
  @type(FlashSchema) flash: FlashSchema = new FlashSchema();
}
