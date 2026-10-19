import React, { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Flame,
  Droplets,
  Wind,
  Layers,
  Zap,
  Sprout,
  Swords,
  Shield,
  Smartphone,
  Keyboard,
  Check,
} from "lucide-react";
import { TYPE_META, TYPE_CHART, type TypeId } from "@game/shared";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ELEMENT_ICONS: Record<TypeId, React.ReactNode> = {
  ember: <Flame size={14} className="text-orange-400" />,
  tide: <Droplets size={14} className="text-sky-400" />,
  gale: <Wind size={14} className="text-purple-400" />,
  stone: <Layers size={14} className="text-stone-400" />,
  volt: <Zap size={14} className="text-yellow-400" />,
  bloom: <Sprout size={14} className="text-emerald-400" />,
};

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<TypeId>("ember");
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("creature_battler_tutorial_seen", "true");
    }
    onClose();
  };

  const steps = [
    {
      title: "1. WELCOME TO THE ARENA",
      subtitle: "REAL-TIME PLATFORM COMBAT",
      icon: <Swords size={20} className="text-amber-400" />,
      content: (
        <div className="flex flex-col gap-3 text-xs text-white/80 leading-relaxed">
          <p>
            Welcome to the <strong>2D Creature Arena Battler</strong>! This is an original real-time
            retro combat game where you take direct control of a creature in a platform stadium.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            <div className="border border-white/10 bg-white/5 p-2.5 rounded">
              <span className="font-bold text-amber-300 block mb-1">BEST OF 3 ROUNDS</span>
              <p className="text-[11px] text-white/70">
                Each battle is a best-of-3 tournament. Knock out your opponent's HP to win a round. First to 2 rounds wins the match!
              </p>
            </div>
            <div className="border border-white/10 bg-white/5 p-2.5 rounded">
              <span className="font-bold text-emerald-300 block mb-1">PLATFORM ARENA</span>
              <p className="text-[11px] text-white/70">
                Use the 3 floating arena platforms! Jump through from underneath to gain height advantage or dodge oncoming blasts.
              </p>
            </div>
          </div>
          <div className="border border-amber-500/30 bg-amber-950/20 p-2 rounded text-[11px] text-amber-200">
            💡 <strong>Pro Tip:</strong> Spacing is key! Time your attacks between your opponent's cooldowns and dodge projectile attacks by jumping onto platforms.
          </div>
        </div>
      ),
    },
    {
      title: "2. 4 COMBAT ABILITIES",
      subtitle: "MASTER YOUR LOADOUT",
      icon: <Zap size={20} className="text-yellow-400" />,
      content: (
        <div className="flex flex-col gap-2.5 text-xs text-white/80 leading-relaxed">
          <p>
            Every creature is armed with <strong>4 unique active moves</strong> bound to quick cooldowns:
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="border border-white/15 bg-black/40 p-2 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-[11px]">SLOT 1: MELEE</span>
                <span className="text-[9px] bg-red-950 text-red-300 px-1 rounded">FAST</span>
              </div>
              <p className="text-[10px] text-white/60">
                Short-range strike with a forward lunge. Fast cooldown (~0.8s) for close-quarters skirmishing.
              </p>
            </div>

            <div className="border border-white/15 bg-black/40 p-2 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-[11px]">SLOT 2: PROJECTILE</span>
                <span className="text-[9px] bg-sky-950 text-sky-300 px-1 rounded">RANGED</span>
              </div>
              <p className="text-[10px] text-white/60">
                Shoots an elemental missile across the arena. Excellent for keeping pressure from afar.
              </p>
            </div>

            <div className="border border-white/15 bg-black/40 p-2 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-[11px]">SLOT 3: AREA OF EFFECT</span>
                <span className="text-[9px] bg-purple-950 text-purple-300 px-1 rounded">AOE</span>
              </div>
              <p className="text-[10px] text-white/60">
                Expands a wide shockwave zone around you. Hits through platform edges and punishes aerial jumps.
              </p>
            </div>

            <div className="border border-white/15 bg-black/40 p-2 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-[11px]">SLOT 4: SPECIAL</span>
                <span className="text-[9px] bg-amber-950 text-amber-300 px-1 rounded">HEAVY</span>
              </div>
              <p className="text-[10px] text-white/60">
                High-impact ability with status effects (Stun, Slow, Burn) and heavy knockback impulse.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-white/60">
            Cooldown sweeps are visible directly on your in-match HUD or mobile ability buttons.
          </p>
        </div>
      ),
    },
    {
      title: "3. THE 6-ELEMENT WHEEL",
      subtitle: "SUPER EFFECTIVE DAMAGE",
      icon: <Flame size={20} className="text-orange-400" />,
      content: (
        <div className="flex flex-col gap-2.5 text-xs text-white/80 leading-relaxed">
          <p>
            Damage multiplies based on the <strong>6-Element Advantage Wheel</strong>. Click any element below to inspect its counters:
          </p>

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-6 gap-1 mt-1">
            {(Object.keys(TYPE_META) as TypeId[]).map((tId) => {
              const meta = TYPE_META[tId];
              const isSelected = selectedType === tId;
              return (
                <button
                  key={tId}
                  type="button"
                  onClick={() => setSelectedType(tId)}
                  className={`flex flex-col items-center p-1.5 rounded border transition ${
                    isSelected
                      ? "border-white bg-white/20 font-bold scale-105"
                      : "border-white/10 bg-black/30 hover:border-white/40"
                  }`}
                >
                  {ELEMENT_ICONS[tId]}
                  <span className="text-[9px] text-white mt-1 uppercase">{meta.name}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Type Detail */}
          <div className="border border-white/20 bg-black/50 p-3 rounded mt-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white"
                style={{ backgroundColor: TYPE_META[selectedType].darkColor }}
              >
                {TYPE_META[selectedType].name}
              </span>
              <span className="text-[11px] text-white/70">Effectiveness Profile</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-emerald-400 font-bold block mb-1">
                  ⚡ SUPER EFFECTIVE (1.5x DMG)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(TYPE_CHART[selectedType] || {})
                    .filter(([_, mult]) => mult && mult > 1.0)
                    .map(([defId]) => (
                      <span
                        key={defId}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-emerald-950 border border-emerald-500/50 uppercase"
                      >
                        {defId}
                      </span>
                    ))}
                </div>
              </div>

              <div>
                <span className="text-rose-400 font-bold block mb-1">
                  🛡️ RESISTED (0.7x DMG)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(TYPE_CHART[selectedType] || {})
                    .filter(([_, mult]) => mult && mult < 1.0)
                    .map(([defId]) => (
                      <span
                        key={defId}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-rose-950 border border-rose-500/50 uppercase"
                      >
                        {defId}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "4. STATUS EFFECTS",
      subtitle: "TURN THE TIDE OF COMBAT",
      icon: <Shield size={20} className="text-cyan-400" />,
      content: (
        <div className="flex flex-col gap-3 text-xs text-white/80 leading-relaxed">
          <p>
            Certain abilities inflict debilitating conditions that can disrupt your opponent's rhythm:
          </p>

          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-start gap-2.5 border border-orange-500/30 bg-orange-950/20 p-2.5 rounded">
              <span className="px-1.5 py-0.5 bg-orange-600 font-bold text-[10px] text-white rounded">
                BURN
              </span>
              <p className="text-[11px] text-white/80">
                Deals <strong>3 periodic damage</strong> every second for the duration of the burn. Perfect for finishing off low-health opponents who try to run.
              </p>
            </div>

            <div className="flex items-start gap-2.5 border border-blue-500/30 bg-blue-950/20 p-2.5 rounded">
              <span className="px-1.5 py-0.5 bg-blue-600 font-bold text-[10px] text-white rounded">
                SLOW
              </span>
              <p className="text-[11px] text-white/80">
                Reduces opponent run speed by <strong>40%</strong>. Makes it easy to close in with heavy melee or predict projectile paths.
              </p>
            </div>

            <div className="flex items-start gap-2.5 border border-yellow-500/30 bg-yellow-950/20 p-2.5 rounded">
              <span className="px-1.5 py-0.5 bg-yellow-500 text-black font-bold text-[10px] rounded">
                STUN
              </span>
              <p className="text-[11px] text-white/80">
                Completely <strong>freezes movement and casting</strong> for a short duration. Leaves the target totally vulnerable to an uninterrupted combo!
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "5. CONTROLS GUIDE",
      subtitle: "DESKTOP KEYBOARD & MOBILE TOUCH",
      icon: <Smartphone size={20} className="text-emerald-400" />,
      content: (
        <div className="flex flex-col gap-3 text-xs text-white/80 leading-relaxed">
          <div className="border border-white/15 bg-black/40 p-2.5 rounded">
            <div className="flex items-center gap-1.5 font-bold text-white mb-1.5">
              <Keyboard size={13} className="text-amber-400" />
              <span>DESKTOP CONTROLS</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-white/5 p-1.5 rounded">
                <span className="text-amber-300 font-bold block">P1 / SOLO / ONLINE:</span>
                <span>Run: <strong>A / D (or ← / →)</strong></span><br />
                <span>Jump: <strong>Space or W (or ↑)</strong></span><br />
                <span>Abilities: <strong>J, K, L, I</strong></span>
              </div>
              <div className="bg-white/5 p-1.5 rounded">
                <span className="text-blue-300 font-bold block">P2 (LOCAL 2P):</span>
                <span>Run: <strong>← / →</strong></span><br />
                <span>Jump: <strong>↑</strong></span><br />
                <span>Abilities: <strong>J, K, L, I</strong></span>
              </div>
            </div>
          </div>

          <div className="border border-white/15 bg-black/40 p-2.5 rounded">
            <div className="flex items-center gap-1.5 font-bold text-white mb-1.5">
              <Smartphone size={13} className="text-emerald-400" />
              <span>MOBILE PHONE & TOUCH CONTROLS</span>
            </div>
            <p className="text-[11px] text-white/70">
              On phones, tablets, or touch screens, on-screen controls appear automatically:
            </p>
            <div className="grid grid-cols-2 gap-2 mt-1.5 text-[10px]">
              <div className="bg-white/5 p-1.5 rounded">
                <strong className="text-white">Left Thumb:</strong> ◀ Run Left • ▶ Run Right • ▲ Jump
              </div>
              <div className="bg-white/5 p-1.5 rounded">
                <strong className="text-white">Right Thumb:</strong> M1, M2, M3, M4 Ability buttons with live cooldown indicators.
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md select-none font-mono">
      <div className="relative flex w-full max-w-lg flex-col border border-white/30 bg-[#070b18] shadow-2xl overflow-hidden rounded">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-dashed border-white/20 bg-black/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {currentStep.icon}
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                {currentStep.title}
              </h2>
              <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-widest block">
                {currentStep.subtitle}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="grid size-7 place-items-center border border-white/20 text-white/60 hover:border-white hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 min-h-[260px] flex flex-col justify-between">
          {currentStep.content}
        </div>

        {/* Modal Footer & Navigation */}
        <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-2.5 text-xs">
          <label className="flex items-center gap-1.5 text-[10px] text-white/50 cursor-pointer hover:text-white/80">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="accent-amber-400 size-3"
            />
            <span>Don't show again</span>
          </label>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 border border-white/20 px-2.5 py-1 text-[11px] text-white hover:bg-white/10 transition"
              >
                <ChevronLeft size={13} />
                <span>PREV</span>
              </button>
            )}

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 border border-white bg-white px-3 py-1 text-[11px] font-bold text-black hover:bg-white/90 transition"
              >
                <span>NEXT</span>
                <ChevronRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1 border border-amber-400 bg-amber-400 px-3 py-1 text-[11px] font-bold text-black hover:bg-amber-300 transition"
              >
                <Check size={13} />
                <span>START BATTLING!</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
