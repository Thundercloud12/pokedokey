import * as THREE from "three";
import { TEAMS, type TeamId } from "./constants";

export interface AnimatedPlayerMesh extends THREE.Group {
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  animTime: number;
}

/**
 * Creates a retro chunky voxel/pixel-art 3D character model.
 * Segments are articulated for running and kicking animations.
 */
export function create3DPlayerModel(teamId: TeamId): AnimatedPlayerMesh {
  const team = TEAMS[teamId];
  const group = new THREE.Group() as AnimatedPlayerMesh;
  group.animTime = 0;

  // Pixel materials (flat shaded for sharp retro look)
  const matShirt = new THREE.MeshLambertMaterial({ color: team.shirt });
  const matShirtDark = new THREE.MeshLambertMaterial({ color: team.shirtDark });
  const matShorts = new THREE.MeshLambertMaterial({ color: team.shorts });
  const matSocks = new THREE.MeshLambertMaterial({ color: team.socks });
  const matBoots = new THREE.MeshLambertMaterial({ color: team.boots });
  const matSkin = new THREE.MeshLambertMaterial({ color: team.skin });
  const matHair = new THREE.MeshLambertMaterial({
    color: teamId === "red" ? "#3b2a20" : "#15151a",
  });
  const matEye = new THREE.MeshLambertMaterial({
    color: teamId === "red" ? "#111827" : "#facc15",
  });

  // 1. Torso
  const torsoGeom = new THREE.BoxGeometry(0.65, 0.7, 0.35);
  const torso = new THREE.Mesh(torsoGeom, matShirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  group.torso = torso;

  // Number / Stripe stripe on chest
  const stripeGeom = new THREE.BoxGeometry(0.66, 0.12, 0.36);
  const stripe = new THREE.Mesh(stripeGeom, matShirtDark);
  stripe.position.y = 0.05;
  torso.add(stripe);

  // 2. Head
  const headGeom = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const head = new THREE.Mesh(headGeom, matSkin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  group.head = head;

  // Hair
  const hairGeom = new THREE.BoxGeometry(0.44, 0.18, 0.44);
  const hair = new THREE.Mesh(hairGeom, matHair);
  hair.position.y = 0.18;
  head.add(hair);

  // Eyes (front face at -Z)
  const eyeGeom = new THREE.BoxGeometry(0.08, 0.08, 0.04);
  const eyeL = new THREE.Mesh(eyeGeom, matEye);
  eyeL.position.set(-0.11, 0, -0.215);
  head.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeom, matEye);
  eyeR.position.set(0.11, 0, -0.215);
  head.add(eyeR);

  // Helper to build articulated limbs
  function makeLimb(isLeg: boolean, isRight: boolean) {
    const pivot = new THREE.Group();
    if (isLeg) {
      pivot.position.set(isRight ? 0.18 : -0.18, 0.8, 0);

      // Thigh (Shorts)
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.26), matShorts);
      thigh.position.y = -0.18;
      thigh.castShadow = true;
      pivot.add(thigh);

      // Shin (Socks)
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.22), matSocks);
      shin.position.y = -0.48;
      shin.castShadow = true;
      pivot.add(shin);

      // Boot / Cleat (pointing forward at -Z)
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.32), matBoots);
      boot.position.set(0, -0.68, -0.04);
      boot.castShadow = true;
      pivot.add(boot);
    } else {
      // Arm
      pivot.position.set(isRight ? 0.42 : -0.42, 1.4, 0);

      // Sleeve
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.2), matShirt);
      sleeve.position.y = -0.12;
      sleeve.castShadow = true;
      pivot.add(sleeve);

      // Forearm (Skin)
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.16), matSkin);
      forearm.position.y = -0.38;
      forearm.castShadow = true;
      pivot.add(forearm);
    }
    return pivot;
  }

  group.leftLeg = makeLimb(true, false);
  group.rightLeg = makeLimb(true, true);
  group.leftArm = makeLimb(false, false);
  group.rightArm = makeLimb(false, true);

  group.add(group.leftLeg);
  group.add(group.rightLeg);
  group.add(group.leftArm);
  group.add(group.rightArm);

  return group;
}

/**
 * Updates running cycle and kick extension on 3D character mesh.
 */
export function animatePlayerModel(
  model: AnimatedPlayerMesh,
  speed: number,
  isKicking: boolean,
  delta: number
) {
  if (speed > 0.2) {
    model.animTime += delta * speed * 4.2;
    const swing = Math.sin(model.animTime) * 0.75;
    model.leftLeg.rotation.x = swing;
    model.rightLeg.rotation.x = -swing;
    model.leftArm.rotation.x = -swing * 0.8;
    model.rightArm.rotation.x = swing * 0.8;
    // slight bob
    model.torso.position.y = 1.15 + Math.abs(Math.sin(model.animTime * 2)) * 0.05;
  } else {
    // Idle stance
    model.leftLeg.rotation.x *= 0.8;
    model.rightLeg.rotation.x *= 0.8;
    model.leftArm.rotation.x *= 0.8;
    model.rightArm.rotation.x *= 0.8;
    model.torso.position.y = 1.15;
  }

  if (isKicking) {
    // Right leg snap kick forward
    model.rightLeg.rotation.x = -1.2;
    model.rightArm.rotation.x = 0.9;
  }
}

/**
 * Creates the First-Person Viewmodel (your own cleat and leg that kicks into the screen).
 */
export function createFirstPersonViewModel(teamId: TeamId): THREE.Group {
  const team = TEAMS[teamId];
  const group = new THREE.Group();

  const matSocks = new THREE.MeshLambertMaterial({ color: team.socks });
  const matBoots = new THREE.MeshLambertMaterial({ color: team.boots });
  const matShorts = new THREE.MeshLambertMaterial({ color: team.shorts });

  // Right kicking leg positioned in bottom right corner of view
  const leg = new THREE.Group();
  leg.name = "kickingLeg";

  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.18), matShorts);
  thigh.position.set(0, 0.15, 0.2);
  thigh.rotation.x = 0.4;
  leg.add(thigh);

  const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.15), matSocks);
  shin.position.set(0, -0.15, 0.05);
  leg.add(shin);

  const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), matBoots);
  cleat.position.set(0, -0.32, -0.06);
  leg.add(cleat);

  // Position relative to first person camera
  group.position.set(0.32, -0.42, -0.65);
  group.add(leg);

  return group;
}
