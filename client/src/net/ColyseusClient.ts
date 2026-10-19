import { Client, type Room } from "colyseus.js";
import type { BattleControls, BattlePhase, WorldSnapshot } from "@game/shared";

export interface ColyseusCreatureState {
  side: "left" | "right";
  creatureId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  anim: number;
  hp: number;
  maxHp: number;
  cd0: number;
  cd1: number;
  cd2: number;
  cd3: number;
  castT: number;
  hurtT: number;
  stunT: number;
  slowT: number;
  burnT: number;
  isKo: boolean;
  roundsWon: number;
}

export interface ColyseusHitbox {
  id: string;
  x: number;
  y: number;
  radius: number;
  shape: "melee" | "projectile" | "aoe";
  color: string;
}

export interface ColyseusParticle {
  x: number;
  y: number;
  color: string;
}

export interface ColyseusPopup {
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface ColyseusFlash {
  text: string;
  color: string;
  t: number;
}

export interface ColyseusBattleState {
  phase: string;
  round: number;
  shake: number;
  left: ColyseusCreatureState;
  right: ColyseusCreatureState;
  hitboxes: ColyseusHitbox[];
  particles: ColyseusParticle[];
  popups: ColyseusPopup[];
  flash: ColyseusFlash;
}

export class ColyseusClientManager {
  private client: Client;
  public room: Room | null = null;
  public mySide: "left" | "right" = "left";
  public roomId: string = "";
  public serverUrl: string;

  public onAssignedSide?: (side: "left" | "right", roomId: string) => void;
  public onStateUpdate?: (snap: WorldSnapshot, rawState: ColyseusBattleState) => void;
  public onMatchStart?: () => void;
  public onDisconnect?: (reason: string) => void;

  constructor() {
    this.serverUrl =
      (typeof localStorage !== "undefined" && localStorage.getItem("custom_colyseus_url")) ||
      import.meta.env.VITE_SERVER_URL ||
      this.getDefaultServerUrl();
    this.client = new Client(this.serverUrl);
  }

  private getDefaultServerUrl(): string {
    if (typeof window === "undefined") return "ws://localhost:2567";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    return `${proto}//${host}:2567`;
  }

  setCustomServerUrl(url: string) {
    this.serverUrl = url;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("custom_colyseus_url", url);
    }
    this.client = new Client(url);
  }

  async hostRoom(creatureId: string): Promise<string> {
    this.leave();
    this.room = await this.client.create("battle_room", { creatureId });
    this.roomId = this.room.id;
    this.mySide = "left";
    this.setupRoomListeners(this.room);
    return this.room.id;
  }

  async joinRoom(roomId: string, creatureId: string): Promise<void> {
    this.leave();
    this.room = await this.client.joinById(roomId.trim(), { creatureId });
    this.roomId = this.room.id;
    this.mySide = "right";
    this.setupRoomListeners(this.room);
  }

  async quickMatch(creatureId: string): Promise<string> {
    this.leave();
    this.room = await this.client.joinOrCreate("battle_room", { creatureId });
    this.roomId = this.room.id;
    this.setupRoomListeners(this.room);
    return this.room.id;
  }

  sendControls(ctl: BattleControls) {
    if (this.room) {
      this.room.send("input", ctl);
    }
  }

  sendRematch() {
    if (this.room) {
      this.room.send("rematch");
    }
  }

  leave() {
    if (this.room) {
      try {
        this.room.leave();
      } catch {
        // ignore
      }
      this.room = null;
      this.roomId = "";
    }
  }

  private setupRoomListeners(room: Room) {
    room.onMessage("assigned_side", (data: { side: "left" | "right"; roomId: string }) => {
      this.mySide = data.side;
      this.roomId = data.roomId;
      this.onAssignedSide?.(data.side, data.roomId);
    });

    room.onStateChange((state: ColyseusBattleState) => {
      const snap = this.stateToSnapshot(state);
      this.onStateUpdate?.(snap, state);
    });

    room.onLeave((code) => {
      this.onDisconnect?.(`Disconnected from server (code ${code})`);
      this.room = null;
    });

    room.onError((code, message) => {
      this.onDisconnect?.(`Connection error ${code}: ${message}`);
    });
  }

  private stateToSnapshot(state: ColyseusBattleState): WorldSnapshot {
    const hitboxes = state.hitboxes ? Array.from(state.hitboxes).map((h) => ({
      x: h.x,
      y: h.y,
      radius: h.radius,
      shape: h.shape,
      color: h.color,
    })) : [];

    const particles = state.particles ? Array.from(state.particles).map((p) => ({
      x: p.x,
      y: p.y,
      color: p.color,
    })) : [];

    const popups = state.popups ? Array.from(state.popups).map((pop) => ({
      x: pop.x,
      y: pop.y,
      text: pop.text,
      color: pop.color,
    })) : [];

    return {
      frame: 0,
      phase: state.phase as BattlePhase,
      round: state.round,
      shake: state.shake || 0,
      flash: {
        text: state.flash?.text || "",
        color: state.flash?.color || "#ffffff",
        t: state.flash?.t || 0,
      },
      left: {
        x: state.left.x,
        y: state.left.y,
        vx: state.left.vx,
        vy: state.left.vy,
        facing: (state.left.facing > 0 ? 1 : -1) as 1 | -1,
        onGround: state.left.onGround,
        anim: state.left.anim,
        hp: state.left.hp,
        maxHp: state.left.maxHp,
        cooldowns: [state.left.cd0, state.left.cd1, state.left.cd2, state.left.cd3],
        castT: state.left.castT,
        hurtT: state.left.hurtT,
        stunT: state.left.stunT,
        slowT: state.left.slowT,
        burnT: state.left.burnT,
        isKo: state.left.isKo,
        roundsWon: state.left.roundsWon,
      },
      right: {
        x: state.right.x,
        y: state.right.y,
        vx: state.right.vx,
        vy: state.right.vy,
        facing: (state.right.facing > 0 ? 1 : -1) as 1 | -1,
        onGround: state.right.onGround,
        anim: state.right.anim,
        hp: state.right.hp,
        maxHp: state.right.maxHp,
        cooldowns: [state.right.cd0, state.right.cd1, state.right.cd2, state.right.cd3],
        castT: state.right.castT,
        hurtT: state.right.hurtT,
        stunT: state.right.stunT,
        slowT: state.right.slowT,
        burnT: state.right.burnT,
        isKo: state.right.isKo,
        roundsWon: state.right.roundsWon,
      },
      hitboxes,
      particles,
      popups,
    };
  }
}

export const colyseusNet = new ColyseusClientManager();
