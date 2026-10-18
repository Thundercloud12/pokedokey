import * as CANNON from "cannon-es";
import { PITCH, GOAL, BALL_CONFIG, PLAYER_CONFIG, type TeamId } from "./constants";
import { sound } from "../audio/Sound";

export interface GoalEvent {
  scorerTeam: TeamId; // the team that scored the goal
  concedingTeam: TeamId;
  ballSpeed: number;
}

export class PhysicsWorld {
  world: CANNON.World;
  ballBody: CANNON.Body;
  playerBody: CANNON.Body;
  opponentBody: CANNON.Body;

  // Materials
  groundMaterial: CANNON.Material;
  ballMaterial: CANNON.Material;
  postMaterial: CANNON.Material;
  netMaterial: CANNON.Material;
  wallMaterial: CANNON.Material;
  playerMaterial: CANNON.Material;

  onGoalScored?: (event: GoalEvent) => void;
  private goalCooldown = 0;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -18, 0),
    });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    // Iterations for solver stability
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 3;

    // Materials
    this.groundMaterial = new CANNON.Material("ground");
    this.ballMaterial = new CANNON.Material("ball");
    this.postMaterial = new CANNON.Material("post");
    this.netMaterial = new CANNON.Material("net");
    this.wallMaterial = new CANNON.Material("wall");
    this.playerMaterial = new CANNON.Material("player");

    this.setupContactMaterials();

    // Pitch Ground Plane
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.groundMaterial,
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);

    // Ball
    const ballShape = new CANNON.Sphere(BALL_CONFIG.radius);
    this.ballBody = new CANNON.Body({
      mass: BALL_CONFIG.mass,
      shape: ballShape,
      material: this.ballMaterial,
      linearDamping: 0.15,
      angularDamping: 0.25,
      position: new CANNON.Vec3(0, 1.2, 0),
    });
    this.ballBody.allowSleep = false;
    this.world.addBody(this.ballBody);

    // Player 1 (Local FPS player)
    this.playerBody = this.createPlayerBody(new CANNON.Vec3(0, PLAYER_CONFIG.height / 2, 14));
    this.world.addBody(this.playerBody);

    // Opponent Player (Network peer or Bot)
    this.opponentBody = this.createPlayerBody(new CANNON.Vec3(0, PLAYER_CONFIG.height / 2, -14));
    this.world.addBody(this.opponentBody);

    // Build pitch perimeter walls & goals
    this.setupBoundaryWalls();
    this.setupGoals();
    this.setupCollisionAudio();
  }

  private setupContactMaterials() {
    // Ball on Pitch
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.groundMaterial, {
        restitution: BALL_CONFIG.restitution,
        friction: BALL_CONFIG.friction,
      })
    );

    // Ball on Metal Post / Crossbar (Bouncy and resonant)
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.postMaterial, {
        restitution: 0.82,
        friction: 0.2,
      })
    );

    // Ball on Goal Net (Absorbs shock)
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.netMaterial, {
        restitution: 0.08,
        friction: 0.85,
      })
    );

    // Ball on Perimeter Walls
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.wallMaterial, {
        restitution: 0.65,
        friction: 0.3,
      })
    );

    // Ball on Player (Soft foot trap cushion, not an elastic pinball ricochet!)
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.playerMaterial, {
        restitution: 0.15,
        friction: 0.6,
      })
    );
  }

  private createPlayerBody(pos: CANNON.Vec3): CANNON.Body {
    const shape = new CANNON.Cylinder(
      PLAYER_CONFIG.radius,
      PLAYER_CONFIG.radius,
      PLAYER_CONFIG.height,
      8
    );
    const body = new CANNON.Body({
      mass: PLAYER_CONFIG.mass,
      shape,
      material: this.playerMaterial,
      position: pos,
      fixedRotation: true,
      linearDamping: 0.9,
    });
    return body;
  }

  private setupBoundaryWalls() {
    const halfW = PITCH.width / 2;
    const halfL = PITCH.length / 2;
    const wallH = PITCH.wallHeight;

    // West and East boundary walls (side-lines)
    const sideWallShape = new CANNON.Box(new CANNON.Vec3(0.5, wallH / 2, halfL));
    const westWall = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: sideWallShape,
      material: this.wallMaterial,
      position: new CANNON.Vec3(-halfW - 0.5, wallH / 2, 0),
    });
    const eastWall = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: sideWallShape,
      material: this.wallMaterial,
      position: new CANNON.Vec3(halfW + 0.5, wallH / 2, 0),
    });
    this.world.addBody(westWall);
    this.world.addBody(eastWall);

    // North and South end walls (outside goal mouths)
    const endWallWidth = (PITCH.width - GOAL.width) / 2;
    const endWallShape = new CANNON.Box(new CANNON.Vec3(endWallWidth / 2, wallH / 2, 0.5));

    // North left/right
    const nLeft = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: endWallShape,
      material: this.wallMaterial,
      position: new CANNON.Vec3(-GOAL.width / 2 - endWallWidth / 2, wallH / 2, -halfL),
    });
    const nRight = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: endWallShape,
      material: this.wallMaterial,
      position: new CANNON.Vec3(GOAL.width / 2 + endWallWidth / 2, wallH / 2, -halfL),
    });
    this.world.addBody(nLeft);
    this.world.addBody(nRight);

    // South left/right
    const sLeft = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: endWallShape,
      material: this.wallMaterial,
      position: new CANNON.Vec3(-GOAL.width / 2 - endWallWidth / 2, wallH / 2, halfL),
    });
    const sRight = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: endWallShape,
      material: this.wallMaterial,
      position: new CANNON.Vec3(GOAL.width / 2 + endWallWidth / 2, wallH / 2, halfL),
    });
    this.world.addBody(sLeft);
    this.world.addBody(sRight);
  }

  private setupGoals() {
    // Build physics posts, crossbars and nets for North and South
    this.buildGoal(GOAL.northZ, -1);
    this.buildGoal(GOAL.southZ, 1);
  }

  private buildGoal(zLine: number, dir: 1 | -1) {
    const halfGW = GOAL.width / 2;
    const gh = GOAL.height;
    const gd = GOAL.depth;
    const pr = GOAL.postRadius;

    // Left and Right Posts
    const postShape = new CANNON.Cylinder(pr, pr, gh, 8);
    const leftPost = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: postShape,
      material: this.postMaterial,
      position: new CANNON.Vec3(-halfGW, gh / 2, zLine),
    });
    const rightPost = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: postShape,
      material: this.postMaterial,
      position: new CANNON.Vec3(halfGW, gh / 2, zLine),
    });
    this.world.addBody(leftPost);
    this.world.addBody(rightPost);

    // Crossbar
    const barShape = new CANNON.Box(new CANNON.Vec3(halfGW, pr, pr));
    const crossbar = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: barShape,
      material: this.postMaterial,
      position: new CANNON.Vec3(0, gh, zLine),
    });
    this.world.addBody(crossbar);

    // Back Net Wall
    const backNetShape = new CANNON.Box(new CANNON.Vec3(halfGW, gh / 2, 0.2));
    const backNet = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: backNetShape,
      material: this.netMaterial,
      position: new CANNON.Vec3(0, gh / 2, zLine + dir * gd),
    });
    this.world.addBody(backNet);

    // Side Net Left and Right
    const sideNetShape = new CANNON.Box(new CANNON.Vec3(0.2, gh / 2, gd / 2));
    const leftNet = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: sideNetShape,
      material: this.netMaterial,
      position: new CANNON.Vec3(-halfGW, gh / 2, zLine + (dir * gd) / 2),
    });
    const rightNet = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: sideNetShape,
      material: this.netMaterial,
      position: new CANNON.Vec3(halfGW, gh / 2, zLine + (dir * gd) / 2),
    });
    this.world.addBody(leftNet);
    this.world.addBody(rightNet);
  }

  private setupCollisionAudio() {
    this.ballBody.addEventListener("collide", (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
      const other = e.body;
      const speed = this.ballBody.velocity.length();
      if (speed < 1.2) return;

      const normSpeed = Math.min(1, speed / 25);
      if (other.material === this.postMaterial) {
        sound.play("post", normSpeed);
      } else if (other.material === this.playerMaterial) {
        sound.play("thud", normSpeed);
      } else if (other.material === this.groundMaterial) {
        if (Math.abs(this.ballBody.velocity.y) > 2) {
          sound.play("bounce", normSpeed);
        }
      }
    });
  }

  step(delta: number) {
    if (this.goalCooldown > 0) {
      this.goalCooldown -= delta;
    }

    // Step physics with fixed timestep
    this.world.step(1 / 60, delta, 4);

    // Check Goal Detection
    this.checkGoals();
  }

  private checkGoals() {
    if (this.goalCooldown > 0) return;

    const b = this.ballBody.position;
    const halfGW = GOAL.width / 2 - 0.2;
    const gh = GOAL.height - 0.2;

    // In goal mouth bounds along X and Y
    if (Math.abs(b.x) <= halfGW && b.y >= 0 && b.y <= gh) {
      // North Goal (Blue defending, Red scores if ball passes north of goal line)
      if (b.z < GOAL.northZ - BALL_CONFIG.radius) {
        this.goalCooldown = 3.5;
        this.onGoalScored?.({
          scorerTeam: "red",
          concedingTeam: "blue",
          ballSpeed: this.ballBody.velocity.length(),
        });
      }
      // South Goal (Red defending, Blue scores if ball passes south of goal line)
      else if (b.z > GOAL.southZ + BALL_CONFIG.radius) {
        this.goalCooldown = 3.5;
        this.onGoalScored?.({
          scorerTeam: "blue",
          concedingTeam: "red",
          ballSpeed: this.ballBody.velocity.length(),
        });
      }
    }
  }

  resetBall(servingTeam?: TeamId) {
    this.ballBody.velocity.set(0, 0, 0);
    this.ballBody.angularVelocity.set(0, 0, 0);
    this.ballBody.position.set(0, 1.2, 0);
    if (servingTeam) {
      // Slight nudge toward server
      const dirZ = servingTeam === "red" ? 1 : -1;
      this.ballBody.position.z = dirZ * 1.5;
    }
  }
}
