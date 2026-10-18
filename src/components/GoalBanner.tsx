import React from "react";
import type { GameUiState } from "../game/engine";

interface GoalBannerProps {
  ui: GameUiState;
}

export const GoalBanner: React.FC<GoalBannerProps> = ({ ui }) => {
  if (ui.phase !== "goal") return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/40 backdrop-blur-xs">
      <div className="flex flex-col items-center animate-pulse">
        <h1 className="font-mono text-6xl sm:text-8xl font-black italic tracking-widest text-yellow-400 text-retro-glow">
          GOAL!!!
        </h1>
        <p className="mt-2 font-mono text-sm sm:text-lg font-bold tracking-widest uppercase text-white border-b-2 border-white/50 pb-1">
          {ui.score.red > ui.score.blue
            ? "RED DEVILS IN THE LEAD!"
            : ui.score.blue > ui.score.red
            ? "BLUE METEORS IN THE LEAD!"
            : "EQUALIZER!"}
        </p>
      </div>
    </div>
  );
};
