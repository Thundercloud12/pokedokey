import Peer, { type DataConnection } from "peerjs";
import { type TeamId } from "./constants";

export interface NetworkStatePacket {
  type: "state";
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
  };
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    isKicking: boolean;
  };
  score: { red: number; blue: number };
  phase: "ready" | "play" | "goal" | "countdown" | "over";
}

export interface NetworkInputPacket {
  type: "input";
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    isKicking: boolean;
  };
}

export interface NetworkKickPacket {
  type: "kick";
  power: number;
  dir: [number, number, number];
  isLob: boolean;
}

export interface NetworkGoalPacket {
  type: "goal";
  scorer: TeamId;
}

export type NetworkPacket =
  | NetworkStatePacket
  | NetworkInputPacket
  | NetworkKickPacket
  | NetworkGoalPacket;

export class NetworkManager {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  isHost = false;
  roomCode = "";
  isConnected = false;

  onConnected?: () => void;
  onDisconnected?: () => void;
  onPacket?: (pkt: NetworkPacket) => void;
  onError?: (err: string) => void;

  /**
   * Host creates a match room with a clean 6-digit code.
   */
  async hostMatch(): Promise<string> {
    this.isHost = true;
    const code = "FP-" + Math.floor(1000 + Math.random() * 9000);
    this.roomCode = code;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(code, {
        debug: 1,
      });

      this.peer.on("open", (id) => {
        this.roomCode = id;
        resolve(id);
      });

      this.peer.on("connection", (connection) => {
        this.conn = connection;
        this.setupConnectionHandlers();
      });

      this.peer.on("error", (err) => {
        this.onError?.(err.message);
        reject(err);
      });
    });
  }

  /**
   * Guest joins host with room code.
   */
  async joinMatch(code: string): Promise<void> {
    this.isHost = false;
    this.roomCode = code.trim().toUpperCase();

    return new Promise((resolve, reject) => {
      this.peer = new Peer({
        debug: 1,
      });

      this.peer.on("open", () => {
        const connection = this.peer!.connect(this.roomCode, {
          reliable: false, // Low latency UDP-like channel for 60Hz game sync
        });
        this.conn = connection;
        this.setupConnectionHandlers();
        resolve();
      });

      this.peer.on("error", (err) => {
        this.onError?.(err.message);
        reject(err);
      });
    });
  }

  private setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on("open", () => {
      this.isConnected = true;
      this.onConnected?.();
    });

    this.conn.on("data", (data) => {
      this.onPacket?.(data as NetworkPacket);
    });

    this.conn.on("close", () => {
      this.isConnected = false;
      this.onDisconnected?.();
    });

    this.conn.on("error", (err) => {
      this.onError?.(err.message);
    });
  }

  send(packet: NetworkPacket) {
    if (this.conn && this.conn.open) {
      this.conn.send(packet);
    }
  }

  destroy() {
    this.conn?.close();
    this.peer?.destroy();
    this.isConnected = false;
    this.conn = null;
    this.peer = null;
  }
}
