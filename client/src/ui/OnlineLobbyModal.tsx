import React, { useEffect, useRef, useState } from "react";
import {
  CREATURES,
  CREATURE_MAP,
  type Creature,
  TYPE_META,
} from "@game/shared";
import { drawCreature } from "../render/CreatureSprite";
import { sound } from "../audio/Sound";
import { Copy, Check, LogOut, Swords, Zap, Wind, ArrowUp } from "lucide-react";

interface OnlineLobbyModalProps {
  roomId: string;
  mySide: "left" | "right";
  p1CreatureId: string;
  p2CreatureId: string;
  p1Ready: boolean;
  p2Ready: boolean;
  p1Connected: boolean;
  p2Connected: boolean;
  lobbyCountdown: number;
  onSelectCreature: (creatureId: string) => void;
  onToggleReady: () => void;
  onLeave: () => void;
}

const LobbyCreaturePreview: React.FC<{
  creature: Creature;
  facing: 1 | -1;
}> = ({ creature, facing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    let animFrame = 0;
    let t = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t++;
      const bounce = Math.sin(t * 0.08) * 1.5;

      drawCreature(ctx, creature, {
        x: 20,
        y: 16 + bounce,
        facing,
        vx: 0,
        onGround: true,
        anim: t * 0.8,
        castT: 0,
        hurtT: 0,
        isKo: false,
      });

      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [creature, facing]);

  return (
    <canvas
      ref={canvasRef}
      width={52}
      height={52}
      className="size-20 sm:size-24 select-none drop-shadow-md"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  roomId,
  mySide,
  p1CreatureId,
  p2CreatureId,
  p1Ready,
  p2Ready,
  p1Connected,
  p2Connected,
  lobbyCountdown,
  onSelectCreature,
  onToggleReady,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);
  const p1Creature = CREATURE_MAP[p1CreatureId] || CREATURES[0];
  const p2Creature = CREATURE_MAP[p2CreatureId] || CREATURES[1];

  const amReady = mySide === "left" ? p1Ready : p2Ready;

  // Sound effect on countdown change
  const prevCountdownRef = useRef(lobbyCountdown);
  useEffect(() => {
    if (lobbyCountdown > 0 && lobbyCountdown !== prevCountdownRef.current) {
      sound.tick();
    }
    prevCountdownRef.current = lobbyCountdown;
  }, [lobbyCountdown]);

  // Space / Enter shortcut for ready toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        sound.tick();
        onToggleReady();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleReady]);

  const handleCopyCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderFighterCard = (
    side: "left" | "right",
    creature: Creature,
    isReady: boolean,
    isConnected: boolean
  ) => {
    const isMe = mySide === side;
    const meta = TYPE_META[creature.type];
    const roleLabel = side === "left" ? "HOST (P1)" : "CHALLENGER (P2)";

    return (
      <div
        className={`relative flex flex-col justify-between rounded-lg border-2 p-3 sm:p-4 bg-gradient-to-b from-black/80 to-black/60 transition-all ${
          isReady
            ? "border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
            : "border-white/20"
        }`}
      >
        {/* Top Badges */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                side === "left"
                  ? "bg-amber-400 text-black"
                  : "bg-cyan-400 text-black"
              }`}
            >
              {roleLabel}
            </span>
            {isMe && (
              <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded">
                YOU
              </span>
            )}
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-1">
            <div
              className={`size-2 rounded-full ${
                isConnected
                  ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                  : "bg-rose-500 animate-ping"
              }`}
            />
            <span
              className={`text-[9px] font-mono font-bold uppercase ${
                isConnected ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isConnected ? "ONLINE" : "RECONNECTING"}
            </span>
          </div>
        </div>

        {/* Creature Display & Name */}
        <div className="flex flex-col items-center py-3">
          <LobbyCreaturePreview
            creature={creature}
            facing={side === "left" ? 1 : -1}
          />
          <span className="font-mono text-base sm:text-lg font-bold text-white uppercase tracking-wider mt-1">
            {creature.name}
          </span>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest mt-0.5"
            style={{ backgroundColor: meta.darkColor, color: "#ffffff" }}
          >
            {meta.name} TYPE
          </span>
        </div>

        {/* Ready Status Banner */}
        <div className="py-2">
          {isReady ? (
            <div className="flex items-center justify-center gap-1.5 bg-emerald-500/20 border border-emerald-400 py-1.5 rounded text-emerald-300 font-mono text-xs font-bold uppercase animate-pulse">
              <Check size={14} className="stroke-[3]" />
              <span>READY TO FIGHT!</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 bg-white/5 border border-white/20 py-1.5 rounded text-white/60 font-mono text-xs font-bold uppercase">
              <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>CHOOSING FIGHTER...</span>
            </div>
          )}
        </div>

        {/* Creature Selector Grid (Active Player Only) */}
        {isMe ? (
          <div className="mt-2 border-t border-white/10 pt-2">
            <span className="text-[9px] font-mono text-white/60 uppercase block mb-1.5">
              {isReady
                ? "LOCKED IN (UNREADY TO CHANGE):"
                : "PICK YOUR CREATURE:"}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {CREATURES.map((c) => {
                const isSelected = c.id === creature.id;
                const cMeta = TYPE_META[c.type];
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isReady}
                    onClick={() => {
                      sound.tick();
                      onSelectCreature(c.id);
                    }}
                    className={`flex flex-col items-center p-1.5 rounded border transition ${
                      isSelected
                        ? "border-amber-400 bg-amber-400/20 scale-102"
                        : "border-white/10 bg-white/5 hover:border-white/40 hover:bg-white/10"
                    } ${isReady ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className="text-[10px] font-bold text-white truncate max-w-full">
                      {c.name}
                    </span>
                    <span
                      className="text-[8px] uppercase px-1 rounded mt-0.5"
                      style={{
                        backgroundColor: cMeta.darkColor,
                        color: "#fff",
                      }}
                    >
                      {cMeta.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Opponent Stats Preview */
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] font-mono text-white/60">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <Wind size={12} className="text-emerald-400" />
                <span>SPD: {creature.speed}</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUp size={12} className="text-cyan-400" />
                <span>JUMP: {creature.jumpPower}</span>
              </div>
              <div className="flex items-center gap-1">
                <Swords size={12} className="text-amber-400" />
                <span>WT: {creature.weight}</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={12} className="text-purple-400" />
                <span>HP: {creature.maxHp}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-y-auto bg-[#070b18] p-3 sm:p-5 text-white select-none">
      {/* Top Banner: Room Code & Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-white/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="size-3 bg-amber-400 rotate-45" />
          <h1 className="font-mono text-sm sm:text-base font-bold tracking-widest uppercase">
            PRE-MATCH LOBBY
          </h1>
        </div>

        {/* Room Code with Copy Button */}
        <div className="flex items-center gap-2 border border-amber-400/80 bg-black/60 px-3 py-1 rounded">
          <span className="text-[10px] font-mono text-white/60 uppercase">
            ROOM CODE:
          </span>
          <span className="font-mono text-sm font-bold text-amber-400">
            {roomId}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1 text-[10px] font-bold text-white/80 hover:text-white transition ml-1"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400">COPIED</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>COPY</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Countdown or Status Announcement */}
      <div className="py-2 text-center">
        {lobbyCountdown > 0 ? (
          <div className="animate-bounce bg-emerald-500 border-2 border-white py-2 px-4 rounded shadow-[0_0_20px_#22c55e]">
            <span className="font-mono text-base sm:text-xl font-bold tracking-widest text-black uppercase">
              ⚡ MATCH STARTING IN {lobbyCountdown}... ⚡
            </span>
          </div>
        ) : p1Ready && p2Ready ? (
          <div className="bg-emerald-950/80 border border-emerald-400 py-1.5 px-3 rounded text-emerald-300 font-mono text-xs font-bold uppercase animate-pulse">
            BOTH FIGHTERS READY! LAUNCHING ARENA...
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 py-1.5 px-3 rounded text-white/70 font-mono text-xs uppercase">
            CHOOSE YOUR FIGHTER AND CLICK READY UP (2 MIN IDLE TIMEOUT)
          </div>
        )}
      </div>

      {/* Main 2-Player Staging Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-auto">
        {renderFighterCard("left", p1Creature, p1Ready, p1Connected)}
        {renderFighterCard("right", p2Creature, p2Ready, p2Connected)}
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-3">
        <button
          type="button"
          onClick={() => {
            sound.tick();
            onLeave();
          }}
          className="flex items-center gap-1.5 border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-300 uppercase hover:bg-rose-900/60 transition rounded"
        >
          <LogOut size={13} />
          <span>LEAVE LOBBY</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[10px] font-mono text-white/40">
            [SPACE / ENTER] TOGGLES READY
          </span>
          <button
            type="button"
            onClick={() => {
              sound.tick();
              onToggleReady();
            }}
            className={`flex items-center gap-2 px-6 py-2.5 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider rounded transition shadow-lg ${
              amReady
                ? "border-2 border-amber-400 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                : "border-2 border-emerald-400 bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-102 active:scale-98"
            }`}
          >
            {amReady ? (
              <span>CANCEL READY</span>
            ) : (
              <>
                <Swords size={16} />
                <span>READY UP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
