import { joinRoom, type Room } from "trystero/nostr";
import { type BattleControls } from "@game/shared";

export interface NetCreatureSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  anim: number;
  hp: number;
  maxHp: number;
  cooldowns: [number, number, number, number];
  castT: number;
  hurtT: number;
  stunT: number;
  slowT: number;
  burnT: number;
  isKo: boolean;
  roundsWon: number;
}

export interface NetHitboxSnapshot {
  x: number;
  y: number;
  radius: number;
  shape: "melee" | "projectile" | "aoe";
  color: string;
}

export interface NetParticleSnapshot {
  x: number;
  y: number;
  color: string;
}

export interface NetPopupSnapshot {
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface WorldSnapshot {
  [key: string]: unknown;
  frame: number;
  phase: "ready" | "countdown" | "battle" | "round_end" | "match_over";
  round: number;
  left: NetCreatureSnapshot;
  right: NetCreatureSnapshot;
  hitboxes: NetHitboxSnapshot[];
  particles: NetParticleSnapshot[];
  popups: NetPopupSnapshot[];
  flash: { text: string; color: string; t: number };
  shake: number;
}

export interface RosterPayload {
  [key: string]: unknown;
  creatureId: string;
  isHost: boolean;
}

const APP_ID = "creature-arena-battler-v1";

export class TrysteroNetwork {
  room: Room | null = null;
  roomCode = "";
  isHost = false;
  peerId: string | null = null;

  // Actions
  private sendControlsAction: ((data: BattleControls) => void) | null = null;
  private sendWorldAction: ((data: WorldSnapshot) => void) | null = null;
  private sendRosterAction: ((data: RosterPayload) => void) | null = null;

  // Callbacks
  onPeerJoin?: (peerId: string) => void;
  onPeerLeave?: (peerId: string) => void;
  onControlsReceived?: (ctl: BattleControls) => void;
  onWorldReceived?: (snap: WorldSnapshot) => void;
  onRosterReceived?: (roster: RosterPayload) => void;

  join(roomCode: string, isHost: boolean) {
    this.leave();
    this.roomCode = roomCode.trim().toUpperCase();
    this.isHost = isHost;

    const room = joinRoom({ appId: APP_ID }, this.roomCode);
    this.room = room;

    const controlsAction = room.makeAction("controls");
    const worldAction = room.makeAction("world");
    const rosterAction = room.makeAction("roster");

    this.sendControlsAction = (ctl) => {
      controlsAction.send(ctl as unknown as any);
    };

    this.sendWorldAction = (snap) => {
      worldAction.send(snap as unknown as any);
    };

    this.sendRosterAction = (roster) => {
      rosterAction.send(roster as unknown as any);
    };

    controlsAction.onMessage = (ctl) => {
      this.onControlsReceived?.(ctl as unknown as BattleControls);
    };

    worldAction.onMessage = (snap) => {
      this.onWorldReceived?.(snap as unknown as WorldSnapshot);
    };

    rosterAction.onMessage = (roster) => {
      this.onRosterReceived?.(roster as unknown as RosterPayload);
    };

    room.onPeerJoin = (id: string) => {
      this.peerId = id;
      this.onPeerJoin?.(id);
    };

    room.onPeerLeave = (id: string) => {
      if (this.peerId === id) this.peerId = null;
      this.onPeerLeave?.(id);
    };
  }

  sendControls(ctl: BattleControls) {
    this.sendControlsAction?.(ctl);
  }

  sendWorld(snap: WorldSnapshot) {
    this.sendWorldAction?.(snap);
  }

  sendRoster(roster: RosterPayload) {
    this.sendRosterAction?.(roster);
  }

  leave() {
    if (this.room) {
      try {
        this.room.leave();
      } catch {
        // ignore
      }
      this.room = null;
    }
    this.peerId = null;
  }
}

export const network = new TrysteroNetwork();
