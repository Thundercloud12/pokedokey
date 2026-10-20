import React from "react";
import { type CreatureState, MOVES, TYPE_META } from "@game/shared";

interface HudProps {
  leftState: CreatureState;
  rightState: CreatureState;
  currentRound: number;
  hideAbilityBar?: boolean;
  isOnline?: boolean;
  p1Connected?: boolean;
  p2Connected?: boolean;
}

const P1_KEYS = ["J", "K", "L", "I"];

export const Hud: React.FC<HudProps> = ({
  leftState,
  rightState,
  currentRound,
  hideAbilityBar = false,
  isOnline = false,
  p1Connected = true,
  p2Connected = true,
}) => {
  const p1HpPercent = Math.max(0, Math.min(100, (leftState.hp / leftState.maxHp) * 100));
  const p2HpPercent = Math.max(0, Math.min(100, (rightState.hp / rightState.maxHp) * 100));

  const getHpColor = (pct: number) => {
    if (pct > 50) return "bg-emerald-500";
    if (pct > 25) return "bg-amber-400";
    return "bg-rose-500";
  };

  const renderRounds = (won: number) => {
    return (
      <div className="flex items-center gap-1.5">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            className={`size-2.5 rounded-full border border-white/60 transition-colors ${
              won > idx ? "bg-amber-400 shadow-[0_0_6px_#facc15]" : "bg-black/40"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderMoveSlots = (
    state: CreatureState,
    keys: string[],
    align: "left" | "right"
  ) => {
    return (
      <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {state.creature.moves.map((moveId, slotIdx) => {
          const move = MOVES[moveId];
          if (!move) return null;
          const meta = TYPE_META[move.type];
          const cd = state.cooldowns[slotIdx];
          const cdPct = cd > 0 ? Math.min(100, (cd / move.cooldownMs) * 100) : 0;
          const keyLabel = keys[slotIdx];

          return (
            <div
              key={moveId}
              className="relative flex flex-col items-center justify-between overflow-hidden border border-white/30 bg-black/75 px-1.5 py-1 text-center shadow-md select-none w-16 sm:w-20 h-13"
              style={{
                borderColor: cd > 0 ? "rgba(255,255,255,0.15)" : meta.color,
              }}
            >
              {/* Cooldown sweep shade */}
              {cd > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-black/85 backdrop-blur-[1px] transition-all"
                  style={{ height: `${cdPct}%` }}
                />
              )}

              {/* Key badge */}
              <span className="relative z-10 text-[9px] font-bold text-white/70 uppercase">
                {keyLabel}
              </span>

              {/* Move name */}
              <span className="relative z-10 truncate w-full text-[10px] font-bold text-white leading-tight">
                {move.name}
              </span>

              {/* CD text or type */}
              <div className="relative z-10 flex items-center justify-center w-full">
                {cd > 0 ? (
                  <span className="text-[9px] font-mono text-amber-300 font-bold">
                    {(cd / 1000).toFixed(1)}s
                  </span>
                ) : (
                  <span
                    className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.2 rounded"
                    style={{ backgroundColor: meta.darkColor, color: "#ffffff" }}
                  >
                    {meta.name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const leftMeta = TYPE_META[leftState.creature.type];
  const rightMeta = TYPE_META[rightState.creature.type];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between p-2 sm:p-3 z-10 h-full">
      {/* Top Header Bar: HP & Match Status */}
      <div className="grid grid-cols-12 items-start gap-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-2">
        {/* P1 (Left) Info & Health */}
        <div className="col-span-5 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-wider">
                {leftState.creature.name}
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                style={{ backgroundColor: leftMeta.darkColor, color: "#ffffff" }}
              >
                {leftMeta.name}
              </span>
            </div>
            {renderRounds(leftState.roundsWon)}
          </div>

          {/* P1 HP Bar */}
          <div className="relative h-4 sm:h-5 w-full overflow-hidden border border-white/40 bg-zinc-900 shadow-inner">
            <div
              className={`h-full transition-all duration-100 ease-out ${getHpColor(p1HpPercent)}`}
              style={{ width: `${p1HpPercent}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold text-white drop-shadow">
              {Math.ceil(leftState.hp)} / {leftState.maxHp}
            </span>
          </div>

          {/* Status Effects Indicator */}
          <div className="flex items-center gap-1">
            {leftState.burnT > 0 && (
              <span className="animate-pulse text-[9px] bg-orange-600/90 text-white px-1 font-bold rounded">
                BURN
              </span>
            )}
            {leftState.slowT > 0 && (
              <span className="text-[9px] bg-blue-600/90 text-white px-1 font-bold rounded">
                SLOW
              </span>
            )}
            {leftState.stunT > 0 && (
              <span className="animate-bounce text-[9px] bg-yellow-500/90 text-black px-1 font-bold rounded">
                STUN
              </span>
            )}
          </div>
        </div>

        {/* Center Round Indicator & Online Status */}
        <div className="col-span-2 flex flex-col items-center justify-center pt-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 drop-shadow">
            ROUND {currentRound}
          </span>
          <span className="text-[8px] font-semibold text-white/60 tracking-wider">
            BEST OF 3
          </span>

          {/* Online Connection Status Indicators */}
          {isOnline && (
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                  p1Connected
                    ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-300"
                    : "bg-rose-950/80 border border-rose-500/60 text-rose-300 animate-pulse"
                }`}
                title={p1Connected ? "Player 1 Connected" : "Player 1 Disconnected (20s Grace)"}
              >
                <span className={`size-1.5 rounded-full ${p1Connected ? "bg-emerald-400" : "bg-rose-500"}`} />
                <span>P1</span>
              </div>

              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                  p2Connected
                    ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-300"
                    : "bg-rose-950/80 border border-rose-500/60 text-rose-300 animate-pulse"
                }`}
                title={p2Connected ? "Player 2 Connected" : "Player 2 Disconnected (20s Grace)"}
              >
                <span className={`size-1.5 rounded-full ${p2Connected ? "bg-emerald-400" : "bg-rose-500"}`} />
                <span>P2</span>
              </div>
            </div>
          )}
        </div>

        {/* Mid-Match Disconnect Warning Banner */}
        {isOnline && (!p1Connected || !p2Connected) && (
          <div className="pointer-events-none absolute top-14 inset-x-0 flex justify-center z-30">
            <div className="bg-rose-600/95 border-2 border-white px-3 py-1 rounded shadow-xl animate-bounce">
              <span className="font-mono text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">
                ⚠ OPPONENT DISCONNECTED — 20s RECONNECT GRACE WINDOW ACTIVE
              </span>
            </div>
          </div>
        )}

        {/* P2 (Right) Info & Health */}
        <div className="col-span-5 flex flex-col items-end gap-1">
          <div className="flex items-center justify-between w-full">
            {renderRounds(rightState.roundsWon)}
            <div className="flex items-center gap-1.5">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                style={{ backgroundColor: rightMeta.darkColor, color: "#ffffff" }}
              >
                {rightMeta.name}
              </span>
              <span className="text-xs sm:text-sm font-bold text-white tracking-wider">
                {rightState.creature.name}
              </span>
            </div>
          </div>

          {/* P2 HP Bar */}
          <div className="relative h-4 sm:h-5 w-full overflow-hidden border border-white/40 bg-zinc-900 shadow-inner">
            <div
              className={`h-full float-right transition-all duration-100 ease-out ${getHpColor(p2HpPercent)}`}
              style={{ width: `${p2HpPercent}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold text-white drop-shadow">
              {Math.ceil(rightState.hp)} / {rightState.maxHp}
            </span>
          </div>

          {/* Status Effects Indicator */}
          <div className="flex items-center gap-1">
            {rightState.burnT > 0 && (
              <span className="animate-pulse text-[9px] bg-orange-600/90 text-white px-1 font-bold rounded">
                BURN
              </span>
            )}
            {rightState.slowT > 0 && (
              <span className="text-[9px] bg-blue-600/90 text-white px-1 font-bold rounded">
                SLOW
              </span>
            )}
            {rightState.stunT > 0 && (
              <span className="animate-bounce text-[9px] bg-yellow-500/90 text-black px-1 font-bold rounded">
                STUN
              </span>
            )}
          </div>

          {/* AI Opponent Moves Cooldown Indicators (in Solo Mode) */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[8px] text-white/50 uppercase font-mono">AI CD:</span>
              <div className="flex items-center gap-1">
                {rightState.creature.moves.map((mId, slot) => {
                  const m = MOVES[mId];
                  if (!m) return null;
                  const cd = rightState.cooldowns[slot];
                  const cdPct = cd > 0 ? (cd / m.cooldownMs) * 100 : 0;
                  const isReady = cd <= 0;
                  return (
                    <div
                      key={mId}
                      className="relative h-2 w-8 sm:w-11 overflow-hidden border border-white/20 bg-black/60 rounded-xs"
                      title={`${m.name}: ${isReady ? "READY" : (cd / 1000).toFixed(1) + "s"}`}
                    >
                      <div
                        className={`h-full transition-all duration-75 ${
                          isReady ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${isReady ? 100 : 100 - cdPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Ability Cooldown Indicators */}
      {!hideAbilityBar && (
        <div className="flex items-end justify-between w-full pb-1">
          {/* P1 Abilities */}
          <div>{renderMoveSlots(leftState, P1_KEYS, "left")}</div>
        </div>
      )}
    </div>
  );
};
