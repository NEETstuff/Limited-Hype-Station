// djb2 — deterministic 32-bit seed. Seed string shape:
//   updated_at (or "spec-only") +, for each fetched body that succeeded, "path":"djb2(body)"
//   Same file bytes + same updated_at => same seed => same picture. No wall-clock.
// Node paths mirror scripts/check-local.mjs / heartbeat.checks.must_200, in that order.
const KNOWN_PATHS = [
  "/",
  "/desk.html",
  "/handoff.html",
  "/want-ad.html",
  "/llms.txt",
  "/llms-full.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/heartbeat.json",
  "/.well-known/agent-card.json",
  "/.well-known/agent.json",
  "/.well-known/mcp/server-card.json",
  "/ai-catalog.json",
  "/packs/index.json",
  "/packs/no-spend-v1.json",
  "/packs/no-secrets-v1.json",
  "/packs/expire-72h-v1.json",
];

// Explicit fetch-next edges from station copy. Drawn faintly (no arrows/labels);
// an edge only renders when both endpoints are in KNOWN_PATHS.
const FETCH_NEXT_GRAPH = [
  ["/", "/llms.txt"],
  ["/llms.txt", "/llms-full.txt"],
  ["/llms.txt", "/heartbeat.json"],
  ["/llms.txt", "/.well-known/agent-card.json"],
  ["/handoff.html", "/llms.txt"],
  ["/want-ad.html", "/llms.txt"],
  ["/desk.html", "/llms.txt"],
  ["/ai-catalog.json", "/llms.txt"],
  ["/packs/index.json", "/ai-catalog.json"],
];

const canvas = document.getElementById("field");
const metaEl = document.getElementById("meta");
const stripeEl = document.getElementById("stripe");

// Stripe status bits: [live_mcp, live_ticket_store, xrpl_notary], each 0|1.
let currentBits = [0, 0, 0];
let stripeCanvas = null;

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) ^ str.charCodeAt(i)) & 0xffffffff;
  }
  return h;
}

// mulberry32 — tiny deterministic PRNG seeded from the 32-bit djb2 value.
function mulberry32(seed) {
  let state = seed & 0xffffffff;
  return function () {
    state = (state + 0x6d2b79f5) & 0xffffffff;
    let z = state;
    z = ((z ^ (z >> 15)) * 0x2c1b3c6d) & 0xffffffff;
    z = ((z ^ (z >> 12)) * 0x297a2d39) & 0xffffffff;
    z = (z ^ (z >> 15)) & 0xffffffff;
    return z / 4294967296;
  };
}

// Field geometry: 32x48 drunk-walk cells, chords jump by 5 nodes.
const COLS = 32;
const ROWS = 48;
const STEPS = 2400;
const CHORD_STEP = 5;

// Files whose bytes feed the seed (each hashed as text; failures are skipped).
// Heartbeat JSON is included both for updated_at and its body hash.
const SEED_FETCHES = [
  "/heartbeat.json",
  "/llms.txt",
  "/llms-full.txt",
  "/.well-known/agent-card.json",
  "/robots.txt",
  "/packs/index.json",
  "/packs/no-spend-v1.json",
  "/packs/no-secrets-v1.json",
  "/packs/expire-72h-v1.json",
  "/ai-catalog.json",
];

let seed;

// Offscreen cache of the static plate (grid + baker-bishop + both chord layers).
// Rebuilt only on resize; the rAF loop composites it and paints the scanline on top.
let plateCanvas = null;
let plateW = 0;
let plateH = 0;

// Scanline: one 1px horizontal line, rgba(255,255,255,0.12). Only motion on the plate.
const SCAN_PERIOD_MS = 25000; // ~1 viewport height per 25s
const reducedMotion =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let animStart = null;
let scanY = 0;

function renderPlate() {
  if (seed === undefined) return;
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth || 800;
  const H = window.innerHeight || 600;
  plateW = W;
  plateH = H;
  if (!plateCanvas) plateCanvas = document.createElement("canvas");
  plateCanvas.width = Math.round(W * dpr);
  plateCanvas.height = Math.round(H * dpr);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  const ctx = plateCanvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  const rand = mulberry32(seed);

  // (a) faint square grid, full-field
  ctx.strokeStyle = "rgba(80,80,80,0.10)";
  ctx.lineWidth = 1;
  const gs = 28;
  ctx.beginPath();
  for (let gx = 0.5; gx <= W; gx += gs) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
  }
  for (let gy = 0.5; gy <= H; gy += gs) {
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
  }
  ctx.stroke();

  // (b) drunken-bishop walk, rendered as an OpenSSH randomart fingerprint in the
  // lower 55%. A 32x48 cell grid fills that band; each cell shows one monochrome
  // glyph whose mark rises with visit count ( . o + = # ). No polyline scribble.
  const bandTop = H * 0.45;
  const cellW = W / COLS;
  const cellH = (H * 0.55) / ROWS;
  const glyphFor = (n) =>
    n >= 80 ? "#" : n >= 32 ? "=" : n >= 12 ? "+" : n >= 4 ? "o" : n >= 1 ? "." : null;
  const cells = [];
  for (let r = 0; r < ROWS; r++) cells.push(new Array(COLS).fill(0));
  {
    const dxs = [1, 1, -1, -1];
    const dys = [-1, 1, 1, -1];
    let bx = Math.floor(COLS / 2);
    let by = Math.floor(ROWS / 2);
    cells[by][bx] = 1;
    for (let s = 0; s < STEPS; s++) {
      const d = Math.floor(rand() * 4);
      bx += dxs[d];
      by += dys[d];
      if (bx < 0) bx = 0;
      else if (bx >= COLS) bx = COLS - 1;
      if (by < 0) by = 0;
      else if (by >= ROWS) by = ROWS - 1;
      cells[by][bx]++;
    }
    ctx.fillStyle = "#9a9a9a"; // single monochrome ink for the whole fingerprint
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyphPx = Math.max(6, Math.min(cellW, cellH) * 1.1);
    ctx.font = glyphPx + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const g = glyphFor(cells[r][c]);
        if (!g) continue;
        ctx.fillText(g, (c + 0.5) * cellW, bandTop + (r + 0.5) * cellH);
      }
    }
  }

  // (c) N nodes on a small circle centered in the upper 40%.
  const N = KNOWN_PATHS.length;
  const nodepos = new Map();
  KNOWN_PATHS.forEach((p, i) => nodepos.set(p, i));
  const cx = W * 0.5;
  const cy = H * 0.2;
  const R = Math.min(W, H) * 0.22;
  const nodes = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    nodes.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  // (d) modulus star, kept: i -> (i * CHORD_STEP) mod N
  ctx.strokeStyle = "rgba(230,230,230,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const j = (i * CHORD_STEP) % N;
    ctx.moveTo(nodes[i].x, nodes[i].y);
    ctx.lineTo(nodes[j].x, nodes[j].y);
  }
  ctx.stroke();
  // (e) explicit fetch-next edges, kept and fainter than the modulus star
  ctx.strokeStyle = "rgba(200,200,200,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [a, b] of FETCH_NEXT_GRAPH) {
    if (!nodepos.has(a) || !nodepos.has(b)) continue;
    ctx.moveTo(nodes[nodepos.get(a)].x, nodes[nodepos.get(a)].y);
    ctx.lineTo(nodes[nodepos.get(b)].x, nodes[nodepos.get(b)].y);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(240,240,240,0.75)";
  for (let i = 0; i < N; i++) {
    ctx.beginPath();
    ctx.arc(nodes[i].x, nodes[i].y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Composite the cached plate, then paint the single scanline on top.
function composite() {
  if (!plateCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.drawImage(plateCanvas, 0, 0, plateW, plateH);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, scanY, plateW, 1);
  ctx.restore();
}

function frame(ts) {
  if (animStart === null) animStart = ts;
  const elapsed = ts - animStart;
  const progress = (elapsed / SCAN_PERIOD_MS) % 1;
  scanY = progress * (window.innerHeight || 600);
  composite();
  requestAnimationFrame(frame);
}

// Reduced motion: draw the line once at mid-height, no rAF loop.
function startScanline() {
  if (reducedMotion) {
    scanY = (window.innerHeight || 600) / 2;
    composite();
    return;
  }
  animStart = null;
  requestAnimationFrame(frame);
}

// Draw the status barcode into #stripe: quiet bars from the seed, one taller
// bar per bit (white when 1, dark when 0). No text, no labels.
function renderStripe() {
  if (!stripeEl || seed === undefined) return;
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth || 800;
  const Hbar = 30;
  if (!stripeCanvas) {
    stripeCanvas = document.createElement("canvas");
    stripeEl.appendChild(stripeCanvas);
  }
  stripeCanvas.width = Math.round(W * dpr);
  stripeCanvas.height = Math.round(Hbar * dpr);
  stripeCanvas.style.width = W + "px";
  stripeCanvas.style.height = Hbar + "px";
  const ctx = stripeCanvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, Hbar);

  const rand = mulberry32(seed ^ 0x5154);
  // bar list: short run of quiet, bit0, quiet, bit1, quiet, bit2, trailing quiet
  const bars = [];
  const quiet = (n) => { while (n-- > 0) bars.push({ t: "q" }); };
  quiet(3);
  bars.push({ t: "b", i: 0 });
  quiet(2);
  bars.push({ t: "b", i: 1 });
  quiet(2);
  bars.push({ t: "b", i: 2 });
  quiet(3);

  const gap = 3;
  const barW = (W - gap * (bars.length + 1)) / bars.length;
  let x = gap;
  for (const b of bars) {
    if (b.t === "q") {
      const qh = Hbar * (0.3 + 0.35 * rand());
      ctx.fillStyle = "rgba(180,180,180,0.25)";
      ctx.fillRect(x, Hbar - qh, barW, qh);
    } else {
      const on = currentBits[b.i] === 1;
      ctx.fillStyle = on ? "#e2e2e2" : "#0f0f0f";
      ctx.fillRect(x, 0, barW, Hbar);
    }
    x += barW + gap;
  }
  ctx.restore();
}

async function main() {
  let updatedAt = null;
  let hbData = null;
  const hashedParts = [];

  for (const p of SEED_FETCHES) {
    try {
      const res = await fetch(p);
      if (!res.ok) continue;
      const body = await res.text();
      if (p === "/heartbeat.json") {
        try {
          const hb = JSON.parse(body);
          hbData = hb;
          updatedAt = hb.updated_at || null;
        } catch (e) {
          // malformed heartbeat: still hash the body, leave updatedAt null
        }
      }
      hashedParts.push(p + ":" + djb2(body));
    } catch (e) {
      // ignore individual failures; skip this file's contribution
    }
  }

  const when = updatedAt || "spec-only";
  const seedStr = when + hashedParts.join("");
  seed = djb2(seedStr);
  const prefix6 = ("000000" + (seed & 0xffffff).toString(16)).slice(-6);

  metaEl.textContent = prefix6 + " " + when;

  // Status bits: live_mcp as any non-empty string URL (null/absent -> 0);
  // live_ticket_store and xrpl_notary as booleans. Absent heartbeat -> all 0.
  currentBits = [
    (hbData && typeof hbData.live_mcp === "string" && hbData.live_mcp.length > 0) ? 1 : 0,
    (hbData && hbData.live_ticket_store === true) ? 1 : 0,
    (hbData && hbData.xrpl_notary === true) ? 1 : 0,
  ];

  renderPlate();
  renderStripe();
  startScanline();
}

window.addEventListener("resize", () => {
  renderPlate();
  renderStripe();
  if (reducedMotion) scanY = (window.innerHeight || 600) / 2;
  composite();
});
main();