import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, ArrowLeft, Smartphone } from "lucide-react";
import {
  CREATURES,
  CREATURE_MAP,
  type Creature,
  type CreatureState,
  type BattleControls,
  type PlayMode,
  type WorldSnapshot,
  emptyBattleControls,
  SimulationCore,
  BotBrain,
  MOVES,
  TYPE_META,
} from "@game/shared";
import { ArenaRenderer } from "../../render/ArenaRenderer";
import { sound } from "../../audio/Sound";
import { Hud } from "../../render/Hud";
import { SelectScreen } from "../../ui/SelectScreen";
import { ResultScreen } from "../../ui/ResultScreen";
import { colyseusNet } from "../../net/ColyseusClient";
import { OnlineLobbyModal } from "../../ui/OnlineLobbyModal";

const STEP_MS = 1000 / 60;

interface ArenaCanvasProps {
  sim: SimulationCore | null;
  botBrain: BotBrain | null;
  mode: PlayMode;
  p1Creature: Creature;
  p2Creature: Creature;
  getP1Controls: () => BattleControls;
  getP2Controls: () => BattleControls;
  onSnapshot: (snap: WorldSnapshot) => void;
  remoteSnapshotRef: React.MutableRefObject<WorldSnapshot | null>;
}

function ArenaCanvas({
  sim,
  botBrain,
  mode,
  p1Creature,
  p2Creature,
  getP1Controls,
  getP2Controls,
  onSnapshot,
  remoteSnapshotRef,
}: ArenaCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ArenaRenderer | null>(null);

  const cb = useRef({ getP1Controls, getP2Controls, onSnapshot });
  cb.current = { getP1Controls, getP2Controls, onSnapshot };

  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new ArenaRenderer(320, 170);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;
    let frameCount = 0;

    canvas.width = 320;
    canvas.height = 170;
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

      const renderer = rendererRef.current;
      if (!renderer) return;

      if (mode === "online") {
        // Authoritative Colyseus Server Mode: render server snapshot
        if (remoteSnapshotRef.current) {
          const snap = remoteSnapshotRef.current;
          renderer.render(ctx, snap, p1Creature, p2Creature);
          cb.current.onSnapshot(snap);
        }
        // Stream local player controls to Colyseus server every frame
        colyseusNet.sendControls(cb.current.getP1Controls());
        return;
      }

      // Offline / Local Simulation
      if (!sim) return;

      let n = 0;
      while (acc >= STEP_MS && n < 5) {
        const p1 = cb.current.getP1Controls();
        let p2 = cb.current.getP2Controls();

        if (mode === "solo" && botBrain) {
          p2 = botBrain.computeControls(sim.rightState, sim.leftState);
        }

        sim.step(p1, p2);
        acc -= STEP_MS;
        n++;
      }
      if (n === 5) acc = 0;

      const snap = sim.getSnapshot();
      renderer.render(ctx, snap, p1Creature, p2Creature);
      frameCount++;

      // Emit snapshot for HUD every 2 frames (~30Hz update)
      if (frameCount % 2 === 0) {
        cb.current.onSnapshot(snap);
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
  }, [sim, botBrain, mode, p1Creature, p2Creature, remoteSnapshotRef]);

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
  const [screen, setScreen] = useState<"select" | "lobby" | "arena">("select");
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const [mode, setMode] = useState<PlayMode>("solo");
  const [muted, setMuted] = useState(sound.muted);

  // Creatures Selection
  const [p1Creature, setP1Creature] = useState<Creature>(CREATURES[0]); // Pyrokid
  const [p2Creature, setP2Creature] = useState<Creature>(CREATURES[1]); // Aquanaut

  // Online Multiplayer State
  const [onlineTab, setOnlineTab] = useState<"menu" | "host" | "join">("menu");
  const [roomCode, setRoomCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [, setIsHost] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  // Online Connecting / Button Feedback states
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingAction, setConnectingAction] = useState<"create" | "join" | "quick" | null>(null);

  // Online Lobby & Connection Live state from Colyseus
  const [onlineP1CreatureId, setOnlineP1CreatureId] = useState("pyrokid");
  const [onlineP2CreatureId, setOnlineP2CreatureId] = useState("aquanaut");
  const [onlineP1Ready, setOnlineP1Ready] = useState(false);
  const [onlineP2Ready, setOnlineP2Ready] = useState(false);
  const [onlineP1Connected, setOnlineP1Connected] = useState(true);
  const [onlineP2Connected, setOnlineP2Connected] = useState(false);
  const [onlineLobbyCountdown, setOnlineLobbyCountdown] = useState(-1);
  const [, setOnlinePhase] = useState<string>("waiting");

  const p1CreatureRef = useRef(p1Creature);
  p1CreatureRef.current = p1Creature;
  const p2CreatureRef = useRef(p2Creature);
  p2CreatureRef.current = p2Creature;

  const remoteSnapshotRef = useRef<WorldSnapshot | null>(null);

  // SimulationCore and Bot instances for offline mode
  const [sim, setSim] = useState<SimulationCore | null>(null);
  const [botBrain] = useState<BotBrain>(() => new BotBrain());
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);

  // Centralized cleanup for online room/lobby state
  const resetOnlineSession = useCallback(() => {
    colyseusNet.leave();
    setRoomCode("");
    setJoinCodeInput("");
    setOnlineTab("menu");
    setPeerConnected(false);
    setOnlinePhase("waiting");
    setOnlineP1Ready(false);
    setOnlineP2Ready(false);
    setOnlineLobbyCountdown(-1);
    setIsConnecting(false);
    setConnectingAction(null);
  }, []);

  // Setup Colyseus Network Listeners ONCE (lifetime of component)
  useEffect(() => {
    colyseusNet.onAssignedSide = (side, rId) => {
      setIsHost(side === "left");
      setRoomCode(rId);
    };

    colyseusNet.onRoomDisbanded = (reason) => {
      alert(reason || "Room was disbanded.");
      resetOnlineSession();
      setScreen("select");
    };

    colyseusNet.onDisconnect = (reason) => {
      if (screenRef.current === "lobby") {
        alert(reason || "Disconnected from lobby.");
        resetOnlineSession();
        setScreen("select");
      } else {
        setPeerConnected(false);
      }
    };

    colyseusNet.onStateUpdate = (snap, rawState) => {
      remoteSnapshotRef.current = snap;

      if (rawState.phase) {
        setOnlinePhase(rawState.phase);
      }
      if (typeof rawState.p1Connected === "boolean") setOnlineP1Connected(rawState.p1Connected);
      if (typeof rawState.p2Connected === "boolean") setOnlineP2Connected(rawState.p2Connected);
      if (typeof rawState.p1Ready === "boolean") setOnlineP1Ready(rawState.p1Ready);
      if (typeof rawState.p2Ready === "boolean") setOnlineP2Ready(rawState.p2Ready);
      if (rawState.p1CreatureId) setOnlineP1CreatureId(rawState.p1CreatureId);
      if (rawState.p2CreatureId) setOnlineP2CreatureId(rawState.p2CreatureId);
      if (typeof rawState.lobbyCountdown === "number") setOnlineLobbyCountdown(rawState.lobbyCountdown);

      const isLeft = colyseusNet.mySide === "left";
      const oppId = isLeft ? rawState.right.creatureId : rawState.left.creatureId;
      const opp = CREATURE_MAP[oppId];
      if (opp) setP2Creature(opp);

      // Trigger audio on server game events
      if (snap.flash?.text === "FIGHT!" && snap.flash?.t === 30) {
        sound.go();
      } else if (snap.flash?.text?.startsWith("ROUND") && snap.flash?.t === 40) {
        sound.tick();
      }

      if (rawState.phase !== "waiting") {
        setPeerConnected(true);
      }

      // Screen state transitions based on authoritative Colyseus phase
      if (rawState.phase === "lobby") {
        if (screenRef.current !== "lobby") {
          setScreen("lobby");
        }
      } else if (rawState.phase === "countdown" || rawState.phase === "battle") {
        if (screenRef.current !== "arena") {
          sound.unlock();
          setSnapshot(snap);
          setScreen("arena");
          sound.ambience(true);
        } else {
          setSnapshot(snap);
        }
      } else if (screenRef.current === "arena") {
        setSnapshot(snap);
        if (snap.phase === "match_over" && (snap.left.roundsWon >= 2 || snap.right.roundsWon >= 2)) {
          sound.matchWin();
        }
      }
    };

    return () => {
      colyseusNet.leave();
    };
  }, [resetOnlineSession]);

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
    const m = mergedP2.current;
    m.left = kbP2.current.left || tcP2.current.left;
    m.right = kbP2.current.right || tcP2.current.right;
    m.jump = kbP2.current.jump || tcP2.current.jump;
    m.move1 = kbP2.current.move1 || tcP2.current.move1;
    m.move2 = kbP2.current.move2 || tcP2.current.move2;
    m.move3 = kbP2.current.move3 || tcP2.current.move3;
    m.move4 = kbP2.current.move4 || tcP2.current.move4;
    return m;
  }, []);

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

  // Start / Init Match (Solo / Local)
  const startMatch = useCallback(() => {
    sound.unlock();
    const core = new SimulationCore(320, 170, p1Creature, p2Creature);
    core.startMatch();
    setSim(core);
    setSnapshot(core.getSnapshot());
    setScreen("arena");
    sound.ambience(true);
  }, [p1Creature, p2Creature]);

  // Keyboard Listeners
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      let hit = false;

      // In Local 2-Player mode, both players share the keyboard:
      // P1: Left side (WASD run, W/Space jump, F/G/R/T abilities)
      // P2: Right side (Arrows run/jump, J/K/L/I abilities)
      if (mode === "local2p") {
        // P1 Movement (WASD + Space)
        if (k === "a") { kbP1.current.left = down; hit = true; }
        else if (k === "d") { kbP1.current.right = down; hit = true; }
        else if (k === "w" || k === " ") { kbP1.current.jump = down; hit = true; }
        // P1 Attacks (F, G, R, T or Z, X, C, V)
        else if (k === "f" || k === "z") { kbP1.current.move1 = down; hit = true; }
        else if (k === "g" || k === "x") { kbP1.current.move2 = down; hit = true; }
        else if (k === "r" || k === "c") { kbP1.current.move3 = down; hit = true; }
        else if (k === "t" || k === "v") { kbP1.current.move4 = down; hit = true; }

        // P2 Movement (Arrow keys)
        if (k === "arrowleft") { kbP2.current.left = down; hit = true; }
        else if (k === "arrowright") { kbP2.current.right = down; hit = true; }
        else if (k === "arrowup") { kbP2.current.jump = down; hit = true; }
        // P2 Attacks (J, K, L, I or Enter)
        else if (k === "j" || k === "enter") { kbP2.current.move1 = down; hit = true; }
        else if (k === "k") { kbP2.current.move2 = down; hit = true; }
        else if (k === "l") { kbP2.current.move3 = down; hit = true; }
        else if (k === "i" || k === "u" || k === "o") { kbP2.current.move4 = down; hit = true; }

        return hit;
      }

      // Solo and Online mode: Option A (Modern Two-Handed Brawler Layout)
      // Left Hand: Movement (A/D run, Space/W jump, or Arrow keys)
      if (k === "a" || k === "arrowleft") {
        kbP1.current.left = down;
        hit = true;
      } else if (k === "d" || k === "arrowright") {
        kbP1.current.right = down;
        hit = true;
      } else if (k === "w" || k === " " || k === "arrowup") {
        kbP1.current.jump = down;
        hit = true;
      }

      // Right Hand: Combat Actions (Option A: J, K, L, I/U)
      else if (k === "j" || k === "1" || k === "z") {
        kbP1.current.move1 = down;
        hit = true;
      } else if (k === "k" || k === "2" || k === "x") {
        kbP1.current.move2 = down;
        hit = true;
      } else if (k === "l" || k === "3" || k === "c") {
        kbP1.current.move3 = down;
        hit = true;
      } else if (k === "i" || k === "u" || k === "4" || k === "v") {
        kbP1.current.move4 = down;
        hit = true;
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
  }, [screen, mode, startMatch]);

  const [serverUrl, setServerUrl] = useState(() => colyseusNet.serverUrl);

  const handleUpdateServerUrl = (url: string) => {
    if (!url) return;
    colyseusNet.setCustomServerUrl(url);
    setServerUrl(url);
  };

  // Online Colyseus Handlers
  const handleHostOnline = async () => {
    setIsHost(true);
    setMode("online");
    setRoomCode(""); // Immediately clear any stale room code so UI shows "CONNECTING..."
    setIsConnecting(true);
    setConnectingAction("create");
    try {
      const code = await colyseusNet.hostRoom(p1Creature.id);
      setRoomCode(code);
      setOnlineTab("host");
    } catch (err: any) {
      alert("Colyseus Connection Error: " + (err?.message || err));
      resetOnlineSession();
    } finally {
      setIsConnecting(false);
      setConnectingAction(null);
    }
  };

  const handleJoinOnline = async () => {
    if (!joinCodeInput.trim()) return;
    setIsHost(false);
    setMode("online");
    setRoomCode("");
    setIsConnecting(true);
    setConnectingAction("join");
    try {
      const code = joinCodeInput.trim();
      await colyseusNet.joinRoom(code, p1Creature.id);
      setRoomCode(code);
    } catch (err: any) {
      alert("Failed to join room: " + (err?.message || err));
      resetOnlineSession();
    } finally {
      setIsConnecting(false);
      setConnectingAction(null);
    }
  };

  const handleQuickMatch = async () => {
    setMode("online");
    setRoomCode("");
    setIsConnecting(true);
    setConnectingAction("quick");
    try {
      const code = await colyseusNet.quickMatch(p1Creature.id);
      setRoomCode(code);
      setOnlineTab("host");
    } catch (err: any) {
      alert("Colyseus Quick Match Error: " + (err?.message || err));
      resetOnlineSession();
    } finally {
      setIsConnecting(false);
      setConnectingAction(null);
    }
  };

  const handlePlayAgain = () => {
    if (mode === "online") {
      colyseusNet.sendRematch();
    } else if (sim) {
      sim.startMatch();
      setSnapshot(sim.getSnapshot());
    }
  };

  const handleChangeCreature = () => {
    sound.ambience(false);
    if (mode === "online") {
      resetOnlineSession();
    }
    setScreen("select");
  };

  const effectiveLeftCreature = mode === "online"
    ? CREATURE_MAP[onlineP1CreatureId] || p1Creature
    : p1Creature;

  const effectiveRightCreature = mode === "online"
    ? CREATURE_MAP[onlineP2CreatureId] || p2Creature
    : p2Creature;

  const isTwoPlayer = mode === "local2p" || mode === "online";
  const winnerSide =
    snapshot && snapshot.left.roundsWon >= 2
      ? "left"
      : snapshot && snapshot.right.roundsWon >= 2
      ? "right"
      : "left";
  const winnerCreature = winnerSide === "left" ? effectiveLeftCreature : effectiveRightCreature;
  const loserCreature = winnerSide === "left" ? effectiveRightCreature : effectiveLeftCreature;

  // Construct full creature state representation for HUD
  const hudLeftState: CreatureState | null = snapshot
    ? {
        ...snapshot.left,
        creature: effectiveLeftCreature,
        side: "left",
      }
    : null;

  const hudRightState: CreatureState | null = snapshot
    ? {
        ...snapshot.right,
        creature: effectiveRightCreature,
        side: "right",
      }
    : null;

  const isOnlineRightPlayer = mode === "online" && colyseusNet.mySide === "right";
  const myTouchCreature = isOnlineRightPlayer ? effectiveRightCreature : effectiveLeftCreature;

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
              isConnecting={isConnecting}
              connectingAction={connectingAction}
              onCancelOnline={resetOnlineSession}
            />
          </div>
        ) : screen === "lobby" ? (
          <div className="aspect-[2/1] min-h-[500px] w-full">
            <OnlineLobbyModal
              roomId={roomCode}
              mySide={colyseusNet.mySide}
              p1CreatureId={onlineP1CreatureId}
              p2CreatureId={onlineP2CreatureId}
              p1Ready={onlineP1Ready}
              p2Ready={onlineP2Ready}
              p1Connected={onlineP1Connected}
              p2Connected={onlineP2Connected}
              lobbyCountdown={onlineLobbyCountdown}
              onSelectCreature={(creatureId) => colyseusNet.selectCreature(creatureId)}
              onToggleReady={() => colyseusNet.toggleReady()}
              onLeave={() => {
                resetOnlineSession();
                setScreen("select");
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
              sim={sim}
              botBrain={botBrain}
              mode={mode}
              p1Creature={effectiveLeftCreature}
              p2Creature={effectiveRightCreature}
              getP1Controls={getP1Controls}
              getP2Controls={getP2Controls}
              onSnapshot={setSnapshot}
              remoteSnapshotRef={remoteSnapshotRef}
            />

            {/* CRT Scanline Retro Overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_4px)]" />

            {/* In-Match HUD */}
            {hudLeftState && hudRightState && (
              <Hud
                leftState={hudLeftState}
                rightState={hudRightState}
                currentRound={snapshot?.round || 1}
                isTwoPlayer={isTwoPlayer}
                hideAbilityBar={touchEnabled}
                isOnline={mode === "online"}
                p1Connected={onlineP1Connected}
                p2Connected={onlineP2Connected}
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
                  {myTouchCreature.moves.map((mId, slot) => {
                    const move = MOVES[mId];
                    if (!move) return null;
                    const meta = TYPE_META[move.type];
                    const activeCreatureState = isOnlineRightPlayer ? snapshot.right : snapshot.left;
                    const cd = activeCreatureState.cooldowns[slot];
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
