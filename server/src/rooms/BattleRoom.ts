import { Room, type Client } from "@colyseus/core";
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

  onCreate(options: JoinOptions) {
    this.setState(new BattleState());

    const c1 = CREATURE_MAP[options.creatureId || "pyrokid"] || CREATURES[0];
    const c2 = CREATURES[1];

    this.physics = new HeadlessPhysics(320, 170, c1, c2);
    this.physics.syncToSchema(this.state);

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

    if (!this.p1Client) {
      this.p1Client = client;
      this.p1CreatureId = chosenCreature;
      client.send("assigned_side", { side: "left", roomId: this.roomId });
      this.state.phase = "waiting";
      this.state.flash.text = "WAITING FOR OPPONENT...";
      this.state.flash.color = "#38bdf8";
      this.state.flash.t = 10000;
    } else if (!this.p2Client) {
      this.p2Client = client;
      this.p2CreatureId = chosenCreature;
      client.send("assigned_side", { side: "right", roomId: this.roomId });

      // Both players connected! Set chosen creatures and launch match
      const c1 = CREATURE_MAP[this.p1CreatureId] || CREATURES[0];
      const c2 = CREATURE_MAP[this.p2CreatureId] || CREATURES[1];
      this.physics.setCreatures(c1, c2);
      this.physics.startMatch();
      this.physics.syncToSchema(this.state);
    }
  }

  async onLeave(client: Client, consented: boolean) {
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
  }

  private updatePhysics() {
    this.physics.step();
    this.physics.syncToSchema(this.state);
  }

  onDispose() {
    // Cleanup if needed
  }
}
