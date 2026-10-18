import { useEffect, useRef, useState } from "react";
import { FPSFootballEngine, type GameMode, type GameUiState } from "./game/engine";
import { HUD } from "./components/HUD";
import { GoalBanner } from "./components/GoalBanner";
import { ResultModal } from "./components/ResultModal";
import { LobbyModal } from "./components/LobbyModal";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FPSFootballEngine | null>(null);

  const [menuOpen, setMenuOpen] = useState(true);
  const [ui, setUi] = useState<GameUiState>({
    phase: "ready",
    score: { red: 0, blue: 0 },
    winner: null,
    countdownText: "3",
    isLocked: false,
    chargeRatio: 0,
    ballAngleToPlayer: 0,
    ballDistance: 0,
    mode: "bot",
    roomCode: "",
    isHost: false,
    peerConnected: false,
    localTeam: "red",
    pixelScale: 0.45,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Instantiate 3D Engine
    const engine = new FPSFootballEngine(containerRef.current);
    engineRef.current = engine;

    engine.onUiUpdate = (newUi) => {
      setUi(newUi);
    };

    // Check URL params for direct join: e.g. ?room=FP-1234
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    if (roomParam) {
      engine.setGameMode("online", roomParam);
      setMenuOpen(false);
    }

    // Escape key opens menu
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleSelectMode = (mode: GameMode, roomCode?: string) => {
    engineRef.current?.soundUnlock();
    engineRef.current?.setGameMode(mode, roomCode);
  };

  const handleTogglePixelScale = () => {
    if (!engineRef.current) return;
    const scales = [0.35, 0.45, 0.65, 1.0];
    const currentIndex = scales.findIndex((s) => Math.abs(s - ui.pixelScale) < 0.05);
    const nextIndex = (currentIndex + 1) % scales.length;
    const nextScale = scales[nextIndex];
    engineRef.current.setPixelScale(nextScale);
  };

  const handleChangePixelScale = (scale: number) => {
    engineRef.current?.setPixelScale(scale);
  };

  const handleRematch = () => {
    engineRef.current?.soundUnlock();
    engineRef.current?.setGameMode(ui.mode, ui.roomCode);
  };

  const handleBackToLobby = () => {
    setMenuOpen(true);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070a14] select-none">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Retro FPS HUD */}
      <HUD
        ui={ui}
        onTogglePixelScale={handleTogglePixelScale}
        onOpenMenu={() => setMenuOpen(true)}
        onRequestLock={() => engineRef.current?.requestLock()}
      />

      {/* Goal Celebration Banner */}
      <GoalBanner ui={ui} />

      {/* Match Result Screen */}
      <ResultModal
        ui={ui}
        onRematch={handleRematch}
        onBackToLobby={handleBackToLobby}
      />

      {/* Lobby / Mode Selection Modal */}
      <LobbyModal
        isOpen={menuOpen}
        ui={ui}
        onSelectMode={handleSelectMode}
        onChangePixelScale={handleChangePixelScale}
        onRequestLock={() => engineRef.current?.requestLock()}
        onClose={() => {
          engineRef.current?.soundUnlock();
          setMenuOpen(false);
        }}
      />
    </div>
  );
}
