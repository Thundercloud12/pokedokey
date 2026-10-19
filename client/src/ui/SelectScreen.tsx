import React, { useEffect, useRef, useState } from "react";
import { Bot, Users, Globe, Volume2, VolumeX, Swords, Shield, Zap, Wind, HelpCircle } from "lucide-react";
import { CREATURES, type Creature, MOVES, TYPE_META, type PlayMode } from "@game/shared";
import { drawCreature } from "../render/CreatureSprite";
import { sound } from "../audio/Sound";
import { TutorialModal } from "./TutorialModal";

interface SelectScreenProps {
  mode: PlayMode;
  onModeChange: (m: PlayMode) => void;
  p1Creature: Creature;
  p2Creature: Creature;
  onSelectP1: (c: Creature) => void;
  onSelectP2: (c: Creature) => void;
  onStartMatch: () => void;
  muted: boolean;
  onToggleMute: () => void;

  // Online connection props
  onlineTab: "menu" | "host" | "join";
  setOnlineTab: (tab: "menu" | "host" | "join") => void;
  roomCode: string;
  joinCodeInput: string;
  setJoinCodeInput: (code: string) => void;
  onHostOnline: () => void;
  onJoinOnline: () => void;
  onQuickMatch?: () => void;
  serverUrl?: string;
  onUpdateServerUrl?: (url: string) => void;
  peerConnected: boolean;
  copied: boolean;
  onCopyRoomCode: () => void;
}

const CreatureCanvas: React.FC<{ creature: Creature; isHovered?: boolean }> = ({
  creature,
  isHovered,
}) => {
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

      // Subtle breathing / stepping bounce
      const bounce = Math.sin(t * 0.08) * 1.5;

      drawCreature(ctx, creature, {
        x: 14,
        y: 12 + (isHovered ? bounce : 0),
        facing: 1,
        vx: isHovered ? 0.5 : 0,
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
  }, [creature, isHovered]);

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={40}
      className="size-16 select-none"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export const SelectScreen: React.FC<SelectScreenProps> = ({
  mode,
  onModeChange,
  p1Creature,
  p2Creature,
  onSelectP1,
  onSelectP2,
  onStartMatch,
  muted,
  onToggleMute,
  onlineTab,
  setOnlineTab,
  roomCode,
  joinCodeInput,
  setJoinCodeInput,
  onHostOnline,
  onJoinOnline,
  onQuickMatch,
  serverUrl,
  onUpdateServerUrl,
  peerConnected,
  copied,
  onCopyRoomCode,
}) => {
  const [activePicker, setActivePicker] = useState<"p1" | "p2">("p1");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("creature_battler_tutorial_seen");
  });

  const activeHoveredCreature =
    CREATURES.find((c) => c.id === hoveredId) ||
    (activePicker === "p1" ? p1Creature : p2Creature);

  const handleSelect = (c: Creature) => {
    sound.tick();
    if (mode === "solo") {
      onSelectP1(c);
      // Pick a smart counter or complementary bot
      const otherCreatures = CREATURES.filter((cr) => cr.id !== c.id);
      const randomOpponent =
        otherCreatures[Math.floor(Math.random() * otherCreatures.length)];
      onSelectP2(randomOpponent);
    } else if (mode === "local2p") {
      if (activePicker === "p1") {
        onSelectP1(c);
        setActivePicker("p2");
      } else {
        onSelectP2(c);
        setActivePicker("p1");
      }
    } else {
      // Online mode: player picks their own creature
      onSelectP1(c);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-y-auto bg-[#070b18] p-3 text-white select-none sm:p-5">
      {/* Top Navigation & Mode Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-white/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="size-3 bg-amber-400 rotate-45" />
          <h1 className="font-mono text-sm sm:text-base font-bold tracking-widest text-white uppercase">
            CREATURE ARENA BATTLER
          </h1>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onModeChange("solo")}
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
              mode === "solo"
                ? "border-white bg-white font-bold text-black"
                : "border-white/20 text-white/60 hover:text-white"
            }`}
          >
            <Bot size={13} />
            <span>VS AI BOT</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("local2p")}
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
              mode === "local2p"
                ? "border-white bg-white font-bold text-black"
                : "border-white/20 text-white/60 hover:text-white"
            }`}
          >
            <Users size={13} />
            <span>2-PLAYER LOCAL</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("online")}
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
              mode === "online"
                ? "border-white bg-white font-bold text-black"
                : "border-white/20 text-white/60 hover:text-white"
            }`}
          >
            <Globe size={13} />
            <span>ONLINE P2P</span>
          </button>

          {/* How to Play / Tutorial */}
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 border border-amber-400/60 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-400 hover:text-black transition"
            title="Learn How to Play"
          >
            <HelpCircle size={13} />
            <span className="hidden sm:inline">HOW TO PLAY</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className="grid size-8 place-items-center border border-dashed border-white/20 text-white/70 hover:bg-white hover:text-black transition"
            aria-label={muted ? "Unmute sound" : "Mute sound"}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Select Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-auto py-2">
        {/* Left: 6-Creature Roster Grid */}
        <div className="lg:col-span-8 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono tracking-widest text-white/70 uppercase">
              SELECT ROSTER ({CREATURES.length} COMBATANTS)
            </span>
            {mode === "local2p" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePicker("p1")}
                  className={`px-2 py-0.5 text-[10px] font-bold border ${
                    activePicker === "p1"
                      ? "border-rose-500 bg-rose-500/20 text-rose-300"
                      : "border-white/20 text-white/40"
                  }`}
                >
                  P1 (RED) PICKING
                </button>
                <button
                  type="button"
                  onClick={() => setActivePicker("p2")}
                  className={`px-2 py-0.5 text-[10px] font-bold border ${
                    activePicker === "p2"
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-white/20 text-white/40"
                  }`}
                >
                  P2 (BLUE) PICKING
                </button>
              </div>
            )}
          </div>

          {/* Creatures Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CREATURES.map((c) => {
              const meta = TYPE_META[c.type];
              const isP1 = p1Creature.id === c.id;
              const isP2 = p2Creature.id === c.id;
              const isHovered = hoveredId === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleSelect(c)}
                  className={`group relative flex flex-col items-center justify-between border p-2 transition text-left ${
                    isP1 && isP2
                      ? "border-purple-400 bg-purple-950/30"
                      : isP1
                      ? "border-rose-500 bg-rose-950/30"
                      : isP2
                      ? "border-blue-500 bg-blue-950/30"
                      : "border-white/15 bg-black/40 hover:border-white/60 hover:bg-black/80"
                  }`}
                >
                  {/* Player Tags */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    {isP1 && (
                      <span className="bg-rose-500 px-1 py-0.2 text-[8px] font-bold text-white rounded">
                        P1
                      </span>
                    )}
                    {isP2 && (
                      <span className="bg-blue-500 px-1 py-0.2 text-[8px] font-bold text-white rounded">
                        {mode === "solo" ? "BOT" : "P2"}
                      </span>
                    )}
                  </div>

                  {/* Pixel Sprite Preview */}
                  <div className="py-1">
                    <CreatureCanvas creature={c} isHovered={isHovered} />
                  </div>

                  {/* Info */}
                  <div className="w-full flex flex-col items-center text-center mt-1">
                    <span className="font-bold text-xs text-white">{c.name}</span>
                    <span
                      className="mt-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded uppercase"
                      style={{ backgroundColor: meta.darkColor, color: "#ffffff" }}
                    >
                      {meta.name}
                    </span>
                    <span className="mt-1 text-[9px] text-white/50 truncate w-full">
                      {c.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Creature Detail Dossier */}
        <div className="lg:col-span-4 flex flex-col justify-between border border-white/20 bg-black/60 p-3 sm:p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <h2 className="text-base font-bold text-white">
                  {activeHoveredCreature.name}
                </h2>
                <p className="text-[10px] text-white/60">
                  {activeHoveredCreature.title}
                </p>
              </div>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded uppercase"
                style={{
                  backgroundColor: TYPE_META[activeHoveredCreature.type].darkColor,
                  color: "#ffffff",
                }}
              >
                {TYPE_META[activeHoveredCreature.type].name}
              </span>
            </div>

            <p className="text-[11px] text-white/80 leading-relaxed italic">
              "{activeHoveredCreature.description}"
            </p>

            {/* Stat Bars */}
            <div className="mt-2 flex flex-col gap-1.5 text-[10px] font-mono">
              <div>
                <div className="flex justify-between text-white/60 mb-0.5">
                  <span className="flex items-center gap-1">
                    <Shield size={11} /> MAX HP
                  </span>
                  <span>{activeHoveredCreature.maxHp}</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400"
                    style={{
                      width: `${(activeHoveredCreature.maxHp / 140) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-white/60 mb-0.5">
                  <span className="flex items-center gap-1">
                    <Zap size={11} /> SPEED
                  </span>
                  <span>{activeHoveredCreature.speed.toFixed(2)}</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400"
                    style={{
                      width: `${(activeHoveredCreature.speed / 2.0) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-white/60 mb-0.5">
                  <span className="flex items-center gap-1">
                    <Wind size={11} /> JUMP
                  </span>
                  <span>{Math.abs(activeHoveredCreature.jumpPower).toFixed(1)}</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-400"
                    style={{
                      width: `${(Math.abs(activeHoveredCreature.jumpPower) / 6.0) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Moves List */}
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-white/60 uppercase">
                ABILITIES (4 SLOTS)
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {activeHoveredCreature.moves.map((mId) => {
                  const m = MOVES[mId];
                  if (!m) return null;
                  return (
                    <div
                      key={mId}
                      className="border border-white/10 bg-white/5 p-1.5 rounded flex flex-col"
                    >
                      <span className="text-[10px] font-bold text-white truncate">
                        {m.name}
                      </span>
                      <div className="flex justify-between text-[8px] text-white/60 mt-0.5">
                        <span className="uppercase">{m.shape}</span>
                        <span>PWR {m.power}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Button / Online Connect Area */}
          <div className="mt-4 pt-3 border-t border-white/10">
            {mode === "online" && !peerConnected ? (
              <div className="flex flex-col gap-2">
                {onlineTab === "menu" ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={onQuickMatch || onHostOnline}
                      className="border border-emerald-400 bg-emerald-500 py-2 text-center text-xs font-bold text-black uppercase hover:bg-emerald-400 transition shadow-lg"
                    >
                      ⚡ QUICK MATCH (MATCHMAKING)
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onHostOnline}
                        className="border border-white bg-white/90 py-1.5 text-center text-xs font-bold text-black uppercase hover:bg-white transition"
                      >
                        Create Room
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlineTab("join")}
                        className="border border-white/60 bg-black/60 py-1.5 text-center text-xs font-bold text-white uppercase hover:bg-white/10 transition"
                      >
                        Join Room
                      </button>
                    </div>
                    {serverUrl && (
                      <div className="flex items-center justify-between text-[9px] text-white/40 pt-1">
                        <span className="truncate max-w-[200px]">Server: <strong className="text-white/70">{serverUrl}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            const u = prompt("Enter Colyseus WebSocket Server URL (e.g. ws://YOUR_EC2_IP:2567 or wss://domain.com):", serverUrl || "");
                            if (u !== null && onUpdateServerUrl) onUpdateServerUrl(u.trim());
                          }}
                          className="underline hover:text-white"
                        >
                          [Edit Server]
                        </button>
                      </div>
                    )}
                  </div>
                ) : onlineTab === "host" ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2 border border-amber-400 bg-black/80 px-3 py-1.5">
                      <span className="font-mono text-base font-bold text-amber-400">
                        {roomCode || "CONNECTING..."}
                      </span>
                      <button
                        type="button"
                        onClick={onCopyRoomCode}
                        className="text-xs hover:text-amber-300 font-bold"
                      >
                        {copied ? "COPIED!" : "COPY"}
                      </button>
                    </div>
                    <span className="text-[9px] text-white/60 uppercase">
                      {peerConnected
                        ? "⚡ Challenger connected! Launching..."
                        : "Share room code with your friend. Waiting to connect..."}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOnlineTab("menu")}
                      className="text-[9px] text-white/40 hover:text-white underline mt-1"
                    >
                      ← Back to menu
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="PASTE ROOM ID..."
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value)}
                        className="w-full border border-white/40 bg-black/60 px-2 py-1 text-xs text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={onJoinOnline}
                        className="border border-white bg-white px-3 py-1 text-xs font-bold text-black uppercase hover:bg-white/90"
                      >
                        JOIN
                      </button>
                    </div>
                    {peerConnected && (
                      <span className="text-[9px] text-emerald-400 font-bold uppercase text-center">
                        ⚡ Connected to Host! Launching match...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setOnlineTab("menu")}
                      className="text-[9px] text-white/40 hover:text-white underline self-center"
                    >
                      ← Back to menu
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onStartMatch}
                className="w-full flex items-center justify-center gap-2 border-2 border-white bg-white py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-black transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <Swords size={16} />
                <span>START BATTLE [ENTER]</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls Cheatsheet */}
      <div className="flex flex-wrap items-center justify-between border-t border-white/10 pt-2 text-[10px] font-mono text-white/60">
        <div className="flex items-center gap-3">
          <span>
            <strong className="text-white">P1:</strong> A/D Run • Space/W Jump • [J/K/L/I] Moves
          </span>
          {mode === "local2p" && (
            <span>
              <strong className="text-white">P2:</strong> ←/→ Run • ↑ Jump • [J/K/L/I] Moves
            </span>
          )}
        </div>
        <span>2D CREATURE ARENA • ORIGINAL 6-ELEMENT WHEEL</span>
      </div>

      {/* Tutorial / How to Play Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  );
};
