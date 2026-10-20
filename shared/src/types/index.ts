export type TypeId = "ember" | "tide" | "gale" | "stone" | "volt" | "bloom";

export interface TypeMeta {
  id: TypeId;
  name: string;
  color: string;
  darkColor: string;
  badgeBg: string;
}

export type MoveShape = "melee" | "projectile" | "aoe";
export type StatusKind = "stun" | "slow" | "burn";

export interface StatusEffect {
  kind: StatusKind;
  durationMs: number;
}

export interface Move {
  id: string;
  name: string;
  type: TypeId;
  power: number;
  shape: MoveShape;
  range: number;
  speed: number;
  cooldownMs: number;
  windupFrames: number;
  durationFrames: number;
  knockback: number;
  statusEffect?: StatusEffect;
  description: string;
  color: string;
}

export interface CreaturePalette {
  body: string;
  bodyDark: string;
  accent: string;
  eye: string;
  limb: string;
  limbDark: string;
}

export interface Creature {
  id: string;
  name: string;
  title: string;
  type: TypeId;
  maxHp: number;
  speed: number;
  jumpPower: number;
  weight: number;
  moves: [string, string, string, string];
  palette: CreaturePalette;
  description: string;
}

export type BattlePhase =
  | "waiting"
  | "lobby"
  | "ready"
  | "countdown"
  | "battle"
  | "round_end"
  | "match_over";

export type PlayMode = "solo" | "online";

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

export interface FlashText {
  text: string;
  color: string;
  t: number;
}

export interface HitboxSnapshot {
  x: number;
  y: number;
  radius: number;
  shape: string;
  color: string;
}

export interface WorldSnapshot {
  frame: number;
  phase: BattlePhase;
  round: number;
  left: Omit<CreatureState, "creature" | "side">;
  right: Omit<CreatureState, "creature" | "side">;
  hitboxes: HitboxSnapshot[];
  particles: { x: number; y: number; color: string }[];
  popups: { x: number; y: number; text: string; color: string }[];
  flash: FlashText;
  shake: number;
}
