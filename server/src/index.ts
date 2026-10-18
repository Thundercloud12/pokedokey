import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BattleRoom } from "./rooms/BattleRoom.js";

const app = express();
const port = Number(process.env.PORT || 2567);

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("🎮 2D Creature Arena Battler - Colyseus Server is running!");
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    game: "Creature Arena Battler",
    port,
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

// Register battle rooms with roomCode filtering
gameServer.define("battle_room", BattleRoom).filterBy(["roomCode"]);

gameServer.listen(port).then(() => {
  console.log(`⚔️  Creature Arena Colyseus Server running on ws://localhost:${port}`);
  console.log(`📊 Health endpoint: http://localhost:${port}/health`);
});
