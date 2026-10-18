import { type TypeId } from "./typeChart.js";

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
  speed: number; // Base horizontal run speed (around 1.4 - 1.8)
  jumpPower: number; // Base jump velocity (around -4.8 - -5.5)
  weight: number; // Knockback dampener (0.8 = light, 1.3 = heavy tank)
  moves: [string, string, string, string];
  palette: CreaturePalette;
  description: string;
}

export const CREATURES: Creature[] = [
  {
    id: "pyrokid",
    name: "Pyrokid",
    title: "The Cinder Imp",
    type: "ember",
    maxHp: 100,
    speed: 1.6,
    jumpPower: -5.2,
    weight: 0.95,
    moves: ["flame_jab", "cinder_bolt", "inferno_burst", "flare_rush"],
    palette: {
      body: "#ea580c",
      bodyDark: "#9a3412",
      accent: "#facc15",
      eye: "#ffffff",
      limb: "#fb923c",
      limbDark: "#7c2d12",
    },
    description: "Fiery fighter who dashes with burning punches and explosive infernos.",
  },
  {
    id: "aquanaut",
    name: "Aquanaut",
    title: "The Ocean Diver",
    type: "tide",
    maxHp: 110,
    speed: 1.5,
    jumpPower: -5.0,
    weight: 1.05,
    moves: ["aqua_cutter", "bubble_barrage", "tidal_surge", "whirlpool_snap"],
    palette: {
      body: "#0284c7",
      bodyDark: "#075985",
      accent: "#38bdf8",
      eye: "#ffffff",
      limb: "#0ea5e9",
      limbDark: "#0c4a6e",
    },
    description: "Balanced aquatic combatant who slows foes and summons roaring geysers.",
  },
  {
    id: "zephyros",
    name: "Zephyros",
    title: "The Cloud Falcon",
    type: "gale",
    maxHp: 90,
    speed: 1.85,
    jumpPower: -5.6,
    weight: 0.8,
    moves: ["wind_slash", "cyclone_orb", "tempest_howl", "aerial_dive"],
    palette: {
      body: "#9333ea",
      bodyDark: "#6b21a8",
      accent: "#e9d5ff",
      eye: "#fde047",
      limb: "#a855f7",
      limbDark: "#581c87",
    },
    description: "Lightning-fast aerial master with high jumps and gusting shockwaves.",
  },
  {
    id: "golex",
    name: "Golex",
    title: "The Granite Sentinel",
    type: "stone",
    maxHp: 135,
    speed: 1.25,
    jumpPower: -4.7,
    weight: 1.35,
    moves: ["rock_slam", "boulder_toss", "quake_pulse", "stone_guard"],
    palette: {
      body: "#78716c",
      bodyDark: "#44403c",
      accent: "#d6d3d1",
      eye: "#f97316",
      limb: "#a8a29e",
      limbDark: "#292524",
    },
    description: "Unyielding stone behemoth who absorbs heavy hits and shatters the floor.",
  },
  {
    id: "voltix",
    name: "Voltix",
    title: "The Spark Runner",
    type: "volt",
    maxHp: 95,
    speed: 1.8,
    jumpPower: -5.3,
    weight: 0.85,
    moves: ["spark_claw", "chain_lightning", "thunder_dome", "volt_dash"],
    palette: {
      body: "#eab308",
      bodyDark: "#a16207",
      accent: "#fef08a",
      eye: "#1e1b4b",
      limb: "#fde047",
      limbDark: "#713f12",
    },
    description: "Electrifying rushdown battler who stuns enemies with high-speed rays.",
  },
  {
    id: "flora",
    name: "Flora",
    title: "The Thorny Sprout",
    type: "bloom",
    maxHp: 115,
    speed: 1.45,
    jumpPower: -5.1,
    weight: 1.1,
    moves: ["thorn_whip", "seed_burst", "spore_cloud", "bramble_root"],
    palette: {
      body: "#16a34a",
      bodyDark: "#14532d",
      accent: "#bbf7d0",
      eye: "#ffffff",
      limb: "#22c55e",
      limbDark: "#052e16",
    },
    description: "Botanical warrior who traps opponents with thorny vines and paralyzing spores.",
  },
];

export const CREATURE_MAP: Record<string, Creature> = Object.fromEntries(
  CREATURES.map((c) => [c.id, c])
);
