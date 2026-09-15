const canvas = document.getElementById("field");
const metaEl = document.getElementById("meta");
const stripeEl = document.getElementById("stripe");

// Stripe status bits: [live_mcp, live_ticket_store, xrpl_notary], each 0|1.
let currentBits = [0, 0, 0];
let stripeCanvas = null;

let seed;

// Offscreen caches: bishopPlate holds grid + bishop walk; starPlate holds
// star + fetch-next edges + nodes. Rebuilt only on resize; the rAF loop
// composites both and paints the scanline on top.
let bishopPlate = null;
let starPlate = null;
let plateW = 0;
let plateH = 0;
let iconCanvas = null;

// Plate geometry in CSS px, refreshed on each renderPlate. Consumed by the
// pointer machine (FieldView) to place the door and hit-test the hottest cell.
// Never feeds back into the seed, plates, or currentBits.
let plateGeom = null;

// Track A painters accent — never feeds back into the seed or plate geometry.
// accentRGB is the exact 6-hex prefix6 -> rgb, used for the hottest cells;
// lightAccentRGB is a lightened prefix6 for the stripe on-slots. Both are
// derived once from the value already painted into #meta.
let accentRGB = "200,220,255";
let lightAccentRGB = "230,230,230";

// Scanline: one 1px horizontal line, rgba(255,255,255,0.12). Only motion on the plate.
const SCAN_PERIOD_MS = 25000; // ~1 viewport height per 25s
const reducedMotion =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let scanY = 0;

// 32x32 tab icon: the same 32x48 bishop visit grid, downsampled to 1px cells,
// light on the dark page so it reads in the tab. Rebuilt on each plate build
// (initial draw + resize); never touched by the scanline rAF loop.
function renderIcon(cells) {
  if (!iconCanvas) iconCanvas = document.createElement("canvas");
  iconCanvas.width = 32;
  iconCanvas.height = 32;
  const ictx = iconCanvas.getContext("2d");
  ictx.fillStyle = "#050505";
  ictx.fillRect(0, 0, 32, 32);
  ictx.fillStyle = "#c8c8c8";
  for (let r = 0; r < FieldSeed.ROWS; r++) {
    for (let c = 0; c < FieldSeed.COLS; c++) {
      if (!cells[r] || !cells[r][c]) continue;
      const x = Math.floor((c * 32) / FieldSeed.COLS);
      const y = Math.floor((r * 32) / FieldSeed.ROWS);
      const x2 = Math.floor(((c + 1) * 32) / FieldSeed.COLS);
      const y2 = Math.floor(((r + 1) * 32) / FieldSeed.ROWS);
      ictx.fillRect(x, y, Math.max(1, x2 - x), Math.max(1, y2 - y));
    }
  }
  const iconEl = document.getElementById("field-icon");
  if (iconEl) iconEl.href = iconCanvas.toDataURL("image/png");
}

function renderPlate() {
  if (seed === undefined) return;
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth || 800;
  const H = window.innerHeight || 600;
  plateW = W;
  plateH = H;
  if (!bishopPlate) bishopPlate = document.createElement("canvas");
  if (!starPlate) starPlate = document.createElement("canvas");
  bishopPlate.width = Math.round(W * dpr);
  bishopPlate.height = Math.round(H * dpr);
  starPlate.width = Math.round(W * dpr);
  starPlate.height = Math.round(H * dpr);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  const ctx = bishopPlate.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

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

  // (b) drunken-bishop walk driven by 32 bytes of the seed (OpenSSH randomart).
  // 32 bytes -> 256 bits -> STEPS=128 diagonal moves, 2 bits each, with edge
  // reflection. Track A paint: visit-count glyphs (hairline tick / square /
  // diamond); only the hottest cells take their fill from the 6-hex prefix
  // shown in #meta, everything else stays graphite. A second, faint walk (a
  // different seedBytes slice at ~0.06 alpha) bridges the same grid. No
  // fillText, no particles.
  const bandTop = H * 0.45;
  let hotCellGeom = null;
  const cellW = W / FieldSeed.COLS;
  const cellH = (H * 0.55) / FieldSeed.ROWS;
  const dxs = [1, 1, -1, -1];
  const dys = [-1, 1, 1, -1];
  const midR = Math.floor(FieldSeed.ROWS / 2);
  const midC = Math.floor(FieldSeed.COLS / 2);
  // One shared drunken-bishop step machine (2 bits/step, edge reflection).
  function runWalk(bytes, startR, startC) {
    const w = [];
    for (let r = 0; r < FieldSeed.ROWS; r++) w.push(new Array(FieldSeed.COLS).fill(0));
    w[startR][startC] = 1;
    let r0 = startR;
    let c0 = startC;
    for (let s = 0; s < FieldSeed.STEPS; s++) {
      const d = (bytes[s >> 2] >> ((s & 3) * 2)) & 3;
      let bx = c0 + dxs[d];
      let by = r0 + dys[d];
      // Reflect at edges (OpenSSH drunken bishop): never clamp-and-stick.
      if (bx < 0) bx = -bx;
      else if (bx >= FieldSeed.COLS) bx = 2 * (FieldSeed.COLS - 1) - bx;
      if (by < 0) by = -by;
      else if (by >= FieldSeed.ROWS) by = 2 * (FieldSeed.ROWS - 1) - by;
      w[by][bx]++;
      c0 = bx;
      r0 = by;
    }
    let maxVis = 0;
    let hotR = r0;
    let hotC = c0;
    for (let r = 0; r < FieldSeed.ROWS; r++) {
      for (let c = 0; c < FieldSeed.COLS; c++) {
        if (w[r][c] > maxVis) {
          maxVis = w[r][c];
          hotR = r;
          hotC = c;
        }
      }
    }
    return { cells: w, maxVis: maxVis, hotR: hotR, hotC: hotC };
  }
  const bishopBytes = FieldSeed.seedBytes(seed, FieldSeed.STEPS / 4); // 32 bytes for 128 steps
  const walk1 = runWalk(bishopBytes, midR, midC);
  const cells = walk1.cells;
  const maxVis = walk1.maxVis || 1;
  const cellMin = Math.min(cellW, cellH);
  // Hottest bishop cell center in CSS px (same mapping as the drawn glyphs).
  hotCellGeom = {
    hotX: (walk1.hotC + 0.5) * cellW,
    hotY: bandTop + (walk1.hotR + 0.5) * cellH,
    cellMin: cellMin,
  };

  // Second walk: a different seedBytes slice (bytes 32..63 of a 64-byte draw)
  // over the same 32x48 grid, faint (~0.06 alpha) graphite tracer beneath the
  // glyphs. No Perlin, no particles.
  const extraBytes = FieldSeed.seedBytes(seed, FieldSeed.STEPS / 2); // 64 bytes
  const walk2Bytes = extraBytes.slice(FieldSeed.STEPS / 4); // bytes 32..63
  const walk2 = runWalk(walk2Bytes, midR + 2, midC + 1);
  const w2max = walk2.maxVis || 1;
  ctx.fillStyle = "rgba(185,185,185,0.06)";
  for (let r = 0; r < FieldSeed.ROWS; r++) {
    for (let c = 0; c < FieldSeed.COLS; c++) {
      const n = walk2.cells[r][c];
      if (!n) continue;
      const s2 = Math.max(2, cellMin * (0.35 + 0.5 * (n / w2max)) * 0.8);
      ctx.fillRect((c + 0.5) * cellW - s2 / 2, bandTop + (r + 0.5) * cellH - s2 / 2, s2, s2);
    }
  }

  // Primary glyphs: hairline tick (low), square (mid), diamond (high). Hottest
  // cells fill from prefix6's exact rgb; everything else stays graphite.
  for (let r = 0; r < FieldSeed.ROWS; r++) {
    for (let c = 0; c < FieldSeed.COLS; c++) {
      const n = cells[r][c];
      if (!n) continue;
      const t = n / maxVis; // 0..1 by visit count
      const isHot = t >= 0.999;
      const size = Math.max(3, cellMin * (0.3 + 0.45 * t));
      const gx = (c + 0.5) * cellW;
      const gy = bandTop + (r + 0.5) * cellH;
      const col = isHot ? accentRGB : "190,190,190";
      const alpha = isHot ? 0.95 : 0.3 + 0.5 * t;
      ctx.fillStyle = "rgba(" + col + "," + alpha.toFixed(3) + ")";
      if (t < 1 / 3) {
        ctx.fillRect(gx - 0.5, gy - size / 2, 1, size); // hairline tick
      } else if (t < 2 / 3) {
        ctx.fillRect(gx - size / 2, gy - size / 2, size, size); // square
      } else {
        ctx.beginPath(); // diamond
        ctx.moveTo(gx, gy - size / 2);
        ctx.lineTo(gx + size / 2, gy);
        ctx.lineTo(gx, gy + size / 2);
        ctx.lineTo(gx - size / 2, gy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  renderIcon(cells); // bake the favicon once per plate build

  // (c) N nodes on a small circle centered in the upper 40%.
  ctx.restore();
  const sctx = starPlate.getContext("2d");
  sctx.save();
  sctx.scale(dpr, dpr);
  sctx.clearRect(0, 0, W, H);
  const N = FieldSeed.KNOWN_PATHS.length;
  const nodepos = new Map();
  FieldSeed.KNOWN_PATHS.forEach((p, i) => nodepos.set(p, i));
  const cx = W * 0.5;
  const cy = H * 0.2;
  const R = Math.min(W, H) * 0.22;
  // Star-center (door target) + hottest bishop cell, both in CSS px.
  plateGeom = {
    starX: cx,
    starY: cy,
    hotX: hotCellGeom ? hotCellGeom.hotX : cx,
    hotY: hotCellGeom ? hotCellGeom.hotY : cy,
    cellMin: hotCellGeom ? hotCellGeom.cellMin : 44,
  };
  if (typeof FieldView !== "undefined") FieldView.syncLayout();
  const nodes = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    nodes.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  // (d) modulus star as shallow-arc chords, i -> (i * CHORD_STEP) mod N
  const bulge = Math.min(W, H) * 0.035;
  function arcBetween(a, b) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let dx = mx - cx;
    let dy = my - cy;
    const len = Math.hypot(dx, dy) || 1;
    let px = mx + (dx / len) * bulge;
    let py = my + (dy / len) * bulge;
    sctx.moveTo(a.x, a.y);
    sctx.quadraticCurveTo(px, py, b.x, b.y);
  }
  sctx.strokeStyle = "rgba(230,230,230,0.35)";
  sctx.lineWidth = 1;
  sctx.beginPath();
  for (let i = 0; i < N; i++) {
    const j = (i * FieldSeed.CHORD_STEP) % N;
    if (j === i) continue;
    arcBetween(nodes[i], nodes[j]);
  }
  sctx.stroke();
  // (e) fetch-next edges: same shallow-arc language, fainter than the modulus star
  sctx.strokeStyle = "rgba(200,200,200,0.12)";
  sctx.lineWidth = 1;
  sctx.beginPath();
  for (const [a, b] of FieldSeed.FETCH_NEXT_GRAPH) {
    if (!nodepos.has(a) || !nodepos.has(b)) continue;
    arcBetween(nodes[nodepos.get(a)], nodes[nodepos.get(b)]);
  }
  sctx.stroke();
  sctx.fillStyle = "rgba(240,240,240,0.75)";
  for (let i = 0; i < N; i++) {
    sctx.beginPath();
    sctx.arc(nodes[i].x, nodes[i].y, 2.2, 0, Math.PI * 2);
    sctx.fill();
  }
  sctx.restore();
}

// Composite cached plates with the FieldView view transform, then paint the
// single scanline on top. Identity (yaw=pitch=px=py=0) skips the transform so
// output is byte-identical to the cached plates.
function composite() {
  if (!bishopPlate || !starPlate) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  const vt =
    typeof FieldView !== "undefined"
      ? FieldView.getViewTransform()
      : { yaw: 0, pitch: 0, px: 0, py: 0 };
  const zero =
    vt.yaw === 0 && vt.pitch === 0 && vt.px === 0 && vt.py === 0;
  if (!zero) {
    // Slight 2D tilt around viewport center to fake yaw/pitch orbit.
    // At identity this branch is skipped -> exact pixel match with plates.
    const cx = plateW / 2;
    const cy = plateH / 2;
    // Narrow the orbit margin so edges stay inside the plate.
    const sx = 1 - Math.abs(vt.yaw) * 0.0015;
    const sy = 1 - Math.abs(vt.pitch) * 0.0015;
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.translate(-cx + vt.yaw * 0.4, -cy + vt.pitch * 0.4);
  }
  ctx.drawImage(bishopPlate, 0, 0, plateW, plateH);
  if (!zero) {
    // Parallax: star plate shifts by a few more CSS px than the bishop plate.
    ctx.save();
    ctx.translate(vt.px, vt.py);
  }
  ctx.drawImage(starPlate, 0, 0, plateW, plateH);
  if (!zero) ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, scanY, plateW, 1);
  ctx.restore();
}

function frame(ts) {
  scanY = FieldView.getScan(ts, window.innerHeight || 600);
  composite();
  requestAnimationFrame(frame);
}

// Reduced motion: draw the line once at mid-height, no rAF loop.
function startScanline() {
  if (reducedMotion) {
    scanY = FieldView.getScan(0, window.innerHeight || 600);
    composite();
    return;
  }
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

  const rand = FieldSeed.mulberry32(seed ^ 0x5154);

  // Quiet filler: a barcode of many thin vertical ticks across the full width,
  // bottom-anchored, translucent gray, heights/opacity rolling off the seed.
  const tickW = 2;   // CSS px
  const tickGap = 3; // CSS px
  let x = 1;
  while (x < W - 1) {
    const qh = Hbar * (0.25 + 0.55 * rand()); // 25%..80% of the 30px band
    const qa = 0.10 + 0.18 * rand();          // 0.10..0.28
    ctx.fillStyle = "rgba(190,190,190," + qa.toFixed(3) + ")";
    ctx.fillRect(x, Hbar - qh, tickW, qh);
    x += tickW + tickGap;
  }

  // Three tall status slots: mcp | store | xrpl. Taller than the filler, with a
  // clean void gap when off and the prefix6-derived light accent when on.
  const slots = 3;
  const slotW = 8; // CSS px, full height — clearly taller than filler ticks
  const span = W - slotW;
  for (let k = 0; k < slots; k++) {
    const on = currentBits[k] === 1;
    const bx = (span / slots) * (k + 0.5) - slotW / 2;
    ctx.clearRect(bx, 0, slotW, Hbar); // off = void
    if (on) {
      ctx.fillStyle = "rgba(" + lightAccentRGB + ",0.95)";
      ctx.fillRect(bx, 0, slotW, Hbar);
    }
  }
  ctx.restore();
}

async function main() {
  let updatedAt = null;
  let hbData = null;
  const hashedParts = [];

  for (const p of FieldSeed.SEED_FETCHES) {
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
      hashedParts.push(p + ":" + FieldSeed.djb2(body));
    } catch (e) {
      // ignore individual failures; skip this file's contribution
    }
  }

  const seedStr = FieldSeed.buildSeedString(updatedAt, hashedParts);
  const when = updatedAt || "spec-only";
  seed = FieldSeed.djb2(seedStr);
  const prefix6 = ("000000" + (seed & 0xffffff).toString(16)).slice(-6);

  metaEl.textContent = prefix6 + " " + when;

  // Track A accent from the same prefix6 already shown in #meta: exact rgb for
  // hottest cells, lightened for the stripe on-slots. Paint-only, no seed input.
  const pr = parseInt(prefix6.slice(0, 2), 16);
  const pg = parseInt(prefix6.slice(2, 4), 16);
  const pb = parseInt(prefix6.slice(4, 6), 16);
  accentRGB = pr + "," + pg + "," + pb;
  const lmix = 0.72;
  lightAccentRGB =
    Math.round(pr + (255 - pr) * lmix) + "," +
    Math.round(pg + (255 - pg) * lmix) + "," +
    Math.round(pb + (255 - pb) * lmix);

  // Status bits: live_mcp as any non-empty string URL (null/absent -> 0);
  // live_ticket_store and xrpl_notary as booleans. Absent heartbeat -> all 0.
  currentBits = FieldSeed.bitsFromHeartbeat(hbData);

  renderPlate();
  renderStripe();
  if (typeof FieldView !== "undefined") {
    FieldView.init({
      canvas: canvas,
      door: document.getElementById("door"),
      scanPeriodMs: SCAN_PERIOD_MS,
      reducedMotion: reducedMotion,
      getGeometry: function () {
        return plateGeom;
      },
    });
  }
  startScanline();
}

window.addEventListener("resize", () => {
  renderPlate();
  renderStripe();
  if (typeof FieldView !== "undefined") FieldView.syncLayout();
  if (reducedMotion) scanY = FieldView.getScan(0, window.innerHeight || 600);
  composite();
});
main();