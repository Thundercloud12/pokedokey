import * as THREE from "three";

/**
 * Procedural pixel-art texture generators using HTML5 Canvas.
 * Generates retro 90s aesthetic textures with NearestFilter.
 */

export function createPitchTexture(width = 512, height = 1024): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 1. Alternating grass stripes (mower stripes)
  const stripeCount = 20;
  const stripeH = height / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#24732b" : "#2b8533";
    ctx.fillRect(0, i * stripeH, width, stripeH);
  }

  // 2. Add subtle pixel grain
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Crisp white field markings
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.lineCap = "square";

  const padX = 30;
  const padY = 40;
  const pitchW = width - padX * 2;
  const pitchH = height - padY * 2;

  // Boundary outer box
  ctx.strokeRect(padX, padY, pitchW, pitchH);

  // Half-way line
  const midY = height / 2;
  ctx.beginPath();
  ctx.moveTo(padX, midY);
  ctx.lineTo(width - padX, midY);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(width / 2, midY, 60, 0, Math.PI * 2);
  ctx.stroke();

  // Center spot
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(width / 2, midY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Penalty boxes (North and South)
  const penW = 180;
  const penH = 110;
  const penX = (width - penW) / 2;

  // Top (North) Goal & Penalty Box
  ctx.strokeRect(penX, padY, penW, penH);
  // Penalty spot top
  ctx.beginPath();
  ctx.arc(width / 2, padY + 75, 5, 0, Math.PI * 2);
  ctx.fill();

  // Bottom (South) Goal & Penalty Box
  ctx.strokeRect(penX, height - padY - penH, penW, penH);
  // Penalty spot bottom
  ctx.beginPath();
  ctx.arc(width / 2, height - padY - 75, 5, 0, Math.PI * 2);
  ctx.fill();

  // Corner arcs
  const arcR = 24;
  // Top-left
  ctx.beginPath(); ctx.arc(padX, padY, arcR, 0, Math.PI / 2); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.arc(width - padX, padY, arcR, Math.PI / 2, Math.PI); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.arc(padX, height - padY, arcR, Math.PI * 1.5, Math.PI * 2); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.arc(width - padX, height - padY, arcR, Math.PI, Math.PI * 1.5); ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export function createBallTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // White base
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, size, size);

  // Black hexagons / pixel patches
  ctx.fillStyle = "#18181b";
  const patches = [
    { x: size * 0.25, y: size * 0.25, r: size * 0.16 },
    { x: size * 0.75, y: size * 0.25, r: size * 0.16 },
    { x: size * 0.5, y: size * 0.5, r: size * 0.18 },
    { x: size * 0.25, y: size * 0.75, r: size * 0.16 },
    { x: size * 0.75, y: size * 0.75, r: size * 0.16 },
    { x: 0, y: size * 0.5, r: size * 0.12 },
    { x: size, y: size * 0.5, r: size * 0.12 },
    { x: size * 0.5, y: 0, r: size * 0.12 },
    { x: size * 0.5, y: size, r: size * 0.12 },
  ];

  for (const p of patches) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Seam lines
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export function createGoalNetTexture(size = 32): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export function createAdBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, 512, 64);

  // Checkered border
  for (let x = 0; x < 512; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? "#ef4444" : "#2563eb";
    ctx.fillRect(x, 0, 16, 6);
    ctx.fillRect(x, 58, 16, 6);
  }

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★ PIXEL FPS FOOTBALL ★", 256, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export function createCrowdTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // Dark stadium stand backdrop
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, 256, 128);

  const colors = ["#ef4444", "#3b82f6", "#ffffff", "#facc15", "#10b981", "#8b5cf6", "#f97316"];
  const skinTones = ["#e8b48f", "#d9a07a", "#c68642", "#8d5524"];

  // Rows of pixel heads
  for (let y = 10; y < 120; y += 14) {
    for (let x = 6; x < 250; x += 12) {
      // Body / shirt
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(x, y + 5, 8, 8);
      // Head
      ctx.fillStyle = skinTones[Math.floor(Math.random() * skinTones.length)];
      ctx.fillRect(x + 1, y, 6, 5);
      // Hair
      ctx.fillStyle = Math.random() > 0.5 ? "#1c1917" : "#78350f";
      ctx.fillRect(x + 1, y, 6, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}
