import { Room, type Client, type Delayed } from "@colyseus/core";
import { BattleState } from "./schema/BattleState.js";
import { HeadlessPhysics, type BattleControls, emptyBattleControls } from "../engine/HeadlessPhysics.js";
import { CREATURE_MAP, CREATURES } from "../data/creatures.js";

interface JoinOptions {
  creatureId?: string;
  roomCode?: string;
}

export class BattleRoom extends Room<BattleState> {
  maxClients = 2;

  private physics!: HeadlessPhysics;
  private p1Client?: Client;
  private p2Client?: Client;
  private p1CreatureId = "pyrokid";
  private p2CreatureId = "aquanaut";
  private roomCode = "";

  private waitingTimer?: Delayed;
  private matchOverTimer?: Delayed;

  onCreate(options: JoinOptions) {
    this.autoDispose = true;
    this.setState(new BattleState());

    this.roomCode = (options.roomCode || "").trim().toUpperCase();
    if (this.roomCode) {
      this.setMetadata({ roomCode: this.roomCode });
    }

    const c1 = CREATURE_MAP[options.creatureId || "pyrokid"] || CREATURES[0];
    const c2 = CREATURES[1];

    this.physics = new HeadlessPhysics(320, 170, c1, c2);
    this.physics.syncToSchema(this.state);

    // Auto-dispose idle room if challenger doesn't join within 3 minutes
    this.waitingTimer = this.clock.setTimeout(() => {
      if (this.clients.length < 2) {
        console.log(`[BattleRoom] Room ${this.roomId} (${this.roomCode || "public"}) expired after 3m of waiting. Disposing.`);
        this.disconnect();
      }
    }, 3 * 60 * 1000);

    // Client input handler
    this.onMessage("input", (client: Client, controls: BattleControls) => {
      if (this.p1Client && client.sessionId === this.p1Client.sessionId) {
        this.physics.p1Controls = controls;
      } else if (this.p2Client && client.sessionId === this.p2Client.sessionId) {
        this.physics.p2Controls = controls;
      }
    });

    // Rematch handler
    this.onMessage("rematch", () => {
      if (this.state.phase === "match_over") {
        if (this.matchOverTimer) {
          this.matchOverTimer.clear();
          this.matchOverTimer = undefined;
        }
        this.physics.startMatch();
      }
    });

    // 60 FPS authoritative server loop
    this.setSimulationInterval(() => this.updatePhysics(), 1000 / 60);
  }

  onJoin(client: Client, options: JoinOptions) {
    const chosenCreature = options.creatureId && CREATURE_MAP[options.creatureId]
      ? options.creatureId
      : "pyrokid";

    const displayCode = this.roomCode || this.roomId;

    if (!this.p1Client) {
      this.p1Client = client;
      this.p1CreatureId = chosenCreature;
      client.send("assigned_side", { side: "left", roomId: this.roomId, roomCode: displayCode });
      this.state.phase = "waiting";
      this.state.flash.text = "WAITING FOR OPPONENT...";
      this.state.flash.color = "#38bdf8";
      this.state.flash.t = 10000;
    } else if (!this.p2Client) {
      this.p2Client = client;
      this.p2CreatureId = chosenCreature;

      // Cancel waiting timer once both players join
      if (this.waitingTimer) {
        this.waitingTimer.clear();
        this.waitingTimer = undefined;
      }

      client.send("assigned_side", { side: "right", roomId: this.roomId, roomCode: displayCode });

      // Both players connected! Set chosen creatures and launch match
      const c1 = CREATURE_MAP[this.p1CreatureId] || CREATURES[0];
      const c2 = CREATURE_MAP[this.p2CreatureId] || CREATURES[1];
      this.physics.setCreatures(c1, c2);
      this.physics.startMatch();
      this.physics.syncToSchema(this.state);
    }
  }

  async onLeave(client: Client, _consented: boolean) {
    if (this.state.phase === "match_over") {
      return;
    }

    // Award victory to remaining player on premature disconnect
    if (this.p1Client && client.sessionId === this.p1Client.sessionId) {
      this.p1Client = undefined;
      this.physics.p1Controls = emptyBattleControls();
      if (this.state.phase === "battle" || this.state.phase === "countdown") {
        this.state.flash.text = "PLAYER 1 DISCONNECTED";
        this.state.flash.color = "#ef4444";
        this.state.flash.t = 120;
        this.physics.rightState.roundsWon = 2;
        this.state.phase = "match_over";
      }
    } else if (this.p2Client && client.sessionId === this.p2Client.sessionId) {
      this.p2Client = undefined;
      this.physics.p2Controls = emptyBattleControls();
      if (this.state.phase === "battle" || this.state.phase === "countdown") {
        this.state.flash.text = "PLAYER 2 DISCONNECTED";
        this.state.flash.color = "#ef4444";
        this.state.flash.t = 120;
        this.physics.leftState.roundsWon = 2;
        this.state.phase = "match_over";
      }
    }

    // If only 1 player remains, auto-dispose after 90s if no rematch or reconnect
    if (this.clients.length < 2 && !this.waitingTimer) {
      this.waitingTimer = this.clock.setTimeout(() => {
        if (this.clients.length < 2) {
          console.log(`[BattleRoom] Room ${this.roomId} idle after player left. Disposing.`);
          this.disconnect();
        }
      }, 90 * 1000);
    }
  }

  private updatePhysics() {
    this.physics.step();
    this.physics.syncToSchema(this.state);

    // If match ended, set a 2-minute post-match idle cleanup timer
    if (this.state.phase === "match_over" && !this.matchOverTimer) {
      this.matchOverTimer = this.clock.setTimeout(() => {
        console.log(`[BattleRoom] Room ${this.roomId} match over idle timer expired. Disposing.`);
        this.disconnect();
      }, 2 * 60 * 1000);
    }
  }

  onDispose() {
    console.log(`[BattleRoom] Room ${this.roomId} (${this.roomCode || "public"}) disposed.`);
    if (this.waitingTimer) this.waitingTimer.clear();
    if (this.matchOverTimer) this.matchOverTimer.clear();
  }
}
