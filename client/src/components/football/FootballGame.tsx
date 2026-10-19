import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Users, Bot, Globe, Copy, Check } from "lucide-react";
import Peer, { type DataConnection } from "peerjs";
import { sound } from "./Sound";
import { ResultScreen } from "./ResultScreen";
import {
  FootballGame as EngineFootballGame,
  WIN_SCORE,
  emptyControls,
  type Controls,
  type SfxName,
  type UiState,
} from "./engine";

const STEP_MS = 1000 / 60;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type PlayMode = "solo" | "local2p" | "online";

interface PitchProps {
  demo?: boolean;
  twoPlayer?: boolean;
  getControls?: () => Controls;
  getRightControls?: () => Controls;
  onUi?: (u: UiState) => void;
  onSfx?: (e: SfxName, v: number) => void;
  gameRef?: React.MutableRefObject<EngineFootballGame | null>;
}

export function PixelPitch({
  demo = false,
  twoPlayer = false,
  getControls,
  getRightControls,
  onUi,
  onSfx,
  gameRef,
}: PitchProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cb = useRef({ getControls, getRightControls, onUi, onSfx });
  cb.current = { getControls, getRightControls, onUi, onSfx };

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const staticMode = demo && reduce;

    let game: EngineFootballGame | null = null;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;
    let lastUi = "";
    const none = emptyControls();

    const build = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 60 || r.height < 30) return;
      const W = clamp(Math.round(r.width / 2.25), 240, 380);
      const scale = r.width / W;
      const H = Math.max(64, Math.round(r.height / scale));
      if (game) {
        const aspectOld = game.W / game.H;
        const keep = demo
          ? Math.abs(W - game.W) < 12 && Math.abs(H - game.H) < 8
          : Math.abs(W / H - aspectOld) / aspectOld < 0.12;
        if (keep) return;
      }
      game = new EngineFootballGame(W, H, { demo, twoPlayer });
      game.sfx = (e, v) => cb.current.onSfx?.(e, v);
      canvas.width = W;
      canvas.height = H;
      ctx.imageSmoothingEnabled = false;
      if (gameRef) gameRef.current = game;
      lastUi = "";
      if (staticMode) {
        for (let i = 0; i < 260; i++) game.step();
        game.render(ctx);
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!game || staticMode) return;
      if (!visible || document.hidden) {
        last = 0;
        return;
      }
      if (!last) last = t;
      acc += Math.min(100, t - last);
      last = t;
      let n = 0;
      while (acc >= STEP_MS && n < 5) {
        game.setControls(cb.current.getControls ? cb.current.getControls() : none);
        if (twoPlayer && cb.current.getRightControls) {
          game.setRightControls(cb.current.getRightControls());
        }
        game.step();
        acc -= STEP_MS;
        n++;
      }
      if (n === 5) acc = 0;
      game.render(ctx);
      const u = game.ui();
      const key = `${u.phase}|${u.left}|${u.right}`;
      if (key !== lastUi) {
        lastUi = key;
        cb.current.onUi?.(u);
      }
    };

    build();
    raf = requestAnimationFrame(frame);

    let rz = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(build);
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    }, { threshold: 0.05 });
    io.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rz);
      ro.disconnect();
      io.disconnect();
      if (gameRef) gameRef.current = null;
    };
  }, [demo, twoPlayer, gameRef]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-[#09101f]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full select-none"
        style={{ imageRendering: "pixelated" }}
        role="img"
        aria-label="Pixel football match"
      />
    </div>
  );
}

export function FootballGameScreen() {
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [mode, setMode] = useState<PlayMode>("solo");
  const [ui, setUi] = useState<UiState>({ phase: "ready", left: 0, right: 0, winner: null });
  const [muted, setMuted] = useState(sound.muted);

  // Online Multiplayer State
  const [onlineTab, setOnlineTab] = useState<"menu" | "host" | "join">("menu");
  const [roomCode, setRoomCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [_isHost, setIsHost] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const gameRef = useRef<EngineFootballGame | null>(null);
  const kbP1 = useRef<Controls>(emptyControls());
  const kbP2 = useRef<Controls>(emptyControls());
  const tcP1 = useRef<Controls>(emptyControls());
  const tcP2 = useRef<Controls>(emptyControls());

  const mergedP1 = useRef<Controls>(emptyControls());
  const mergedP2 = useRef<Controls>(emptyControls());

  const getP1Controls = useCallback(() => {
    const m = mergedP1.current;
    m.left = kbP1.current.left || tcP1.current.left;
    m.right = kbP1.current.right || tcP1.current.right;
    m.jump = kbP1.current.jump || tcP1.current.jump;
    m.kick = kbP1.current.kick || tcP1.current.kick;
    return m;
  }, []);

  const getP2Controls = useCallback(() => {
    const m = mergedP2.current;
    m.left = kbP2.current.left || tcP2.current.left;
    m.right = kbP2.current.right || tcP2.current.right;
    m.jump = kbP2.current.jump || tcP2.current.jump;
    m.kick = kbP2.current.kick || tcP2.current.kick;
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

  useEffect(() => {
    sound.ambience(ui.phase === "countdown" || ui.phase === "play" || ui.phase === "goal");
  }, [ui.phase]);

  const uiRef = useRef(ui);
  uiRef.current = ui;

  const begin = useCallback(() => {
    sound.unlock();
    const g = gameRef.current;
    if (!g) return;
    g.start();
  }, []);

  // Keyboard controls listener
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      let hit = false;

      // Player 1 controls
      if (k === "a") { kbP1.current.left = down; hit = true; }
      else if (k === "d") { kbP1.current.right = down; hit = true; }
      else if (k === "w") { kbP1.current.jump = down; hit = true; }
      else if (k === " " || k === "x" || k === "f") { kbP1.current.kick = down; hit = true; }

      // In Solo mode, Arrow keys also control Player 1 (standard convenience)
      if (mode === "solo") {
        if (k === "arrowleft") { kbP1.current.left = down; hit = true; }
        else if (k === "arrowright") { kbP1.current.right = down; hit = true; }
        else if (k === "arrowup") { kbP1.current.jump = down; hit = true; }
      }

      // Player 2 controls in Local 2-Player mode
      if (mode === "local2p") {
        if (k === "arrowleft") { kbP2.current.left = down; hit = true; }
        else if (k === "arrowright") { kbP2.current.right = down; hit = true; }
        else if (k === "arrowup") { kbP2.current.jump = down; hit = true; }
        else if (k === "enter" || k === "l" || k === "arrowdown") { kbP2.current.kick = down; hit = true; }
      }

      return hit;
    };

    const onDown = (e: KeyboardEvent) => {
      const ph = uiRef.current.phase;
      if ((ph === "ready" || ph === "over") && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        begin();
        return;
      }
      if (set(e, true)) e.preventDefault();
    };

    const onUp = (e: KeyboardEvent) => {
      if (set(e, false)) e.preventDefault();
    };

    const clear = () => {
      kbP1.current = emptyControls();
      kbP2.current = emptyControls();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
    };
  }, [begin, mode]);

  // Online P2P Match Handlers
  const handleHostOnline = () => {
    setIsHost(true);
    const code = "BALL-" + Math.floor(1000 + Math.random() * 9000);
    setRoomCode(code);
    setOnlineTab("host");

    const peer = new Peer(code);
    peerRef.current = peer;

    peer.on("open", (id) => setRoomCode(id));
    peer.on("connection", (c) => {
      connRef.current = c;
      c.on("open", () => {
        setPeerConnected(true);
        begin();
      });
      c.on("data", (data: unknown) => {
        const d = data as { type: string; ctl?: Controls };
        if (d.type === "controls" && d.ctl) {
          kbP2.current = d.ctl;
        }
      });
    });
  };

  const handleJoinOnline = () => {
    if (!joinCodeInput.trim()) return;
    setIsHost(false);
    const code = joinCodeInput.trim().toUpperCase();

    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", () => {
      const c = peer.connect(code);
      connRef.current = c;
      c.on("open", () => {
        setPeerConnected(true);
        setMode("online");
        begin();
      });
    });
  };

  const isTwoPlayer = mode === "local2p" || mode === "online";

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-[#070b18] p-2 font-mono select-none sm:p-4">
      {/* Container Frame */}
      <div className="relative flex w-full max-w-4xl flex-col border border-white/20 bg-[#0a0a0a] shadow-2xl">
        {/* Header Bar */}
        <div className="flex h-11 items-center justify-between border-b border-dashed border-white/15 px-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("solo");
                gameRef.current?.setTwoPlayerMode(false);
              }}
              className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
                mode === "solo"
                  ? "border-white bg-white font-bold text-black"
                  : "border-white/20 text-white/60 hover:text-white"
              }`}
            >
              <Bot size={13} />
              <span>VS HARSHIT-BOT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("local2p");
                gameRef.current?.setTwoPlayerMode(true);
              }}
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
              onClick={() => {
                setMode("online");
                gameRef.current?.setTwoPlayerMode(true);
              }}
              className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
                mode === "online"
                  ? "border-white bg-white font-bold text-black"
                  : "border-white/20 text-white/60 hover:text-white"
              }`}
            >
              <Globe size={13} />
              <span>ONLINE P2P</span>
            </button>
          </div>

          {/* Sound Mute */}
          <button
            type="button"
            onClick={toggleMute}
            className="grid size-8 place-items-center border border-dashed border-white/20 text-white/70 transition-colors hover:bg-white hover:text-black"
            aria-label={muted ? "Unmute sound" : "Mute sound"}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        {/* Pitch Area */}
        <div className="relative aspect-[2.3/1] w-full min-h-[220px] max-h-[500px] overflow-hidden bg-[#09101f]">
          <PixelPitch
            twoPlayer={isTwoPlayer}
            getControls={getP1Controls}
            getRightControls={getP2Controls}
            onUi={setUi}
            onSfx={sound.play}
            gameRef={gameRef}
          />

          {/* CRT Scanline Overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_4px)]" />

          {/* Ready Overlay */}
          {ui.phase === "ready" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 px-4 text-center backdrop-blur-[2px]">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">
                <span className="text-red-400 font-bold">{isTwoPlayer ? "Player 1 (Red)" : "You (Red)"}</span> vs{" "}
                <span className="text-blue-400 font-bold">{isTwoPlayer ? "Player 2 (Blue)" : "Harshit (Blue)"}</span>
              </p>
              <h2 className="mt-1 font-mono text-base font-bold uppercase tracking-widest text-white sm:text-xl">
                First to {WIN_SCORE} goals wins
              </h2>

              {mode === "online" && !peerConnected ? (
                <div className="mt-4 flex flex-col items-center gap-3">
                  {onlineTab === "menu" ? (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleHostOnline}
                        className="border-2 border-white bg-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black transition hover:scale-105"
                      >
                        Create Room (Host)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlineTab("join")}
                        className="border-2 border-white/60 bg-black/80 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:scale-105"
                      >
                        Join Room Code
                      </button>
                    </div>
                  ) : onlineTab === "host" ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 border border-yellow-400/60 bg-black/80 px-4 py-2">
                        <span className="text-lg font-bold text-yellow-400">{roomCode}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(roomCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="p-1 hover:text-yellow-400"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <span className="text-[10px] text-white/60 uppercase">
                        Share this code with your friend. Waiting to connect...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="ENTER ROOM CODE"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        className="border border-white/40 bg-black px-3 py-1.5 text-xs uppercase text-white"
                      />
                      <button
                        type="button"
                        onClick={handleJoinOnline}
                        className="border-2 border-white bg-white px-3 py-1.5 text-xs font-bold uppercase text-black"
                      >
                        Join
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={begin}
                  className="mt-3 border-2 border-white bg-white px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-black transition-transform hover:scale-105 active:scale-95 sm:text-sm"
                >
                  Kick off
                </button>
              )}

              {!touch && (
                <p className="mt-2.5 font-mono text-[10px] uppercase tracking-widest text-white/50">
                  press space / enter
                </p>
              )}
            </div>
          )}

          {/* Full-Time Result Screen */}
          {ui.phase === "over" && (
            <ResultScreen
              ui={ui}
              h={280}
              twoPlayer={isTwoPlayer}
              onAgain={begin}
              onMenu={() => {
                gameRef.current?.reset();
              }}
            />
          )}
        </div>

        {/* Footer Controls Cheatsheet */}
        <div className="flex h-12 flex-wrap items-center justify-between border-t border-dashed border-white/10 px-4 font-mono text-[10px] uppercase tracking-widest text-white/60">
          <div className="flex items-center gap-3">
            <span className="font-bold text-red-400">P1 (RED):</span>
            <span><kbd className="border border-white/20 bg-white/10 px-1">A D</kbd> MOVE</span>
            <span><kbd className="border border-white/20 bg-white/10 px-1">W</kbd> JUMP</span>
            <span><kbd className="border border-white/20 bg-white/10 px-1">SPACE / X</kbd> KICK</span>
          </div>

          {mode === "local2p" && (
            <div className="flex items-center gap-3">
              <span className="font-bold text-blue-400">P2 (BLUE):</span>
              <span><kbd className="border border-white/20 bg-white/10 px-1">← →</kbd> MOVE</span>
              <span><kbd className="border border-white/20 bg-white/10 px-1">↑</kbd> JUMP</span>
              <span><kbd className="border border-white/20 bg-white/10 px-1">ENTER / L</kbd> KICK</span>
            </div>
          )}

          {mode === "solo" && (
            <div className="text-white/40">
              HARSHIT-BOT DEFENDS RIGHT GOAL
            </div>
          )}

          {mode === "online" && (
            <div className="text-yellow-400/80">
              {peerConnected ? "● CONNECTED P2P" : "○ WAITING FOR PEER"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
