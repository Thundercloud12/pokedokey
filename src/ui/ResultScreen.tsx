import React, { useEffect, useRef } from "react";
import { Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import { type Creature } from "../data/creatures";
import { TYPE_META } from "../data/typeChart";
import { drawCreature } from "../render/CreatureSprite";

interface ResultScreenProps {
  winnerCreature: Creature;
  loserCreature: Creature;
  winnerSide: "left" | "right";
  p1Rounds: number;
  p2Rounds: number;
  isTwoPlayer: boolean;
  onPlayAgain: () => void;
  onChangeCreature: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  winnerCreature,
  loserCreature,
  winnerSide,
  p1Rounds,
  p2Rounds,
  isTwoPlayer,
  onPlayAgain,
  onChangeCreature,
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

      // Winner on left, Loser on right
      // 1. Winner Hopping with Crown
      const hop = Math.round(Math.abs(Math.sin((t % 40) / 40 * Math.PI)) * 12);
      const winX = 40;
      const winY = 45 - hop;

      // Winner Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      const winSw = Math.max(8, 18 - hop);
      ctx.fillRect(winX + 6 - Math.round(winSw / 2), 68, winSw, 2);

      // Draw Winner Creature
      drawCreature(ctx, winnerCreature, {
        x: winX,
        y: winY,
        facing: 1,
        vx: 0,
        onGround: hop === 0,
        anim: t,
        castT: 0,
        hurtT: 0,
        isKo: false,
      });

      // Winner Pixel Crown
      const crownX = winX + 6;
      const crownY = winY - 4;
      ctx.fillStyle = "#facc15";
      // Crown Base
      ctx.fillRect(crownX - 5, crownY, 10, 2);
      // Crown Peaks
      ctx.fillRect(crownX - 5, crownY - 3, 2, 3);
      ctx.fillRect(crownX - 1, crownY - 4, 2, 4);
      ctx.fillRect(crownX + 3, crownY - 3, 2, 3);
      // Jewels
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(crownX - 1, crownY - 1, 2, 1);

      // 2. Loser Sobbing with Tear Streams
      const loseX = 110;
      const loseY = 48 + (Math.floor(t / 8) % 2);

      // Loser Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(loseX + 6 - 9, 68, 18, 2);

      // Draw Loser Creature in hurt/KO posture
      drawCreature(ctx, loserCreature, {
        x: loseX,
        y: loseY,
        facing: -1,
        vx: 0,
        onGround: true,
        anim: 0,
        castT: 0,
        hurtT: t % 20 < 4 ? 6 : 0,
        isKo: false,
      });

      // Loser Tear streams
      ctx.fillStyle = "#38bdf8";
      for (let k = 0; k < 2; k++) {
        const tearY = loseY + 6 + ((Math.floor(t / 2) + k * 4) % 10);
        ctx.fillRect(loseX + 2 - k * 3, tearY, 2, 2);
      }

      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [winnerCreature, loserCreature]);

  const winnerLabel =
    winnerSide === "left"
      ? isTwoPlayer
        ? "PLAYER 1"
        : "PLAYER"
      : isTwoPlayer
      ? "PLAYER 2"
      : "AI BOT";

  const winnerMeta = TYPE_META[winnerCreature.type];

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 p-4 text-white backdrop-blur-md select-none">
      <div className="relative flex w-full max-w-md flex-col items-center border border-white/20 bg-[#070b18] p-6 text-center shadow-2xl">
        {/* Victory Ribbon */}
        <div className="flex items-center gap-2 text-amber-400">
          <Trophy size={20} />
          <span className="font-mono text-xs font-bold uppercase tracking-widest">
            MATCH CONCLUSION
          </span>
          <Trophy size={20} />
        </div>

        {/* Winner Announcement */}
        <h1 className="mt-2 text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
          {winnerCreature.name} VICTORIOUS!
        </h1>

        <div className="mt-1 flex items-center gap-2">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
            style={{ backgroundColor: winnerMeta.darkColor, color: "#ffffff" }}
          >
            {winnerMeta.name}
          </span>
          <span className="text-xs text-white/70">
            {winnerLabel} won the tournament
          </span>
        </div>

        {/* Pixel Character Victory Stage */}
        <div className="my-4 flex items-center justify-center border border-white/10 bg-black/40 p-2">
          <canvas
            ref={canvasRef}
            width={170}
            height={75}
            className="w-64 h-28"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Final Round Scoreline */}
        <div className="flex items-center gap-6 font-mono">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-white/50 uppercase">P1 ROUNDS</span>
            <span className="text-2xl font-black text-white">{p1Rounds}</span>
          </div>
          <span className="text-xl font-bold text-white/30">:</span>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-white/50 uppercase">P2 ROUNDS</span>
            <span className="text-2xl font-black text-white">{p2Rounds}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex w-full gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex flex-1 items-center justify-center gap-2 border-2 border-white bg-white py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-black transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw size={14} />
            <span>PLAY AGAIN</span>
          </button>

          <button
            type="button"
            onClick={onChangeCreature}
            className="flex flex-1 items-center justify-center gap-2 border border-white/40 bg-black/60 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 active:scale-[0.98]"
          >
            <ArrowLeft size={14} />
            <span>CHANGE CREATURE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
