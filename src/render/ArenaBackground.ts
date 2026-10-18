export interface ArenaPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateArenaBackground(
  W: number,
  H: number,
  groundY: number
): { canvas: HTMLCanvasElement; platforms: ArenaPlatform[] } {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const rnd = mulberry32(9824 + W * 3 + H);

  // 1. Dark Atmospheric Sky
  const sky = ["#090d1f", "#0c1633", "#111f42"];
  const bandH = Math.ceil((groundY - 20) / sky.length);
  sky.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(0, i * bandH, W, bandH);
  });

  // 2. Crowd in Arena Stands
  const crowdTop = Math.max(4, Math.floor(H * 0.08));
  const crowdBottom = groundY - 24;
  const standCols = ["#121d3b", "#18264d", "#22356b", "#1a2a54"];
  const cheeringHeads = ["#f97316", "#38bdf8", "#eab308", "#4ade80", "#c084fc", "#f8fafc"];

  for (let y = crowdTop; y < crowdBottom; y += 3) {
    const depth = (y - crowdTop) / Math.max(1, crowdBottom - crowdTop);
    for (let x = 0; x < W; x += 3) {
      const r = rnd();
      g.fillStyle =
        r < 0.08 + depth * 0.05
          ? cheeringHeads[(rnd() * cheeringHeads.length) | 0]
          : standCols[(rnd() * standCols.length) | 0];
      g.globalAlpha = 0.5 + depth * 0.5;
      g.fillRect(x, y, 3, 3);
    }
  }
  g.globalAlpha = 1;

  // 3. Floodlight Spotlights
  for (const lx of [Math.round(W * 0.18), Math.round(W * 0.82)]) {
    for (let r = 16; r > 0; r -= 4) {
      g.fillStyle = `rgba(215, 230, 255, ${0.04 + (16 - r) * 0.01})`;
      g.fillRect(lx - r, crowdTop - 2, r * 2, Math.round(r * 0.9));
    }
    g.fillStyle = "#ffffff";
    g.fillRect(lx - 4, crowdTop - 2, 8, 2);
  }

  // 4. Arena Stone Wall Barrier
  const wallY = groundY - 22;
  g.fillStyle = "#1e293b";
  g.fillRect(0, wallY, W, 22);
  g.fillStyle = "#334155";
  g.fillRect(0, wallY, W, 2);

  // Checkered Banner
  for (let x = 0; x < W; x += 12) {
    g.fillStyle = (x / 12) % 2 === 0 ? "#f97316" : "#0ea5e9";
    g.fillRect(x, wallY + 2, 12, 2);
  }

  // 5. Arena Stone Ground
  g.fillStyle = "#1c1917";
  g.fillRect(0, groundY, W, H - groundY);

  // Flagstone Pavers
  const paverH = 6;
  for (let y = groundY; y < H; y += paverH) {
    g.fillStyle = y % 12 === 0 ? "#292524" : "#44403c";
    g.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 24) {
    g.fillStyle = "#292524";
    g.fillRect(x, groundY, 1, H - groundY);
  }

  // Neon Boundary Runes
  g.fillStyle = "rgba(249, 115, 22, 0.4)";
  g.fillRect(10, groundY, W - 20, 1);

  // 6. Floating Battle Platforms
  const platforms: ArenaPlatform[] = [
    // Center high platform
    { x: Math.round(W / 2 - 28), y: groundY - 40, w: 56, h: 5 },
    // Left mid platform
    { x: Math.round(W * 0.22 - 20), y: groundY - 22, w: 40, h: 5 },
    // Right mid platform
    { x: Math.round(W * 0.78 - 20), y: groundY - 22, w: 40, h: 5 },
  ];

  for (const plat of platforms) {
    // Stone base
    g.fillStyle = "#292524";
    g.fillRect(plat.x, plat.y, plat.w, plat.h);
    // Glowing top rim
    g.fillStyle = "#facc15";
    g.fillRect(plat.x, plat.y, plat.w, 1);
    // Platform shadow
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(plat.x, groundY, plat.w, 2);
  }

  return { canvas: cv, platforms };
}
