# 2D Creature Arena Battler — Implementation Plan

## Overview

We are converting an existing 2D head-soccer browser game (fixed-timestep physics, WebRTC P2P, procedural Web Audio, pixel sprite characters) into a **2D real-time creature arena battler**: two players each pick an original creature, move around a shared arena with the existing platformer physics, and fight using creature-specific abilities instead of kicking a ball. It keeps the real-time, skill-based feel of the football game instead of becoming a static menu-based turn battler, while adding RPG-style creature variety (stats, types, movesets). All creature names, designs, and the type system must be original to avoid any IP overlap with existing franchises.

## Reuse vs. New vs. Remove

| From existing codebase | Treatment | Notes |
| --- | --- | --- |
| `engine.ts` fixed 60fps loop, gravity/run/jump constants | Reuse | Becomes the per-creature movement base; constants now vary per creature |
| Collision detection (ball vs. post/player) | Reuse | Repurposed as attack-hitbox vs. opponent collision |
| WebRTC room code connect flow | Reuse as-is | Already real-time capable, fits this just as well as the football sync |
| `Sound.ts` Web Audio synthesis | Reuse technique, new sounds | Swap kick/whistle/crowd for attack hits, status effects, faint, victory jingle |
| Procedural stadium generator (mulberry32 seed) | Reuse technique | Repurposed to generate arena backgrounds/hazards instead of a pitch |
| `ResultScreen.tsx` win/lose animations | Reuse | Goal-scored becomes HP-depleted; crown hop / tear spray kept |
| Ball physics (KICK\_VX, BALL\_MAX, deflection) | Remove | No ball object in this game |
| Goal/scoreline logic | Remove | Replaced by HP bars and round wins |
| Penalty box / pitch markings | Remove | Replaced by arena layout (platforms/hazards) |
| Creature stats, movesets, type chart, battle state machine | New | Core new system, detailed below |

## Module Architecture

```
src/
  engine/
    PhysicsEngine.ts       # fixed-timestep loop, per-creature movement (adapted from engine.ts)
    Hitbox.ts               # spawn/collision logic for ability hitboxes
    BattleStateMachine.ts   # round flow: countdown -> active -> hit-resolve -> round-end -> match-end
  data/
    creatures.ts             # creature schema + roster data
    moves.ts                 # move/ability schema + move list
    typeChart.ts              # original type-effectiveness table
  net/
    RoomConnection.ts         # reuse existing WebRTC room-code logic
    SyncProtocol.ts            # per-frame input/state sync messages
  audio/
    Sound.ts                 # extend existing synth with new SFX set
  render/
    ArenaBackground.ts        # adapted procedural generator
    CreatureSprite.ts          # sprite/animation per creature
    Hud.tsx                    # HP bars, cooldown indicators, timer
  ui/
    SelectScreen.tsx           # creature pick/ready-up
    ResultScreen.tsx           # adapted from existing result screen
```

This mirrors the existing project's file split (physics/audio/render/UI) so the agent can largely drop new files alongside the old ones rather than restructure the repo.

## Data Schemas

```ts
interface Creature {
  id: string;
  name: string;            // original name, no IP overlap
  type: TypeId;             // one of the original type set below
  maxHp: number;
  speed: number;             // maps to RUN constant
  jumpPower: number;         // maps to JUMP_V constant
  weight: number;            // affects knockback taken
  moves: [MoveId, MoveId, MoveId, MoveId]; // bound to 4 keys
}

interface Move {
  id: string;
  name: string;
  type: TypeId;
  power: number;             // base damage
  hitboxShape: 'melee' | 'projectile' | 'aoe';
  range: number;
  cooldownMs: number;
  knockback: number;
  statusEffect?: { kind: 'stun' | 'slow' | 'burn'; durationMs: number };
}

type TypeId = 'ember' | 'tide' | 'gale' | 'stone' | 'volt' | 'bloom'; // 6 original types, not the real 18-type grid

// effectiveness multiplier table, e.g. ember > bloom, tide > ember, etc.
const typeChart: Record<TypeId, Partial<Record<TypeId, number>>> = { /* 1.5 = super effective, 0.5 = resisted */ };
```

Start with 6-8 creatures and 4 moves each (24-32 moves total) for the first playable roster.

## Real-Time Combat System

&#91;embedded content: combat round loop · 3 steps, 1 decision\]

Each player moves and jumps with the reused platformer physics, then presses one of 4 move keys to cast an ability bound to a cooldown. The ability spawns a hitbox (melee swing, projectile, or AoE zone) that checks collision against the opponent each physics tick, reusing the existing ball-vs-player collision code. A connecting hit applies damage (scaled by the type-effectiveness multiplier), knockback, and any status effect; a miss simply lets the cooldown continue ticking down. The round ends when either creature's HP reaches 0, at which point control passes to the result screen.

Keep abilities readable at a glance: a short wind-up animation before the hitbox activates (telegraphing), a brief active window, and a cooldown long enough that spamming one move isn't optimal. This is what keeps combat skill-based rather than reaction-spam, matching the feel of the original football game's timing-based kicks.

## Netcode

Reuse the existing WebRTC room-code connect flow as-is (host creates a room, guest joins by code). The sync model does change slightly:

- Still real-time, so sync per physics tick like the football game already does — not a turn-based message-per-move model.
- Each client sends its own input state (movement keys, jump, which move key is pressed) every tick rather than raw position, so both sides simulate identically off the same seed and inputs (lockstep-style) — this avoids re-architecting the physics engine for host-authority.
- If desync becomes visible (hits landing differently on each screen), fall back to host-authoritative: host resolves all hit detection and damage, broadcasts the result, guest only predicts movement and corrects on mismatch.
- Add interpolation on the non-local creature's position so movement doesn't visibly stutter on higher latency connections.
- HP, cooldown state, and round-end are decided authoritatively by whichever side is host, broadcast each tick, to avoid the two clients disagreeing on who won a round.

## UI / UX

- **Select screen** (replaces mode picker): roster grid of 6-8 creatures, each shows name/type/stat bars on hover, both players lock in before the match starts; reuse the existing "VS / 2-Player / Online" mode tabs above it.
- **In-match HUD**: HP bar per player at top (like the old scoreline), 4 ability icons with cooldown sweep per player, round indicator (best of 3).
- **Result screen**: reuse almost directly — winner hops with crown, loser gets tear-spray animation, swap "goal scored" copy for "KO" / round win, keep rematch and mode-switch buttons.

## Audio

Extend the existing Web Audio synthesis approach (no audio files) with a new sound set: ability cast (per type, e.g. a sharper tone for a fast type, a low thud for a heavy type), hit connect, hit miss/whiff, status effect applied, KO/faint, round-win jingle, match-win fanfare. Keep the referee whistle for round start/end and the crowd ambience bed from the football game as-is — it still fits an arena setting.

## Build Order

| Phase | Deliverable | Depends on |
| --- | --- | --- |
| 1 | Strip ball/goal logic from `engine.ts`; add `Hitbox.ts` collision checks reusing existing collision code | Existing codebase |
| 2 | Define `Creature`, `Move`, `TypeId` schemas + a small roster (2-3 creatures, 4 moves each) for local testing | Phase 1 |
| 3 | Local single-device prototype: two keyboard-controlled creatures, move + cast + damage + HP bar, no network | Phase 2 |
| 4 | `BattleStateMachine.ts`: round countdown, active combat, KO detection, round/match win condition | Phase 3 |
| 5 | Wire existing WebRTC room-code flow to send per-tick input instead of ball/player sync | Phase 3 |
| 6 | Select screen + HUD (HP bars, ability cooldown icons) | Phase 3 |
| 7 | Adapt `ResultScreen.tsx` copy/triggers for KO instead of goals | Phase 4 |
| 8 | New audio set via existing Web Audio synth approach | Phase 3 |
| 9 | Expand roster to 6-8 creatures, balance pass on damage/cooldowns/type chart | Phases 4-8 complete |
| 10 | Polish: telegraph animations, knockback feel, arena background variants | Phase 9 |

Build local single-device combat (phases 1-4) before touching netcode (phase 5) — it's much easier to debug hit detection and balance without network variables in the mix.

## IP-Safety Notes

The gameplay genre (real-time creature battling with types/movesets) is not ownable, but these specifics must be original work, not copies or close paraphrases of any existing franchise:

- **Names**: creatures, moves, and the game's own title — don't reuse or lightly reskin existing franchise names.
- **Type system**: the 6-type wheel above (ember/tide/gale/stone/volt/bloom) is a deliberately different count and naming from any existing 18-type grid; keep the effectiveness chart's shape original too, not a 1:1 mapping.
- **Visual design**: distinct silhouettes and color design for each creature; don't trace or closely imitate existing character designs.
- **Sound**: the existing Web Audio synthesis approach already produces original procedural audio, so this is low-risk as long as new SFX aren't literal melody quotes of existing game jingles.

When in doubt on a specific name or design choice, default to something that reads as clearly its own thing rather than "close enough to be recognizable."
