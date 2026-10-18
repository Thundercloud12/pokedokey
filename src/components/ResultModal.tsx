import React from "react";
import type { GameUiState } from "../game/engine";

interface ResultModalProps {
  ui: GameUiState;
  onRematch: () => void;
  onBackToLobby: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ ui, onRematch, onBackToLobby }) => {
  if (ui.phase !== "over" || !ui.winner) return null;

  const isUserWinner = ui.winner === ui.localTeam;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-md font-mono text-white">
      <div className="flex w-full max-w-md flex-col items-center border-2 border-white/20 bg-[#0b0f19] p-6 shadow-2xl">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
          FULL TIME · FINAL WHISTLE
        </span>

        {/* Big Victory Announcement */}
        <h2
          className={`mt-2 text-3xl sm:text-4xl font-black uppercase tracking-wider ${
            isUserWinner ? "text-yellow-400 text-retro-glow" : "text-blue-400"
          }`}
        >
          {isUserWinner ? "VICTORY! YOU WIN" : "DEFEAT! OPPONENT WINS"}
        </h2>

        {/* Big Score Box */}
        <div className="my-6 flex items-center border border-white/30 bg-black/60 px-6 py-3">
          <span className="text-4xl font-black text-red-500">{ui.score.red}</span>
          <span className="mx-4 text-2xl font-light text-white/30">-</span>
          <span className="text-4xl font-black text-blue-400">{ui.score.blue}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onRematch}
            className="w-full border-2 border-white bg-white py-2.5 text-xs sm:text-sm font-bold uppercase tracking-widest text-black transition hover:bg-neutral-200 active:scale-98"
          >
            PLAY REMATCH
          </button>
          <button
            type="button"
            onClick={onBackToLobby}
            className="w-full border border-white/40 bg-transparent py-2.5 text-xs sm:text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white hover:text-black"
          >
            BACK TO LOBBY
          </button>
        </div>
      </div>
    </div>
  );
};
