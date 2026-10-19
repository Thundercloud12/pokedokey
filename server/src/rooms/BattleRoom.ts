import { Room, type Client, type Delayed } from "@colyseus/core";
import { BattleState, syncSimulationToSchema } from "./schema/BattleState.js";
import {
  SimulationCore,
  emptyBattleControls,
  type BattleControls,
  CREATURE_MAP,
  CREATURES,
} from "@game/shared";

interface JoinOptions {
  creatureId?: string;
}

export class BattleRoom extends Room<BattleState> {
  maxClients = 2;

  private sim!: SimulationCore;
  private p1Client?: Client;
  private p2Client?: Client;
  private p1CreatureId = "pyrokid";
  private p2CreatureId = "aquanaut";

  private waitingTimer?: Delayed;
  private lobbyCountdownTimer?: Delayed;
  private matchOverTimer?: Delayed;

  onCreate(options: JoinOptions) {
    this.autoDispose = true;
    this.setState(new BattleState());

    const c1 = CREATURE_MAP[options.creatureId || "pyrokid"] || CREATURES[0];
    const c2 = CREATURES[1];

    this.sim = new SimulationCore(320, 170, c1, c2);
    syncSimulationToSchema(this.sim, this.state);

    // Initial 2-minute idle timer for room creation
    this.resetWaitingTimer();

    // Client input handler
    this.onMessage("input", (client: Client, controls: BattleControls) => {
      if (this.p1Client && client.sessionId === this.p1Client.sessionId) {
        this.sim.p1Controls = controls;
      } else if (this.p2Client && client.sessionId === this.p2Client.sessionId) {
        this.sim.p2Controls = controls;
      }
    });

    // Creature selection in lobby
    this.onMessage("select_creature", (client: Client, data: { creatureId: string }) => {
      if (this.state.phase !== "lobby" && this.state.phase !== "waiting") return;
      const validId = CREATURE_MAP[data?.creatureId] ? data.creatureId : "pyrokid";

      if (this.p1Client && client.sessionId === this.p1Client.sessionId) {
        if (this.state.p1Ready) return; // Cannot change while ready
        this.p1CreatureId = validId;
        this.state.p1CreatureId = validId;
      } else if (this.p2Client && client.sessionId === this.p2Client.sessionId) {
        if (this.state.p2Ready) return; // Cannot change while ready
        this.p2CreatureId = validId;
        this.state.p2CreatureId = validId;
      }

      this.resetLobbyCountdown();
    });

    // Ready toggle in lobby
    this.onMessage("toggle_ready", (client: Client) => {
      if (this.state.phase !== "lobby") return;

      if (this.p1Client && client.sessionId === this.p1Client.sessionId) {
        this.state.p1Ready = !this.state.p1Ready;
      } else if (this.p2Client && client.sessionId === this.p2Client.sessionId) {
        this.state.p2Ready = !this.state.p2Ready;
      }

      this.checkBothReady();
    });

    // Rematch handler
    this.onMessage("rematch", () => {
      if (this.state.phase === "match_over") {
        if (this.matchOverTimer) {
          this.matchOverTimer.clear();
          this.matchOverTimer = undefined;
        }
        const c1 = CREATURE_MAP[this.state.p1CreatureId] || CREATURES[0];
        const c2 = CREATURE_MAP[this.state.p2CreatureId] || CREATURES[1];
        this.sim.setCreatures(c1, c2);
        this.sim.startMatch();
        this.state.phase = "countdown";
        syncSimulationToSchema(this.sim, this.state);
      }
    });

    // 60 FPS authoritative server loop
    this.setSimulationInterval(() => this.updatePhysics(), 1000 / 60);
  }

  onJoin(client: Client, options: JoinOptions) {
    const chosenCreature = options.creatureId && CREATURE_MAP[options.creatureId]
      ? options.creatureId
      : "pyrokid";

    if (!this.p1Client) {
      this.p1Client = client;
      this.p1CreatureId = chosenCreature;
      this.state.p1CreatureId = chosenCreature;
      this.state.p1Connected = true;
      this.state.p1Ready = false;
      this.state.phase = "waiting";
      this.state.flash.text = "WAITING FOR OPPONENT...";
      this.state.flash.color = "#38bdf8";
      this.state.flash.t = 10000;
      client.send("assigned_side", { side: "left", roomId: this.roomId });
    } else if (!this.p2Client) {
      this.p2Client = client;
      this.p2CreatureId = options.creatureId && CREATURE_MAP[options.creatureId]
        ? options.creatureId
        : "aquanaut";
      this.state.p2CreatureId = this.p2CreatureId;
      this.state.p2Connected = true;
      this.state.p2Ready = false;
      client.send("assigned_side", { side: "right", roomId: this.roomId });

      // Both players connected -> transition to interactive lobby!
      this.state.phase = "lobby";
      this.state.flash.text = "SELECT YOUR CREATURE & READY UP!";
      this.state.flash.color = "#eab308";
      this.state.flash.t = 180;

      // Restart 2-minute timer for lobby idle stage
      this.resetWaitingTimer();
    }
  }

  private checkBothReady() {
    if (this.state.p1Ready && this.state.p2Ready) {
      if (!this.lobbyCountdownTimer) {
        this.startLobbyCountdown();
      }
    } else {
      this.resetLobbyCountdown();
    }
  }

  private startLobbyCountdown() {
    this.state.lobbyCountdown = 3;
    this.state.flash.text = "MATCH STARTING IN 3...";
    this.state.flash.color = "#22c55e";
    this.state.flash.t = 60;

    this.lobbyCountdownTimer = this.clock.setInterval(() => {
      this.state.lobbyCountdown -= 1;
      if (this.state.lobbyCountdown > 0) {
        this.state.flash.text = `MATCH STARTING IN ${this.state.lobbyCountdown}...`;
        this.state.flash.color = "#22c55e";
        this.state.flash.t = 60;
      } else {
        if (this.lobbyCountdownTimer) {
          this.lobbyCountdownTimer.clear();
          this.lobbyCountdownTimer = undefined;
        }
        this.state.lobbyCountdown = -1;
        this.launchMatch();
      }
    }, 1000);
  }

  private resetLobbyCountdown() {
    if (this.lobbyCountdownTimer) {
      this.lobbyCountdownTimer.clear();
      this.lobbyCountdownTimer = undefined;
    }
    this.state.lobbyCountdown = -1;
  }

  private launchMatch() {
    if (this.waitingTimer) {
      this.waitingTimer.clear();
      this.waitingTimer = undefined;
    }

    const c1 = CREATURE_MAP[this.state.p1CreatureId] || CREATURES[0];
    const c2 = CREATURE_MAP[this.state.p2CreatureId] || CREATURES[1];
    this.sim.setCreatures(c1, c2);
    this.sim.startMatch();
    this.state.phase = "countdown";
    syncSimulationToSchema(this.sim, this.state);
  }

  private resetWaitingTimer() {
    if (this.waitingTimer) {
      this.waitingTimer.clear();
      this.waitingTimer = undefined;
    }
    // 2-minute idle teardown window
    this.waitingTimer = this.clock.setTimeout(() => {
      if (this.state.phase === "waiting" || this.state.phase === "lobby") {
        console.log(`[BattleRoom] Room ${this.roomId} idle timeout (2m). Disposing.`);
        this.disconnect();
      }
    }, 2 * 60 * 1000);
  }

  private startMatchOverTimer() {
    if (!this.matchOverTimer) {
      this.matchOverTimer = this.clock.setTimeout(() => {
        console.log(`[BattleRoom] Room ${this.roomId} post-match idle timer expired. Disposing.`);
        this.disconnect();
      }, 2 * 60 * 1000);
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const isP1 = Boolean(this.p1Client && client.sessionId === this.p1Client.sessionId);
    const isP2 = Boolean(this.p2Client && client.sessionId === this.p2Client.sessionId);

    if (!isP1 && !isP2) return;

    // A. LOBBY OR WAITING PHASE
    if (this.state.phase === "waiting" || this.state.phase === "lobby") {
      this.resetLobbyCountdown();

      if (consented) {
        if (isP1) {
          console.log(`[BattleRoom] Host left room ${this.roomId}. Disbanding.`);
          this.broadcast("room_disbanded", { reason: "Host left the lobby." });
          this.disconnect();
          return;
        } else if (isP2) {
          console.log(`[BattleRoom] Challenger left room ${this.roomId}. Reverting to waiting.`);
          this.p2Client = undefined;
          this.state.p2Connected = false;
          this.state.p2Ready = false;
          this.state.p1Ready = false;
          this.state.phase = "waiting";
          this.state.flash.text = "CHALLENGER LEFT. WAITING FOR OPPONENT...";
          this.state.flash.color = "#38bdf8";
          this.state.flash.t = 10000;
          this.resetWaitingTimer();
          return;
        }
      } else {
        // Unconsented disconnect in lobby (refresh / network glitch) -> 20s grace
        try {
          if (isP1) this.state.p1Connected = false;
          if (isP2) this.state.p2Connected = false;
          this.state.flash.text = "PLAYER RECONNECTING (20s)...";
          this.state.flash.color = "#f97316";
          this.state.flash.t = 1200;

          const reconnectedClient = await this.allowReconnection(client, 20);
          if (isP1) {
            this.p1Client = reconnectedClient;
            this.state.p1Connected = true;
          } else {
            this.p2Client = reconnectedClient;
            this.state.p2Connected = true;
          }
          this.state.flash.text = "PLAYER RECONNECTED!";
          this.state.flash.color = "#22c55e";
          this.state.flash.t = 120;
          return;
        } catch {
          if (isP1) {
            console.log(`[BattleRoom] Host reconnect timeout in room ${this.roomId}. Disbanding.`);
            this.broadcast("room_disbanded", { reason: "Host disconnected." });
            this.disconnect();
            return;
          } else {
            console.log(`[BattleRoom] Challenger reconnect timeout in room ${this.roomId}. Reverting to waiting.`);
            this.p2Client = undefined;
            this.state.p2Connected = false;
            this.state.p2Ready = false;
            this.state.p1Ready = false;
            this.state.phase = "waiting";
            this.state.flash.text = "CHALLENGER DISCONNECTED. WAITING FOR OPPONENT...";
            this.state.flash.color = "#38bdf8";
            this.state.flash.t = 10000;
            this.resetWaitingTimer();
            return;
          }
        }
      }
    }

    // B. MID-MATCH (countdown, battle, round_end)
    if (
      this.state.phase === "battle" ||
      this.state.phase === "countdown" ||
      this.state.phase === "round_end"
    ) {
      if (consented) {
        // Explicit forfeit
        if (isP1) {
          this.p1Client = undefined;
          this.state.p1Connected = false;
          this.sim.rightState.roundsWon = 2;
          this.state.phase = "match_over";
          this.state.flash.text = "PLAYER 1 FORFEITED - PLAYER 2 WINS!";
        } else {
          this.p2Client = undefined;
          this.state.p2Connected = false;
          this.sim.leftState.roundsWon = 2;
          this.state.phase = "match_over";
          this.state.flash.text = "PLAYER 2 FORFEITED - PLAYER 1 WINS!";
        }
        this.state.flash.color = "#ef4444";
        this.state.flash.t = 300;
        this.startMatchOverTimer();
        return;
      }

      // Unconsented mid-match drop -> 20-second grace window via allowReconnection
      try {
        if (isP1) {
          this.state.p1Connected = false;
          this.sim.p1Controls = emptyBattleControls();
        } else {
          this.state.p2Connected = false;
          this.sim.p2Controls = emptyBattleControls();
        }

        this.state.flash.text = "OPPONENT DISCONNECTED (20s RECONNECT GRACE)...";
        this.state.flash.color = "#f97316";
        this.state.flash.t = 1200; // 20s at 60fps

        const reconnectedClient = await this.allowReconnection(client, 20);

        if (isP1) {
          this.p1Client = reconnectedClient;
          this.state.p1Connected = true;
        } else {
          this.p2Client = reconnectedClient;
          this.state.p2Connected = true;
        }

        this.state.flash.text = "OPPONENT RECONNECTED!";
        this.state.flash.color = "#22c55e";
        this.state.flash.t = 120;
      } catch {
        // Grace period expired -> Forfeit victory awarded
        if (isP1) {
          this.p1Client = undefined;
          this.state.p1Connected = false;
          this.sim.rightState.roundsWon = 2;
          this.state.phase = "match_over";
          this.state.flash.text = "PLAYER 1 DISCONNECTED - PLAYER 2 WINS!";
        } else {
          this.p2Client = undefined;
          this.state.p2Connected = false;
          this.sim.leftState.roundsWon = 2;
          this.state.phase = "match_over";
          this.state.flash.text = "PLAYER 2 DISCONNECTED - PLAYER 1 WINS!";
        }
        this.state.flash.color = "#ef4444";
        this.state.flash.t = 300;
        this.startMatchOverTimer();
      }
    }

    // C. MATCH OVER PHASE
    if (this.state.phase === "match_over") {
      if (isP1) {
        this.p1Client = undefined;
        this.state.p1Connected = false;
      }
      if (isP2) {
        this.p2Client = undefined;
        this.state.p2Connected = false;
      }
      if (!this.p1Client && !this.p2Client) {
        this.disconnect();
      }
    }
  }

  private updatePhysics() {
    if (this.state.phase !== "waiting" && this.state.phase !== "lobby") {
      this.sim.step();
      syncSimulationToSchema(this.sim, this.state);
    }

    if (this.state.phase === "match_over") {
      this.startMatchOverTimer();
    }
  }

  onDispose() {
    console.log(`[BattleRoom] Room ${this.roomId} disposed.`);
    if (this.waitingTimer) this.waitingTimer.clear();
    if (this.lobbyCountdownTimer) this.lobbyCountdownTimer.clear();
    if (this.matchOverTimer) this.matchOverTimer.clear();
  }
}
