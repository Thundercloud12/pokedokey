import React from "react";
import { Volume2, VolumeX, Compass, Sliders } from "lucide-react";
import { sound } from "../audio/Sound";
import type { GameUiState } from "../game/engine";

interface HudProps {
  ui: GameUiState;
  onTogglePixelScale: () => void;
  onOpenMenu: () => void;
}

export const HUD: React.FC<HudProps> = ({ ui, onTogglePixelScale, onOpenMenu }) => {
  const [muted, setMuted] = React.useState(sound.muted);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.unlock();
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
  };

  // Compass needle rotation in degrees
  const compassDeg = (ui.ballAngleToPlayer * 180) / Math.PI;

  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden font-mono text-white">
      {/* CRT Scanline & Vignette Filters */}
      <div className="crt-scanlines absolute inset-0 z-10" />
      <div className="crt-vignette absolute inset-0 z-10" />

      {/* TOP BAR: Retro Scoreboard */}
      <div className="relative z-20 flex w-full items-center justify-between p-4 sm:p-6">
        {/* Match / Room Info */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest text-white/70 uppercase">
              {ui.mode === "bot"
                ? "SOLO VS HARSHIT-BOT"
                : ui.mode === "online"
                ? `P2P 2-PLAYER [ROOM: ${ui.roomCode || "WAITING"}]`
                : "PRACTICE ARENA"}
            </span>
          </div>
          {ui.mode === "online" && (
            <span className="text-[10px] text-white/50 uppercase">
              {ui.peerConnected ? "● 2 PLAYERS CONNECTED" : "○ WAITING FOR PLAYER 2..."}
            </span>
          )}
        </div>

        {/* Big Retro Score Box */}
        <div className="flex flex-col items-center">
          <div className="flex items-center border-2 border-white/40 bg-black/80 px-4 py-1.5 shadow-2xl backdrop-blur-md">
            <span className="text-xl sm:text-2xl font-black text-red-500 tracking-wider">
              RED {ui.score.red}
            </span>
            <span className="mx-3 text-lg font-light text-white/40">:</span>
            <span className="text-xl sm:text-2xl font-black text-blue-400 tracking-wider">
              {ui.score.blue} BLUE
            </span>
          </div>
          <span className="mt-1 text-[10px] tracking-widest text-white/50 uppercase">
            FIRST TO 3 WINS
          </span>
        </div>

        {/* Buttons (Mute, Pixel Filter, Menu) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePixelScale}
            className="flex items-center gap-1.5 border border-white/30 bg-black/60 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-white/80 transition hover:bg-white hover:text-black"
            title="Toggle Retro Pixel Resolution"
          >
            <Sliders size={13} />
            <span className="hidden sm:inline">PIXEL: {Math.round(ui.pixelScale * 100)}%</span>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="border border-white/30 bg-black/60 p-2 text-white/80 transition hover:bg-white hover:text-black"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu();
            }}
            className="border border-white/30 bg-black/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-black"
          >
            ESC / MENU
          </button>
        </div>
      </div>

      {/* CENTER CROSSHAIR */}
      <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
        <div className="relative size-8">
          {/* Crosshair lines */}
          <div className="absolute left-1/2 top-0 h-2 w-0.5 -translate-x-1/2 bg-white/70" />
          <div className="absolute bottom-0 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-white/70" />
          <div className="absolute left-0 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white/70" />
          <div className="absolute right-0 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white/70" />
          <div className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 bg-white" />

          {/* Shot Charge Power Ring/Arc */}
          {ui.chargeRatio > 0 && (
            <div
              className="absolute -inset-3 rounded-full border-2 border-red-500 animate-spin"
              style={{
                borderColor:
                  ui.chargeRatio > 0.75
                    ? "#ef4444"
                    : ui.chargeRatio > 0.4
                    ? "#facc15"
                    : "#4ade80",
                opacity: 0.8 + ui.chargeRatio * 0.2,
              }}
            />
          )}
        </div>
      </div>

      {/* SHOT POWER METER (Bottom Center) */}
      <div className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
        {ui.chargeRatio > 0 ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold tracking-widest text-white uppercase text-retro-glow">
              {ui.chargeRatio > 0.8 ? "ROCKET POWER!" : "CHARGING SHOT..."}
            </span>
            <div className="h-3 w-48 border-2 border-white bg-black/80 p-0.5 shadow-lg">
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${ui.chargeRatio * 100}%`,
                  backgroundColor:
                    ui.chargeRatio > 0.75
                      ? "#ef4444"
                      : ui.chargeRatio > 0.4
                      ? "#facc15"
                      : "#22c55e",
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-[10px] tracking-wider text-white/50 uppercase">
            <span>[HOLD L-CLICK] SHOOT</span>
            <span>·</span>
            <span>[R-CLICK] LOB / CHIP</span>
            <span>·</span>
            <span>[SPACE] JUMP</span>
            <span>·</span>
            <span>[SHIFT] SPRINT</span>
          </div>
        )}
      </div>

      {/* BALL TRACKER RADAR / COMPASS (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3 border border-white/20 bg-black/75 px-3 py-2 shadow-lg backdrop-blur-sm">
        <div className="relative size-8 grid place-items-center">
          <div
            className="transition-transform duration-100 ease-out"
            style={{ transform: `rotate(${compassDeg}deg)` }}
          >
            <Compass size={22} className="text-yellow-400" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold text-white/50 uppercase">BALL RADAR</span>
          <span className="text-[12px] font-bold text-white uppercase">
            {Math.round(ui.ballDistance)}m DISTANCE
          </span>
        </div>
      </div>

      {/* COUNTDOWN POPUP */}
      {ui.phase === "countdown" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/30 backdrop-blur-[2px]">
          <span className="font-mono text-7xl sm:text-9xl font-black tracking-widest text-white text-retro-glow animate-bounce">
            {ui.countdownText}
          </span>
        </div>
      )}

      {/* "CLICK TO LOCK MOUSE" OVERLAY */}
      {!ui.isLocked && ui.phase === "play" && (
        <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/60 backdrop-blur-sm cursor-pointer">
          <div className="border-2 border-white bg-black/90 px-6 py-4 text-center shadow-2xl">
            <p className="text-sm sm:text-base font-bold uppercase tracking-widest text-white">
              CLICK SCREEN TO ENTER FPS MODE
            </p>
            <p className="mt-1 text-[11px] text-white/60 uppercase">
              Move mouse to aim · WASD to move · ESC to release mouse
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
