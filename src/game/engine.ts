import * as THREE from "three";
import * as CANNON from "cannon-es";
import confetti from "canvas-confetti";
import {
  PITCH,
  GOAL,
  TEAMS,
  BALL_CONFIG,
  PLAYER_CONFIG,
  WIN_SCORE,
  type TeamId,
} from "./constants";
import {
  createPitchTexture,
  createBallTexture,
  createGoalNetTexture,
  createAdBoardTexture,
  createCrowdTexture,
} from "./textures";
import {
  create3DPlayerModel,
  animatePlayerModel,
  createFirstPersonViewModel,
  type AnimatedPlayerMesh,
} from "./character";
import { PhysicsWorld } from "./physics";
import { FPSController } from "./controls";
import { FootballBot } from "./bot";
import { NetworkManager } from "./network";
import { sound } from "../audio/Sound";

export type GameMode = "bot" | "online" | "practice";

export interface GameUiState {
  phase: "ready" | "countdown" | "play" | "goal" | "over";
  score: { red: number; blue: number };
  winner: TeamId | null;
  countdownText: string;
  isLocked: boolean;
  chargeRatio: number;
  ballAngleToPlayer: number; // in radians, for HUD compass/radar
  ballDistance: number;
  mode: GameMode;
  roomCode: string;
  isHost: boolean;
  peerConnected: boolean;
  localTeam: TeamId;
  pixelScale: number;
}

export class FPSFootballEngine {
  container: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  physics: PhysicsWorld;
  controller: FPSController;
  bot: FootballBot;
  network: NetworkManager;

  mode: GameMode = "bot";
  localTeam: TeamId = "red";
  opponentTeam: TeamId = "blue";

  // Visual Meshes
  ballMesh!: THREE.Mesh;
  opponentMesh!: AnimatedPlayerMesh;
  firstPersonVM!: THREE.Group;
  cameraShake = 0;

  // Game Match State
  phase: "ready" | "countdown" | "play" | "goal" | "over" = "ready";
  score = { red: 0, blue: 0 };
  winner: TeamId | null = null;
  countdownTimer = 0;
  countdownStep = 3;
  countdownText = "";
  pixelScale = 0.45; // 0.45 = Authentic chunky PS1/retro 90s pixel resolution

  onUiUpdate?: (ui: GameUiState) => void;

  private isRunning = false;
  private animFrameId = 0;
  private lastTime = 0;
  private isDestroyed = false;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Three.js Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#070a14");
    this.scene.fog = new THREE.FogExp2("#070a14", 0.012);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false, // sharp retro pixels!
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.domElement.className = "pixelated absolute inset-0 w-full h-full cursor-crosshair select-none";
    this.container.appendChild(this.renderer.domElement);

    this.updateViewportSize();
    window.addEventListener("resize", this.handleResize);

    // 2. Physics & Controller Setup
    this.physics = new PhysicsWorld();
    this.controller = new FPSController(
      this.camera,
      this.physics.playerBody,
      this.renderer.domElement
    );
    this.bot = new FootballBot(this.physics.opponentBody, "blue");
    this.network = new NetworkManager();

    // 3. Build 3D Arena & Entities
    this.buildLighting();
    this.buildPitchAndStadium();
    this.buildGoals();
    this.buildBall();
    this.buildPlayers();

    // 4. Bind Game Events
    this.bindGameEvents();
    this.resetMatchPositions();

    // 5. Start Render Loop
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private updateViewportSize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Logical low-res rendering scaled up with CSS pixelated styling
    const lowW = Math.max(320, Math.round(w * this.pixelScale));
    const lowH = Math.max(180, Math.round(h * this.pixelScale));
    this.renderer.setSize(lowW, lowH, false);
  }

  private handleResize = () => {
    this.updateViewportSize();
  };

  setPixelScale(scale: number) {
    this.pixelScale = Math.max(0.2, Math.min(1.0, scale));
    this.updateViewportSize();
  }

  private buildLighting() {
    // Ambient stadium glow
    const ambient = new THREE.AmbientLight("#a0b5d0", 0.7);
    this.scene.add(ambient);

    // 4 Corner Stadium Floodlight Towers
    const towerCoords = [
      [-PITCH.width / 2 - 4, -PITCH.length / 2 - 4],
      [PITCH.width / 2 + 4, -PITCH.length / 2 - 4],
      [-PITCH.width / 2 - 4, PITCH.length / 2 + 4],
      [PITCH.width / 2 + 4, PITCH.length / 2 + 4],
    ];

    towerCoords.forEach(([tx, tz]) => {
      const light = new THREE.SpotLight("#ffffff", 1.2, 100, Math.PI / 3, 0.4, 1);
      light.position.set(tx, 18, tz);
      light.target.position.set(0, 0, 0);
      light.castShadow = true;
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      this.scene.add(light);
      this.scene.add(light.target);

      // Floodlight tower mesh
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 18, 6),
        new THREE.MeshLambertMaterial({ color: "#374151" })
      );
      pole.position.set(tx, 9, tz);
      this.scene.add(pole);

      const lampBox = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 1.2, 1.5),
        new THREE.MeshBasicMaterial({ color: "#fef08a" })
      );
      lampBox.position.set(tx, 18, tz);
      this.scene.add(lampBox);
    });
  }

  private buildPitchAndStadium() {
    // Grass Pitch Plane
    const pitchTex = createPitchTexture();
    const pitchGeom = new THREE.PlaneGeometry(PITCH.width, PITCH.length);
    const pitchMat = new THREE.MeshLambertMaterial({
      map: pitchTex,
    });
    const pitchMesh = new THREE.Mesh(pitchGeom, pitchMat);
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.receiveShadow = true;
    this.scene.add(pitchMesh);

    // Adboards around the perimeter
    const adTex = createAdBoardTexture();
    const adMat = new THREE.MeshLambertMaterial({ map: adTex });
    const boardH = 1.4;

    // West & East sideline boards
    const sideBoardGeom = new THREE.BoxGeometry(0.3, boardH, PITCH.length);
    const westBoard = new THREE.Mesh(sideBoardGeom, adMat);
    westBoard.position.set(-PITCH.width / 2 - 0.2, boardH / 2, 0);
    this.scene.add(westBoard);

    const eastBoard = new THREE.Mesh(sideBoardGeom, adMat);
    eastBoard.position.set(PITCH.width / 2 + 0.2, boardH / 2, 0);
    this.scene.add(eastBoard);

    // North & South endline boards (flanking goals)
    const flankW = (PITCH.width - GOAL.width) / 2;
    const endBoardGeom = new THREE.BoxGeometry(flankW, boardH, 0.3);

    const nLeft = new THREE.Mesh(endBoardGeom, adMat);
    nLeft.position.set(-GOAL.width / 2 - flankW / 2, boardH / 2, -PITCH.length / 2 - 0.2);
    this.scene.add(nLeft);

    const nRight = new THREE.Mesh(endBoardGeom, adMat);
    nRight.position.set(GOAL.width / 2 + flankW / 2, boardH / 2, -PITCH.length / 2 - 0.2);
    this.scene.add(nRight);

    const sLeft = new THREE.Mesh(endBoardGeom, adMat);
    sLeft.position.set(-GOAL.width / 2 - flankW / 2, boardH / 2, PITCH.length / 2 + 0.2);
    this.scene.add(sLeft);

    const sRight = new THREE.Mesh(endBoardGeom, adMat);
    sRight.position.set(GOAL.width / 2 + flankW / 2, boardH / 2, PITCH.length / 2 + 0.2);
    this.scene.add(sRight);

    // Stadium Stands with Animated / Pixel Crowd
    const crowdTex = createCrowdTexture();
    const crowdMat = new THREE.MeshBasicMaterial({ map: crowdTex, side: THREE.DoubleSide });

    // West & East stands
    const standGeom = new THREE.PlaneGeometry(PITCH.length + 8, 8);
    const westStand = new THREE.Mesh(standGeom, crowdMat);
    westStand.position.set(-PITCH.width / 2 - 5, 4, 0);
    westStand.rotation.y = Math.PI / 2;
    this.scene.add(westStand);

    const eastStand = new THREE.Mesh(standGeom, crowdMat);
    eastStand.position.set(PITCH.width / 2 + 5, 4, 0);
    eastStand.rotation.y = -Math.PI / 2;
    this.scene.add(eastStand);
  }

  private buildGoals() {
    this.createGoalMesh(GOAL.northZ, -1);
    this.createGoalMesh(GOAL.southZ, 1);
  }

  private createGoalMesh(zLine: number, dir: 1 | -1) {
    const postMat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    const netTex = createGoalNetTexture();
    const netMat = new THREE.MeshLambertMaterial({
      map: netTex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    const halfGW = GOAL.width / 2;
    const gh = GOAL.height;
    const gd = GOAL.depth;
    const pr = GOAL.postRadius;

    // Left and Right Posts
    const postGeom = new THREE.CylinderGeometry(pr, pr, gh, 8);
    const lp = new THREE.Mesh(postGeom, postMat);
    lp.position.set(-halfGW, gh / 2, zLine);
    lp.castShadow = true;
    this.scene.add(lp);

    const rp = new THREE.Mesh(postGeom, postMat);
    rp.position.set(halfGW, gh / 2, zLine);
    rp.castShadow = true;
    this.scene.add(rp);

    // Crossbar
    const barGeom = new THREE.CylinderGeometry(pr, pr, GOAL.width, 8);
    const bar = new THREE.Mesh(barGeom, postMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, gh, zLine);
    bar.castShadow = true;
    this.scene.add(bar);

    // Net Box
    const backNetGeom = new THREE.PlaneGeometry(GOAL.width, gh);
    const backNet = new THREE.Mesh(backNetGeom, netMat);
    backNet.position.set(0, gh / 2, zLine + dir * gd);
    this.scene.add(backNet);

    const topNetGeom = new THREE.PlaneGeometry(GOAL.width, gd);
    const topNet = new THREE.Mesh(topNetGeom, netMat);
    topNet.rotation.x = Math.PI / 2;
    topNet.position.set(0, gh, zLine + (dir * gd) / 2);
    this.scene.add(topNet);

    const sideNetGeom = new THREE.PlaneGeometry(gd, gh);
    const leftSideNet = new THREE.Mesh(sideNetGeom, netMat);
    leftSideNet.rotation.y = Math.PI / 2;
    leftSideNet.position.set(-halfGW, gh / 2, zLine + (dir * gd) / 2);
    this.scene.add(leftSideNet);

    const rightSideNet = new THREE.Mesh(sideNetGeom, netMat);
    rightSideNet.rotation.y = Math.PI / 2;
    rightSideNet.position.set(halfGW, gh / 2, zLine + (dir * gd) / 2);
    this.scene.add(rightSideNet);
  }

  private buildBall() {
    const ballTex = createBallTexture();
    const ballGeom = new THREE.SphereGeometry(BALL_CONFIG.radius, 16, 12);
    const ballMat = new THREE.MeshLambertMaterial({
      map: ballTex,
    });
    this.ballMesh = new THREE.Mesh(ballGeom, ballMat);
    this.ballMesh.castShadow = true;
    this.scene.add(this.ballMesh);
  }

  private buildPlayers() {
    // 3D Opponent Avatar (Visible across the pitch)
    this.opponentMesh = create3DPlayerModel(this.opponentTeam);
    this.scene.add(this.opponentMesh);

    // 1st Person Kicking Viewmodel (Cleat attached to camera)
    this.firstPersonVM = createFirstPersonViewModel(this.localTeam);
    this.camera.add(this.firstPersonVM);
    this.scene.add(this.camera);
  }

  private bindGameEvents() {
    // Controller kick event
    this.controller.onKick = (kick) => {
      this.handlePlayerKick(kick.power, kick.direction, kick.isLob);
    };

    // Physics Goal event
    this.physics.onGoalScored = (event) => {
      this.handleGoal(event.scorerTeam);
    };

    // Network Callbacks
    this.network.onConnected = () => {
      this.soundUnlock();
      this.startCountdown();
    };

    this.network.onPacket = (pkt) => {
      if (pkt.type === "state" && !this.network.isHost) {
        // Guest receives authoritative state from host
        this.physics.ballBody.position.set(pkt.ball.x, pkt.ball.y, pkt.ball.z);
        this.physics.ballBody.velocity.set(pkt.ball.vx, pkt.ball.vy, pkt.ball.vz);
        this.physics.opponentBody.position.set(pkt.player.x, pkt.player.y, pkt.player.z);
        this.opponentMesh.rotation.y = pkt.player.yaw;
        animatePlayerModel(this.opponentMesh, 5, pkt.player.isKicking, 1 / 60);

        this.score = pkt.score;
        this.phase = pkt.phase;
      } else if (pkt.type === "input" && this.network.isHost) {
        // Host receives guest input
        this.physics.opponentBody.position.set(pkt.player.x, pkt.player.y, pkt.player.z);
        this.opponentMesh.rotation.y = pkt.player.yaw;
        animatePlayerModel(this.opponentMesh, 5, pkt.player.isKicking, 1 / 60);
      } else if (pkt.type === "kick") {
        // Guest kicked ball, host applies physics
        const dir = new THREE.Vector3(...pkt.dir);
        this.applyKickPhysics(this.physics.opponentBody, pkt.power, dir, pkt.isLob);
      }
    };
  }

  private handlePlayerKick(power: number, lookDir: THREE.Vector3, isLob: boolean) {
    const pPos = this.physics.playerBody.position;
    const bPos = this.physics.ballBody.position;
    const dist = pPos.distanceTo(bPos);

    if (dist < PLAYER_CONFIG.kickReach) {
      this.applyKickPhysics(this.physics.playerBody, power, lookDir, isLob);

      if (this.mode === "online") {
        this.network.send({
          type: "kick",
          power,
          dir: [lookDir.x, lookDir.y, lookDir.z],
          isLob,
        });
      }
    } else {
      // Swung and missed — play swoosh
      sound.play("swoosh");
    }
  }

  private applyKickPhysics(
    _kickerBody: CANNON.Body,
    power: number,
    dir: THREE.Vector3,
    isLob: boolean
  ) {
    const ball = this.physics.ballBody;

    // Calculate trajectory based on aim direction
    let vx = dir.x * power;
    let vz = dir.z * power;
    let vy = isLob ? Math.max(9, power * 0.45) : Math.max(2.5, dir.y * power + 3.2);

    ball.velocity.set(vx, vy, vz);
    ball.angularVelocity.set(-vz * 0.5, 0, vx * 0.5);

    sound.play("kick", power / 35);
  }

  private handleGoal(scorer: TeamId) {
    if (this.phase === "goal" || this.phase === "over") return;

    this.score[scorer]++;
    this.phase = "goal";
    this.cameraShake = 0.45;
    sound.play("goal");

    // Confetti celebration
    confetti({
      particleCount: 75,
      spread: 80,
      origin: { y: 0.6 },
      colors: scorer === "red" ? ["#ef4444", "#ffffff", "#fca5a5"] : ["#2563eb", "#facc15", "#93c5fd"],
    });

    if (this.score[scorer] >= WIN_SCORE) {
      setTimeout(() => {
        this.phase = "over";
        this.winner = scorer;
        sound.play(scorer === this.localTeam ? "win" : "lose");
      }, 2500);
    } else {
      setTimeout(() => {
        this.resetMatchPositions();
        this.startCountdown();
      }, 3000);
    }
  }

  startCountdown() {
    this.phase = "countdown";
    this.countdownStep = 3;
    this.countdownTimer = 0;
    this.countdownText = "3";
    sound.play("tick");
  }

  private resetMatchPositions() {
    // Reset player spawns
    const pZ = TEAMS[this.localTeam].spawnZ;
    const oZ = TEAMS[this.opponentTeam].spawnZ;

    this.controller.resetPosition(new CANNON.Vec3(0, PLAYER_CONFIG.height / 2, pZ), TEAMS[this.localTeam].targetGoalZ);
    this.physics.opponentBody.position.set(0, PLAYER_CONFIG.height / 2, oZ);
    this.physics.opponentBody.velocity.set(0, 0, 0);

    this.physics.resetBall(this.localTeam);
  }

  soundUnlock() {
    sound.unlock();
    sound.ambience(true);
  }

  setGameMode(mode: GameMode, roomCode?: string) {
    this.mode = mode;
    this.score = { red: 0, blue: 0 };
    this.winner = null;

    if (mode === "online" && roomCode) {
      // Setup as guest
      this.localTeam = "blue";
      this.opponentTeam = "red";
      this.network.joinMatch(roomCode);
    } else if (mode === "online") {
      // Setup as host
      this.localTeam = "red";
      this.opponentTeam = "blue";
      this.network.hostMatch();
    } else {
      // Bot or practice
      this.localTeam = "red";
      this.opponentTeam = "blue";
      this.startCountdown();
    }
  }

  private loop = (time: number) => {
    if (!this.isRunning || this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const delta = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    // 1. Countdown Phase Handling
    if (this.phase === "countdown") {
      this.countdownTimer += delta;
      if (this.countdownTimer >= 0.85) {
        this.countdownTimer = 0;
        this.countdownStep--;
        if (this.countdownStep === 2) {
          this.countdownText = "2";
          sound.play("tick");
        } else if (this.countdownStep === 1) {
          this.countdownText = "1";
          sound.play("tick");
        } else if (this.countdownStep === 0) {
          this.countdownText = "GO!";
          sound.play("go");
          this.phase = "play";
        }
      }
    }

    // 2. Physics & Controls update
    if (this.phase === "play" || this.phase === "goal") {
      this.physics.step(delta);
    }

    this.controller.update(delta, this.physics.ballBody);

    // 3. AI Bot Update (if in bot mode)
    if (this.mode === "bot" && this.phase === "play") {
      this.bot.update(delta, this.physics.ballBody, this.physics.playerBody.position);
    }

    // 4. Sync 3D Meshes with Physics Bodies
    // Ball
    this.ballMesh.position.copy(
      this.physics.ballBody.position as unknown as THREE.Vector3
    );
    this.ballMesh.quaternion.copy(
      this.physics.ballBody.quaternion as unknown as THREE.Quaternion
    );

    // Opponent Mesh
    this.opponentMesh.position.copy(
      this.physics.opponentBody.position as unknown as THREE.Vector3
    );
    // Face movement or look direction
    if (this.mode === "bot") {
      const oppVel = this.physics.opponentBody.velocity;
      if (Math.hypot(oppVel.x, oppVel.z) > 0.3) {
        this.opponentMesh.rotation.y = Math.atan2(oppVel.x, oppVel.z) + Math.PI;
      }
      animatePlayerModel(
        this.opponentMesh,
        Math.hypot(oppVel.x, oppVel.z),
        this.bot.isKicking,
        delta
      );
    }

    // 5. First-Person Viewmodel Kicking Animation
    const leg = this.firstPersonVM.getObjectByName("kickingLeg");
    if (leg) {
      if (this.controller.isKicking) {
        // Snap kick extension
        leg.rotation.x = -1.1;
        leg.position.z = -0.25;
      } else {
        // Return to resting position
        leg.rotation.x *= 0.85;
        leg.position.z *= 0.85;
      }
    }

    // 6. Camera Shake
    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - delta * 1.8);
    }

    // 7. Network Stream (30 Hz sync)
    if (this.mode === "online" && this.network.isConnected) {
      if (this.network.isHost) {
        const b = this.physics.ballBody;
        this.network.send({
          type: "state",
          ball: {
            x: b.position.x,
            y: b.position.y,
            z: b.position.z,
            vx: b.velocity.x,
            vy: b.velocity.y,
            vz: b.velocity.z,
          },
          player: {
            x: this.physics.playerBody.position.x,
            y: this.physics.playerBody.position.y,
            z: this.physics.playerBody.position.z,
            yaw: this.controller.yaw,
            pitch: this.controller.pitch,
            isKicking: this.controller.isKicking,
          },
          score: this.score,
          phase: this.phase,
        });
      } else {
        this.network.send({
          type: "input",
          player: {
            x: this.physics.playerBody.position.x,
            y: this.physics.playerBody.position.y,
            z: this.physics.playerBody.position.z,
            yaw: this.controller.yaw,
            pitch: this.controller.pitch,
            isKicking: this.controller.isKicking,
          },
        });
      }
    }

    // 8. Calculate Compass Radar Angle to Ball
    const camPos = this.camera.position;
    const ballPos = this.ballMesh.position;
    const dx = ballPos.x - camPos.x;
    const dz = ballPos.z - camPos.z;
    const angleToBall = Math.atan2(dx, dz);
    // Relative to camera yaw
    let relAngle = angleToBall - (this.controller.yaw + Math.PI);
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    const ballDist = Math.hypot(dx, dz);

    // 9. Update UI Callbacks
    this.onUiUpdate?.({
      phase: this.phase,
      score: { ...this.score },
      winner: this.winner,
      countdownText: this.countdownText,
      isLocked: this.controller.isLocked,
      chargeRatio: this.controller.chargeRatio,
      ballAngleToPlayer: relAngle,
      ballDistance: ballDist,
      mode: this.mode,
      roomCode: this.network.roomCode,
      isHost: this.network.isHost,
      peerConnected: this.network.isConnected,
      localTeam: this.localTeam,
      pixelScale: this.pixelScale,
    });

    // 10. Render
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    this.isDestroyed = true;
    this.isRunning = false;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.handleResize);
    this.network.destroy();
    this.renderer.dispose();
  }
}
