import React, { useState } from "react";
import { Users, Bot, Target, Copy, Check, Play, Sliders } from "lucide-react";
import type { GameMode, GameUiState } from "../game/engine";

interface LobbyModalProps {
  isOpen: boolean;
  ui: GameUiState;
  onSelectMode: (mode: GameMode, roomCode?: string) => void;
  onChangePixelScale: (scale: number) => void;
  onClose: () => void;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  isOpen,
  ui,
  onSelectMode,
  onChangePixelScale,
  onClose,
}) => {
  const [tab, setTab] = useState<"menu" | "host" | "join">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (ui.roomCode) {
      navigator.clipboard.writeText(ui.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startHost = () => {
    onSelectMode("online");
    setTab("host");
  };

  const startJoin = () => {
    if (joinCode.trim()) {
      onSelectMode("online", joinCode.trim().toUpperCase());
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono text-white backdrop-blur-md">
      <div className="relative w-full max-w-lg border-2 border-white/20 bg-[#070b14] p-6 shadow-2xl">
        {/* Retro Header */}
        <div className="flex flex-col items-center border-b border-white/15 pb-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500 animate-pulse">
            ★ FIRST-PERSON 3D SOCCER ★
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black uppercase tracking-widest text-white text-retro-glow">
            PIXEL FPS FOOTBALL
          </h1>
          <p className="mt-1 text-[11px] text-white/50 uppercase tracking-wider">
            Aim with crosshair · First to 3 goals wins
          </p>
        </div>

        {/* Tab: Main Menu */}
        {tab === "menu" && (
          <div className="mt-6 flex flex-col gap-3">
            {/* Solo vs Bot */}
            <button
              type="button"
              onClick={() => {
                onSelectMode("bot");
                onClose();
              }}
              className="group flex items-center justify-between border border-white/20 bg-white/5 p-3.5 transition hover:border-red-500 hover:bg-white/10 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center bg-red-600/30 text-red-400">
                  <Bot size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                    PLAY VS HARSHIT-BOT (SOLO)
                  </div>
                  <div className="text-[10px] text-white/50 uppercase">
                    1v1 Match against smart AI defender
                  </div>
                </div>
              </div>
              <Play size={16} className="text-white/40 group-hover:text-white" />
            </button>

            {/* Online 2-Player (Host) */}
            <button
              type="button"
              onClick={startHost}
              className="group flex items-center justify-between border border-white/20 bg-white/5 p-3.5 transition hover:border-blue-500 hover:bg-white/10 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center bg-blue-600/30 text-blue-400">
                  <Users size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                    HOST 2-PLAYER MATCH
                  </div>
                  <div className="text-[10px] text-white/50 uppercase">
                    Get room code for a friend to join via P2P
                  </div>
                </div>
              </div>
              <Play size={16} className="text-white/40 group-hover:text-white" />
            </button>

            {/* Online 2-Player (Join) */}
            <button
              type="button"
              onClick={() => setTab("join")}
              className="group flex items-center justify-between border border-white/20 bg-white/5 p-3.5 transition hover:border-green-500 hover:bg-white/10 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center bg-green-600/30 text-green-400">
                  <Users size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                    JOIN FRIEND'S MATCH
                  </div>
                  <div className="text-[10px] text-white/50 uppercase">
                    Enter a 6-digit room code to join
                  </div>
                </div>
              </div>
              <Play size={16} className="text-white/40 group-hover:text-white" />
            </button>

            {/* Practice Shootout */}
            <button
              type="button"
              onClick={() => {
                onSelectMode("practice");
                onClose();
              }}
              className="group flex items-center justify-between border border-white/20 bg-white/5 p-3.5 transition hover:border-yellow-500 hover:bg-white/10 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center bg-yellow-600/30 text-yellow-400">
                  <Target size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                    FREE PRACTICE SHOOTOUT
                  </div>
                  <div className="text-[10px] text-white/50 uppercase">
                    Open pitch to test rocket shots & lobs
                  </div>
                </div>
              </div>
              <Play size={16} className="text-white/40 group-hover:text-white" />
            </button>
          </div>
        )}

        {/* Tab: Host Room Screen */}
        {tab === "host" && (
          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              MATCH HOST CREATED
            </span>
            <div className="flex items-center gap-3 border-2 border-white/40 bg-black/80 px-6 py-3">
              <span className="text-2xl sm:text-3xl font-black tracking-widest text-yellow-400">
                {ui.roomCode || "GENERATING..."}
              </span>
              {ui.roomCode && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="border border-white/30 p-1.5 transition hover:bg-white hover:text-black"
                  title="Copy Code"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              )}
            </div>
            <p className="text-[11px] text-white/60 uppercase">
              {ui.peerConnected
                ? "✓ PLAYER 2 HAS JOINED! READY TO KICK OFF"
                : "Share this code with your friend. Waiting for connection..."}
            </p>

            <div className="mt-2 flex w-full gap-3">
              <button
                type="button"
                onClick={() => setTab("menu")}
                className="w-1/2 border border-white/30 py-2 text-xs font-bold uppercase hover:bg-white/10"
              >
                BACK
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 border-2 border-white bg-white py-2 text-xs font-bold uppercase text-black hover:bg-neutral-200"
              >
                ENTER ARENA
              </button>
            </div>
          </div>
        )}

        {/* Tab: Join Room Screen */}
        {tab === "join" && (
          <div className="mt-6 flex flex-col gap-4">
            <span className="text-center text-[10px] font-bold uppercase tracking-widest text-green-400">
              ENTER HOST'S ROOM CODE
            </span>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="E.G. FP-4821"
              maxLength={10}
              className="w-full border-2 border-white/50 bg-black px-4 py-3 text-center text-xl font-bold uppercase tracking-widest text-yellow-400 placeholder:text-white/20 focus:border-white focus:outline-none"
            />
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => setTab("menu")}
                className="w-1/2 border border-white/30 py-2.5 text-xs font-bold uppercase hover:bg-white/10"
              >
                BACK
              </button>
              <button
                type="button"
                onClick={startJoin}
                disabled={!joinCode.trim()}
                className="w-1/2 border-2 border-white bg-white py-2.5 text-xs font-bold uppercase text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                JOIN MATCH
              </button>
            </div>
          </div>
        )}

        {/* Retro Pixel Resolution Options */}
        <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4 text-[11px] text-white/60">
          <div className="flex items-center gap-2">
            <Sliders size={13} />
            <span className="uppercase">PIXEL CRUNCH:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { label: "CHUNKY (35%)", val: 0.35 },
              { label: "RETRO (45%)", val: 0.45 },
              { label: "SHARP (65%)", val: 0.65 },
              { label: "CRISP (100%)", val: 1.0 },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => onChangePixelScale(p.val)}
                className={`border px-2 py-1 uppercase transition ${
                  Math.abs(ui.pixelScale - p.val) < 0.05
                    ? "border-white bg-white font-bold text-black"
                    : "border-white/20 bg-transparent text-white/60 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls Cheatsheet */}
        <div className="mt-4 border border-dashed border-white/20 bg-black/40 p-3 text-[10px] text-white/50">
          <div className="font-bold uppercase tracking-wider text-white/80">HOW TO PLAY:</div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
            <div>• WASD : RUN ON PITCH</div>
            <div>• SHIFT : SPRINT ACCEL</div>
            <div>• MOUSE : AIM CROSSHAIR</div>
            <div>• SPACE : JUMP HEADER</div>
            <div>• HOLD L-CLICK : ROCKET SHOT</div>
            <div>• R-CLICK : LOB / CHIP</div>
          </div>
        </div>
      </div>
    </div>
  );
};
