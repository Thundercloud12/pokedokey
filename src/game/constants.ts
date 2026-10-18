/**
 * Dimensions and tuning parameters for the 3D Pixel FPS Football Game.
 */

export const PITCH = {
  width: 38, // X-axis (left-to-right sideline)
  length: 68, // Z-axis (endline to endline)
  wallHeight: 5,
  linePadX: 2.5,
  linePadZ: 3.5,
};

export const GOAL = {
  width: 9,
  height: 3.4,
  depth: 3.5,
  postRadius: 0.12,
  // Z coordinates of the goal lines
  northZ: -PITCH.length / 2 + PITCH.linePadZ, // Blue defends North
  southZ: PITCH.length / 2 - PITCH.linePadZ,  // Red defends South
};

export const BALL_CONFIG = {
  radius: 0.42,
  mass: 0.45,
  damping: 0.25,
  restitution: 0.72,
  friction: 0.4,
};

export const PLAYER_CONFIG = {
  radius: 0.55,
  height: 1.8,
  eyeHeight: 1.62,
  mass: 75,
  walkSpeed: 10,
  sprintSpeed: 15,
  jumpSpeed: 7.2,
  kickReach: 2.2, // Max distance from player feet to ball to register a kick
  dribbleReach: 1.3,
  kickMinPower: 14,
  kickMaxPower: 34,
  maxChargeTimeMs: 900,
};

export const TEAMS = {
  red: {
    id: "red" as const,
    name: "RED DEVILS",
    shirt: "#ef4444",
    shirtDark: "#b91c1c",
    shorts: "#f8fafc",
    socks: "#ef4444",
    boots: "#111827",
    skin: "#e8b48f",
    accent: "#ffffff",
    spawnZ: 14, // Starts on South side, attacks North
    goalZ: GOAL.southZ,
    targetGoalZ: GOAL.northZ,
  },
  blue: {
    id: "blue" as const,
    name: "BLUE METEORS",
    shirt: "#2563eb",
    shirtDark: "#1d4ed8",
    shorts: "#0f172a",
    socks: "#2563eb",
    boots: "#05070d",
    skin: "#d9a07a",
    accent: "#facc15",
    spawnZ: -14, // Starts on North side, attacks South
    goalZ: GOAL.northZ,
    targetGoalZ: GOAL.southZ,
  },
};

export type TeamId = keyof typeof TEAMS;
export const WIN_SCORE = 3;
