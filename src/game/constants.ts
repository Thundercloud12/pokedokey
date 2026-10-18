/**
 * Dimensions and tuning parameters for the 3D Pixel Football Game.
 */

export const PITCH = {
  width: 36, // X-axis (left-to-right sideline)
  length: 64, // Z-axis (endline to endline)
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
  damping: 0.28,
  angularDamping: 0.35,
  restitution: 0.65,
  friction: 0.45,
};

export const DRIBBLE_CONFIG = {
  captureRadius: 2.2, // Proximity within which soft magnetic dribble activates
  targetOffset: 1.25, // Distance ahead of player feet while walking
  sprintOffset: 1.85, // Distance ahead while sprinting (heavier touch)
  smoothFactor: 14.0, // Lerp smoothing factor for natural ball roll
  kickCooldown: 0.35, // Brief seconds after kick before re-capturing
};

export const PLAYER_CONFIG = {
  radius: 0.55,
  height: 1.8,
  eyeHeight: 1.62,
  mass: 75,
  walkSpeed: 9.5,
  sprintSpeed: 14.5,
  accel: 28.0,
  decel: 18.0,
  jumpSpeed: 7.2,
  kickReach: 2.6, // Generous and responsive kick reach
  kickMinPower: 16,
  kickMaxPower: 36,
  maxChargeTimeMs: 850,
};

export const CAMERA_CONFIG = {
  thirdPerson: {
    distance: 3.6,
    height: 2.2,
    pitchOffset: -0.15, // slight downward look at the player and ball
    fov: 75,
  },
  firstPerson: {
    eyeHeight: 1.55,
    fov: 90, // wide field of view so ball stays in view
  },
};

export type CameraViewMode = "thirdPerson" | "firstPerson";

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
