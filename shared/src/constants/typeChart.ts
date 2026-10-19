import type { TypeId, TypeMeta } from "../types/index.js";

export { type TypeId, type TypeMeta };

export const TYPE_META: Record<TypeId, TypeMeta> = {
  ember: {
    id: "ember",
    name: "Ember",
    color: "#f97316",
    darkColor: "#c2410c",
    badgeBg: "rgba(249, 115, 22, 0.2)",
  },
  tide: {
    id: "tide",
    name: "Tide",
    color: "#0ea5e9",
    darkColor: "#0369a1",
    badgeBg: "rgba(14, 165, 233, 0.2)",
  },
  gale: {
    id: "gale",
    name: "Gale",
    color: "#a855f7",
    darkColor: "#7e22ce",
    badgeBg: "rgba(168, 85, 247, 0.2)",
  },
  stone: {
    id: "stone",
    name: "Stone",
    color: "#a8a29e",
    darkColor: "#57534e",
    badgeBg: "rgba(168, 162, 158, 0.2)",
  },
  volt: {
    id: "volt",
    name: "Volt",
    color: "#eab308",
    darkColor: "#a16207",
    badgeBg: "rgba(234, 179, 8, 0.2)",
  },
  bloom: {
    id: "bloom",
    name: "Bloom",
    color: "#22c55e",
    darkColor: "#15803d",
    badgeBg: "rgba(34, 197, 94, 0.2)",
  },
};

/**
 * Effectiveness multipliers:
 * 1.5 = Super Effective
 * 0.7 = Resisted
 * 1.0 = Neutral
 */
export const TYPE_CHART: Record<TypeId, Partial<Record<TypeId, number>>> = {
  ember: {
    bloom: 1.5,
    stone: 1.5,
    tide: 0.7,
    ember: 0.7,
  },
  tide: {
    ember: 1.5,
    stone: 1.5,
    volt: 0.7,
    bloom: 0.7,
  },
  gale: {
    bloom: 1.5,
    volt: 1.5,
    stone: 0.7,
    gale: 0.7,
  },
  stone: {
    volt: 1.5,
    gale: 1.5,
    tide: 0.7,
    bloom: 0.7,
  },
  volt: {
    tide: 1.5,
    gale: 1.5,
    stone: 0.7,
    volt: 0.7,
  },
  bloom: {
    tide: 1.5,
    stone: 1.5,
    ember: 0.7,
    gale: 0.7,
  },
};

export function getTypeMultiplier(attackerType: TypeId, defenderType: TypeId): number {
  return TYPE_CHART[attackerType]?.[defenderType] ?? 1.0;
}
