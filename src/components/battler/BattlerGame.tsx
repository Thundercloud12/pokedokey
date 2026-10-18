import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, ArrowLeft, Smartphone } from "lucide-react";
import { CREATURES, CREATURE_MAP, type Creature } from "../../data/creatures";
import { MOVES } from "../../data/moves";
import { TYPE_META } from "../../data/typeChart";
import {
  PhysicsEngine,
  emptyBattleControls,
  type BattleControls,
  type BattlePhase,
  type CreatureState,
} from "../../engine/PhysicsEngine";
import { sound } from "../../audio/Sound";
import { Hud } from "../../render/Hud";
import { SelectScreen, type PlayMode } from "../../ui/SelectScreen";
import { ResultScreen } from "../../ui/ResultScreen";
import { colyseusNet } from "../../net/ColyseusClient";
import { type WorldSnapshot } from "../../net/TrysteroRoom";

const STEP_MS = 1000 / 60;

interface ArenaCanvasProps {
  engine: PhysicsEngine | null;
  mode: PlayMode;
  isHost: boolean;
  getP1Controls: () => BattleControls;
  getP2Controls: () => BattleControls;
  onSnapshot: (snap: {
    phase: BattlePhase;
    round: number;
    left: CreatureState;
    right: CreatureState;
  }) => void;
  remoteSnapshotRef: React.MutableRefObject<WorldSnapshot | null>;
}

function ArenaCanvas({
  engine,
  mode,
  isHost,
  getP1Controls,
  getP2Controls,
  onSnapshot,
  remoteSnapshotRef,
}: ArenaCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cb = useRef({ getP1Controls, getP2Controls, onSnapshot });
  cb.current = { getP1Controls, getP2Controls, onSnapshot };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;
    let frameCount = 0;

    canvas.width = engine.W;
    canvas.height = engine.H;
    ctx.imageSmoothingEnabled = false;


    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) {
        last = 0;
        return;
      }
      if (!last) last = t;
      acc += Math.min(100, t - last);
      last = t;

      if (mode === "online") {
        // Authoritative Colyseus Server Mode: render server snapshot
        if (remoteSnapshotRef.current) {
          const snap = remoteSnapshotRef.current;
          engine.renderSnapshot(ctx, snap);
          cb.current.onSnapshot({
            phase: snap.phase,
            round: snap.round,
            left: { ...engine.leftState, ...snap.left },
            right: { ...engine.rightState, ...snap.right },
          });
        }
        // Stream player controls to Colyseus server every frame
        colyseusNet.sendControls(cb.current.getP1Controls());
        return;
      }

      // Solo or Local 2-Player: simulate physics client-side
      let n = 0;
      while (acc >= STEP_MS && n < 5) {
        engine.setControls(cb.current.getP1Controls(), cb.current.getP2Controls());
        engine.step();
        acc -= STEP_MS;
        n++;
      }
      if (n === 5) acc = 0;

      engine.render(ctx);
      frameCount++;

      // Emit snapshot for HUD every 2 frames (~30Hz update)
      if (frameCount % 2 === 0) {
        cb.current.onSnapshot(engine.getSnapshot());
      }
    };

    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
      },
      { threshold: 0.05 }
    );
    if (wrapRef.current) io.observe(wrapRef.current);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [engine, mode, isHost, remoteSnapshotRef]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-[#070b18]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full select-none"
        style={{ imageRendering: "pixelated" }}
        role="img"
        aria-label="2D Creature Battle Arena"
      />
    </div>
  );
}

export function BattlerGame() {
  const [touchEnabled, setTouchEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768)
  );
  const [screen, setScreen] = useState<"select" | "arena">("select");
  const [mode, setMode] = useState<PlayMode>("solo");
  const [muted, setMuted] = useState(sound.muted);

  // Creatures Selection
  const [p1Creature, setP1Creature] = useState<Creature>(CREATURES[0]); // Pyrokid
  const [p2Creature, setP2Creature] = useState<Creature>(CREATURES[1]); // Aquanaut

  // Online Multiplayer State
  const [onlineTab, setOnlineTab] = useState<"menu" | "host" | "join">("menu");
  const [roomCode, setRoomCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  const p1CreatureRef = useRef(p1Creature);
  p1CreatureRef.current = p1Creature;
  const p2CreatureRef = useRef(p2Creature);
  p2CreatureRef.current = p2Creature;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const remoteControlsRef = useRef<BattleControls>(emptyBattleControls());
  const remoteSnapshotRef = useRef<WorldSnapshot | null>(null);

  // Setup Colyseus Network Listeners
  useEffect(() => {
    colyseusNet.onAssignedSide = (side, rId) => {
      setIsHost(side === "left");
      setRoomCode(rId);
    };

    colyseusNet.onDisconnect = () => {
      setPeerConnected(false);
    };

    colyseusNet.onStateUpdate = (snap, rawState) => {
      remoteSnapshotRef.current = snap;

      const isLeft = colyseusNet.mySide === "left";
      const oppId = isLeft ? rawState.right.creatureId : rawState.left.creatureId;
      const opp = CREATURE_MAP[oppId];
      if (opp) setP2Creature(opp);

      // Trigger audio on server game events
      if (snap.flash.text === "FIGHT!" && snap.flash.t === 30) {
        sound.go();
      } else if (snap.flash.text.startsWith("ROUND") && snap.flash.t === 40) {
        sound.tick();
      }

      if (rawState.phase !== "waiting") {
        setPeerConnected(true);
      }

      if (screen !== "arena" && (rawState.phase === "countdown" || rawState.phase === "battle")) {
        sound.unlock();
        const leftC = CREATURE_MAP[rawState.left.creatureId] || p1CreatureRef.current;
        const rightC = CREATURE_MAP[rawState.right.creatureId] || p2CreatureRef.current;
        const eng = new PhysicsEngine(320, 170, leftC, rightC, false);
        setEngine(eng);
        setSnapshot({
          phase: snap.phase,
          round: snap.round,
          left: { ...eng.leftState, ...snap.left },
          right: { ...eng.rightState, ...snap.right },
        });
        setScreen("arena");
        sound.ambience(true);
      } else if (screen === "arena") {
        setSnapshot((prev) => {
          if (!prev) return null;
          return {
            phase: snap.phase,
            round: snap.round,
            left: { ...prev.left, ...snap.left },
            right: { ...prev.right, ...snap.right },
          };
        });
        if (snap.phase === "match_over" && (snap.left.roundsWon >= 2 || snap.right.roundsWon >= 2)) {
          sound.matchWin();
        }
      }
    };

    return () => {
      colyseusNet.leave();
    };
  }, [screen]);

  // Engine instance & HUD snapshot state
  const [engine, setEngine] = useState<PhysicsEngine | null>(null);
  const [snapshot, setSnapshot] = useState<{
    phase: BattlePhase;
    round: number;
    left: CreatureState;
    right: CreatureState;
  } | null>(null);

  // Controls Refs
  const kbP1 = useRef<BattleControls>(emptyBattleControls());
  const kbP2 = useRef<BattleControls>(emptyBattleControls());
  const tcP1 = useRef<BattleControls>(emptyBattleControls());
  const tcP2 = useRef<BattleControls>(emptyBattleControls());

  const mergedP1 = useRef<BattleControls>(emptyBattleControls());
  const mergedP2 = useRef<BattleControls>(emptyBattleControls());

  const getP1Controls = useCallback(() => {
    const m = mergedP1.current;
    m.left = kbP1.current.left || tcP1.current.left;
    m.right = kbP1.current.right || tcP1.current.right;
    m.jump = kbP1.current.jump || tcP1.current.jump;
    m.move1 = kbP1.current.move1 || tcP1.current.move1;
    m.move2 = kbP1.current.move2 || tcP1.current.move2;
    m.move3 = kbP1.current.move3 || tcP1.current.move3;
    m.move4 = kbP1.current.move4 || tcP1.current.move4;
    return m;
  }, []);

  const getP2Controls = useCallback(() => {
    if (mode === "online" && isHost) {
      return remoteControlsRef.current;
    }
    const m = mergedP2.current;
    m.left = kbP2.current.left || tcP2.current.left;
    m.right = kbP2.current.right || tcP2.current.right;
    m.jump = kbP2.current.jump || tcP2.current.jump;
    m.move1 = kbP2.current.move1 || tcP2.current.move1;
    m.move2 = kbP2.current.move2 || tcP2.current.move2;
    m.move3 = kbP2.current.move3 || tcP2.current.move3;
    m.move4 = kbP2.current.move4 || tcP2.current.move4;
    return m;
  }, [mode, isHost]);

  const toggleMute = () => {
    sound.unlock();
    const m = !muted;
    sound.setMuted(m);
    setMuted(m);
  };

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      sound.ambience(false);
    };
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      let hit = false;

      // Player 1 controls (WASD + Space/F/Q/E)
      if (k === "a") { kbP1.current.left = down; hit = true; }
      else if (k === "d") { kbP1.current.right = down; hit = true; }
      else if (k === "w") { kbP1.current.jump = down; hit = true; }
      else if (k === " ") { kbP1.current.move1 = down; hit = true; }
      else if (k === "f") { kbP1.current.move2 = down; hit = true; }
      else if (k === "q") { kbP1.current.move3 = down; hit = true; }
      else if (k === "e") { kbP1.current.move4 = down; hit = true; }

      // In Solo mode, arrows can also control P1 movement
      if (mode === "solo") {
        if (k === "arrowleft") { kbP1.current.left = down; hit = true; }
        else if (k === "arrowright") { kbP1.current.right = down; hit = true; }
        else if (k === "arrowup") { kbP1.current.jump = down; hit = true; }
      }

      // Player 2 controls in Local 2-Player mode (Arrows + Enter/L/K/O)
      if (mode === "local2p") {
        if (k === "arrowleft") { kbP2.current.left = down; hit = true; }
        else if (k === "arrowright") { kbP2.current.right = down; hit = true; }
        else if (k === "arrowup") { kbP2.current.jump = down; hit = true; }
        else if (k === "enter") { kbP2.current.move1 = down; hit = true; }
        else if (k === "l") { kbP2.current.move2 = down; hit = true; }
        else if (k === "k") { kbP2.current.move3 = down; hit = true; }
        else if (k === "o") { kbP2.current.move4 = down; hit = true; }
      }

      return hit;
    };

    const onDown = (e: KeyboardEvent) => {
      if (screen === "select" && e.key === "Enter") {
        e.preventDefault();
        startMatch();
        return;
      }
      if (set(e, true)) e.preventDefault();
    };

    const onUp = (e: KeyboardEvent) => {
      if (set(e, false)) e.preventDefault();
    };

    const clear = () => {
      kbP1.current = emptyBattleControls();
      kbP2.current = emptyBattleControls();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
    };
  }, [screen, mode]);

  // Start / Init Match (Solo / Local)
  const startMatch = useCallback(() => {
    sound.unlock();
    const isAiBot = mode === "solo";
    const eng = new PhysicsEngine(320, 170, p1Creature, p2Creature, isAiBot);
    eng.startMatch();
    setEngine(eng);
    setSnapshot(eng.getSnapshot());
    setScreen("arena");
    sound.ambience(true);
  }, [mode, p1Creature, p2Creature]);

  const [serverUrl, setServerUrl] = useState(() => colyseusNet.serverUrl);

  const handleUpdateServerUrl = (url: string) => {
    if (!url) return;
    colyseusNet.setCustomServerUrl(url);
    setServerUrl(url);
  };

  // Online Colyseus Handlers
  const handleHostOnline = async () => {
    setIsHost(true);
    isHostRef.current = true;
    setMode("online");
    try {
      const code = await colyseusNet.hostRoom(p1Creature.id);
      setRoomCode(code);
      setOnlineTab("host");
    } catch (err: any) {
      alert("Colyseus Connection Error: " + (err?.message || err));
    }
  };

  const handleJoinOnline = async () => {
    if (!joinCodeInput.trim()) return;
    setIsHost(false);
    isHostRef.current = false;
    setMode("online");
    try {
      const code = joinCodeInput.trim();
      setRoomCode(code);
      await colyseusNet.joinRoom(code, p1Creature.id);
    } catch (err: any) {
      alert("Failed to join room: " + (err?.message || err));
    }
  };

  const handleQuickMatch = async () => {
    setMode("online");
    try {
      const code = await colyseusNet.quickMatch(p1Creature.id);
      setRoomCode(code);
      setOnlineTab("host");
    } catch (err: any) {
      alert("Colyseus Quick Match Error: " + (err?.message || err));
    }
  };

  const handlePlayAgain = () => {
    if (mode === "online") {
      colyseusNet.sendRematch();
    } else if (engine) {
      engine.startMatch();
      setSnapshot(engine.getSnapshot());
    }
  };

  const handleChangeCreature = () => {
    sound.ambience(false);
    colyseusNet.leave();
    setPeerConnected(false);
    setScreen("select");
  };

  const isTwoPlayer = mode === "local2p" || mode === "online";
  const winnerSide =
    snapshot && snapshot.left.roundsWon >= 2
      ? "left"
      : snapshot && snapshot.right.roundsWon >= 2
      ? "right"
      : "left";
  const winnerCreature = winnerSide === "left" ? (snapshot?.left.creature || p1Creature) : (snapshot?.right.creature || p2Creature);
  const loserCreature = winnerSide === "left" ? (snapshot?.right.creature || p2Creature) : (snapshot?.left.creature || p1Creature);

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-[#05070e] p-2 font-mono select-none sm:p-4">
      {/* Outer Game Cabinet Frame */}
      <div className="relative flex w-full max-w-4xl flex-col border border-white/20 bg-[#090d19] shadow-2xl overflow-hidden rounded-sm">
        {screen === "select" ? (
          <div className="aspect-[2/1] min-h-[500px] w-full">
            <SelectScreen
              mode={mode}
              onModeChange={setMode}
              p1Creature={p1Creature}
              p2Creature={p2Creature}
              onSelectP1={setP1Creature}
              onSelectP2={setP2Creature}
              onStartMatch={startMatch}
              muted={muted}
              onToggleMute={toggleMute}
              onlineTab={onlineTab}
              setOnlineTab={setOnlineTab}
              roomCode={roomCode}
              joinCodeInput={joinCodeInput}
              setJoinCodeInput={setJoinCodeInput}
              onHostOnline={handleHostOnline}
              onJoinOnline={handleJoinOnline}
              onQuickMatch={handleQuickMatch}
              serverUrl={serverUrl}
              onUpdateServerUrl={handleUpdateServerUrl}
              peerConnected={peerConnected}
              copied={copied}
              onCopyRoomCode={() => {
                navigator.clipboard.writeText(roomCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            />
          </div>
        ) : (
          <div className="relative aspect-[2/1] min-h-[460px] max-h-[600px] w-full overflow-hidden bg-black">
            {/* Top Bar inside match */}
            <div className="absolute top-1 left-2 z-30 flex items-center gap-2">
              <button
                type="button"
                onClick={handleChangeCreature}
                className="flex items-center gap-1 border border-white/20 bg-black/60 px-2 py-1 text-[10px] text-white/70 hover:bg-white hover:text-black transition"
              >
                <ArrowLeft size={11} />
                <span>ROSTER</span>
              </button>
            </div>

            <div className="absolute top-1 right-2 z-30 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTouchEnabled((prev) => !prev)}
                className={`flex items-center gap-1 border px-2 py-1 text-[10px] font-bold transition ${
                  touchEnabled
                    ? "border-emerald-400 bg-emerald-950/70 text-emerald-300"
                    : "border-white/20 bg-black/60 text-white/60 hover:text-white"
                }`}
                title="Toggle Mobile Touch Controls"
              >
                <Smartphone size={11} />
                <span className="hidden sm:inline">TOUCH:</span>
                <span>{touchEnabled ? "ON" : "OFF"}</span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="grid size-7 place-items-center border border-white/20 bg-black/60 text-white/70 hover:bg-white hover:text-black transition"
              >
                {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            </div>

            {/* Arena Canvas */}
            <ArenaCanvas
              engine={engine}
              mode={mode}
              isHost={isHost}
              getP1Controls={getP1Controls}
              getP2Controls={getP2Controls}
              onSnapshot={setSnapshot}
              remoteSnapshotRef={remoteSnapshotRef}
            />

            {/* CRT Scanline Retro Overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_4px)]" />

            {/* In-Match HUD */}
            {snapshot && (
              <Hud
                leftState={snapshot.left}
                rightState={snapshot.right}
                currentRound={snapshot.round}
                isTwoPlayer={isTwoPlayer}
                hideAbilityBar={touchEnabled}
              />
            )}

            {/* Enhanced Mobile Touch Controls */}
            {touchEnabled && snapshot && (
              <div className="absolute inset-x-0 bottom-2 z-20 flex items-end justify-between px-2 sm:px-4 pointer-events-auto touch-none select-none">
                {/* Movement D-Pad */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); tcP1.current.left = true; }}
                    onPointerUp={(e) => { e.preventDefault(); tcP1.current.left = false; }}
                    onPointerCancel={() => { tcP1.current.left = false; }}
                    onPointerLeave={() => { tcP1.current.left = false; }}
                    className="grid size-12 place-items-center rounded-lg border border-white/30 bg-black/80 text-xl font-bold text-white shadow-lg active:scale-95 active:bg-white active:text-black touch-none"
                    aria-label="Run Left"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); tcP1.current.right = true; }}
                    onPointerUp={(e) => { e.preventDefault(); tcP1.current.right = false; }}
                    onPointerCancel={() => { tcP1.current.right = false; }}
                    onPointerLeave={() => { tcP1.current.right = false; }}
                    className="grid size-12 place-items-center rounded-lg border border-white/30 bg-black/80 text-xl font-bold text-white shadow-lg active:scale-95 active:bg-white active:text-black touch-none"
                    aria-label="Run Right"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); tcP1.current.jump = true; }}
                    onPointerUp={(e) => { e.preventDefault(); tcP1.current.jump = false; }}
                    onPointerCancel={() => { tcP1.current.jump = false; }}
                    onPointerLeave={() => { tcP1.current.jump = false; }}
                    className="grid size-12 place-items-center rounded-lg border border-emerald-400/60 bg-black/80 text-xl font-bold text-emerald-400 shadow-lg active:scale-95 active:bg-emerald-400 active:text-black touch-none"
                    aria-label="Jump"
                  >
                    ▲
                  </button>
                </div>

                {/* 4 Ability Slots with Live Cooldowns */}
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-2">
                  {snapshot.left.creature.moves.map((mId, slot) => {
                    const move = MOVES[mId];
                    if (!move) return null;
                    const meta = TYPE_META[move.type];
                    const cd = snapshot.left.cooldowns[slot];
                    const cdPct = cd > 0 ? Math.min(100, (cd / move.cooldownMs) * 100) : 0;

                    return (
                      <button
                        key={mId}
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          if (slot === 0) tcP1.current.move1 = true;
                          if (slot === 1) tcP1.current.move2 = true;
                          if (slot === 2) tcP1.current.move3 = true;
                          if (slot === 3) tcP1.current.move4 = true;
                        }}
                        onPointerUp={(e) => {
                          e.preventDefault();
                          if (slot === 0) tcP1.current.move1 = false;
                          if (slot === 1) tcP1.current.move2 = false;
                          if (slot === 2) tcP1.current.move3 = false;
                          if (slot === 3) tcP1.current.move4 = false;
                        }}
                        onPointerCancel={() => {
                          if (slot === 0) tcP1.current.move1 = false;
                          if (slot === 1) tcP1.current.move2 = false;
                          if (slot === 2) tcP1.current.move3 = false;
                          if (slot === 3) tcP1.current.move4 = false;
                        }}
                        onPointerLeave={() => {
                          if (slot === 0) tcP1.current.move1 = false;
                          if (slot === 1) tcP1.current.move2 = false;
                          if (slot === 2) tcP1.current.move3 = false;
                          if (slot === 3) tcP1.current.move4 = false;
                        }}
                        className="relative flex flex-col items-center justify-between overflow-hidden rounded border bg-black/85 p-1 w-16 sm:w-18 h-12 shadow-lg active:scale-95 touch-none"
                        style={{
                          borderColor: cd > 0 ? "rgba(255,255,255,0.2)" : meta.color,
                        }}
                      >
                        {/* Cooldown sweep overlay */}
                        {cd > 0 && (
                          <div
                            className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-[1px] transition-all pointer-events-none"
                            style={{ height: `${cdPct}%` }}
                          />
                        )}

                        <span className="relative z-10 text-[8px] font-bold text-white/50 uppercase leading-none">
                          M{slot + 1}
                        </span>
                        <span className="relative z-10 text-[9px] font-bold text-white truncate w-full text-center leading-tight">
                          {move.name}
                        </span>

                        <div className="relative z-10 flex items-center justify-center w-full">
                          {cd > 0 ? (
                            <span className="text-[9px] font-mono font-bold text-amber-300">
                              {(cd / 1000).toFixed(1)}s
                            </span>
                          ) : (
                            <span
                              className="text-[7px] font-bold uppercase px-1 rounded"
                              style={{ backgroundColor: meta.darkColor, color: "#fff" }}
                            >
                              {meta.name}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Result Screen when match is over */}
            {snapshot && snapshot.phase === "match_over" && (
              <ResultScreen
                winnerCreature={winnerCreature}
                loserCreature={loserCreature}
                winnerSide={winnerSide}
                p1Rounds={snapshot.left.roundsWon}
                p2Rounds={snapshot.right.roundsWon}
                isTwoPlayer={isTwoPlayer}
                onPlayAgain={handlePlayAgain}
                onChangeCreature={handleChangeCreature}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
