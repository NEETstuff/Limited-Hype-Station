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
  // reflection. A short path, so the fingerprint reads as a cloud across the
  // middle of the band, never a right-edge stack. One rectangle per visited
  // cell; size and alpha rise with visit count. No fillText, no second copy.
  const bandTop = H * 0.45;
  let hotCellGeom = null;
  const cellW = W / FieldSeed.COLS;
  const cellH = (H * 0.55) / FieldSeed.ROWS;
  const cells = [];
  for (let r = 0; r < FieldSeed.ROWS; r++) cells.push(new Array(FieldSeed.COLS).fill(0));
  {
    const dxs = [1, 1, -1, -1];
    const dys = [-1, 1, 1, -1];
    let bx = Math.floor(FieldSeed.COLS / 2);
    let by = Math.floor(FieldSeed.ROWS / 2);
    cells[by][bx] = 1;
    const bishopBytes = FieldSeed.seedBytes(seed, FieldSeed.STEPS / 4); // 32 bytes for 128 steps
    for (let s = 0; s < FieldSeed.STEPS; s++) {
      const d = (bishopBytes[s >> 2] >> ((s & 3) * 2)) & 3;
      bx += dxs[d];
      by += dys[d];
      // Reflect at edges (OpenSSH drunken bishop): never clamp-and-stick.
      if (bx < 0) bx = -bx;
      else if (bx >= FieldSeed.COLS) bx = 2 * (FieldSeed.COLS - 1) - bx;
      if (by < 0) by = -by;
      else if (by >= FieldSeed.ROWS) by = 2 * (FieldSeed.ROWS - 1) - by;
      cells[by][bx]++;
    }
    let maxVis = 0;
    let hotR = by;
    let hotC = bx;
    for (let r = 0; r < FieldSeed.ROWS; r++) {
      for (let c = 0; c < FieldSeed.COLS; c++) {
        if (cells[r][c] > maxVis) {
          maxVis = cells[r][c];
          hotR = r;
          hotC = c;
        }
      }
    }
    const cellMin = Math.min(cellW, cellH);
    // Hottest bishop cell center in CSS px (same mapping as the drawn rects).
    hotCellGeom = {
      hotX: (hotC + 0.5) * cellW,
      hotY: bandTop + (hotR + 0.5) * cellH,
      cellMin: cellMin,
    };
    const prefix6b = ("000000" + (seed & 0xffffff).toString(16)).slice(-6);
    const pr = parseInt(prefix6b.slice(0, 2), 16);
    const pg = parseInt(prefix6b.slice(2, 4), 16);
    const pb = parseInt(prefix6b.slice(4, 6), 16);
    for (let r = 0; r < FieldSeed.ROWS; r++) {
      for (let c = 0; c < FieldSeed.COLS; c++) {
        const n = cells[r][c];
        if (!n) continue;
        const t = n / maxVis; // 0..1 by visit count
        const size = Math.max(4, cellMin * (0.35 + 0.55 * t)); // 35% -> 90%, min 4 CSS px
        const alpha = 0.35 + 0.55 * t; // 0.35 -> 0.9
        if (t >= 0.999) {
          ctx.fillStyle =
            "rgba(" + pr + "," + pg + "," + pb + "," + alpha.toFixed(3) + ")";
        } else {
          ctx.fillStyle = "rgba(200,200,200," + alpha.toFixed(3) + ")";
        }
        const cxp = (c + 0.5) * cellW;
        const cyp = bandTop + (r + 0.5) * cellH;
        if (t < 1 / 3) {
          // hairline tick
          ctx.fillRect(cxp - 0.5, cyp - size / 4, 1, size / 2);
        } else if (t < 2 / 3) {
          ctx.fillRect(cxp - size / 2, cyp - size / 2, size, size);
        } else {
          ctx.beginPath();
          ctx.moveTo(cxp, cyp - size / 2);
          ctx.lineTo(cxp + size / 2, cyp);
          ctx.lineTo(cxp, cyp + size / 2);
          ctx.lineTo(cxp - size / 2, cyp);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Second walk from a different seedBytes slice (bytes 32..63), faint squares.
    {
      const full64 = FieldSeed.seedBytes(seed, 64);
      const dxs2 = [1, 1, -1, -1];
      const dys2 = [-1, 1, 1, -1];
      let bx2 = Math.floor(FieldSeed.COLS / 2);
      let by2 = Math.floor(FieldSeed.ROWS / 2);
      ctx.fillStyle = "rgba(200,200,200,0.06)";
      const sq = Math.max(2, cellMin * 0.3);
      for (let s = 0; s < FieldSeed.STEPS; s++) {
        const b = full64[32 + (s >> 2)];
        const d = (b >> ((s & 3) * 2)) & 3;
        bx2 += dxs2[d];
        by2 += dys2[d];
        if (bx2 < 0) bx2 = -bx2;
        else if (bx2 >= FieldSeed.COLS) bx2 = 2 * (FieldSeed.COLS - 1) - bx2;
        if (by2 < 0) by2 = -by2;
        else if (by2 >= FieldSeed.ROWS) by2 = 2 * (FieldSeed.ROWS - 1) - by2;
        ctx.fillRect(
          (bx2 + 0.5) * cellW - sq / 2,
          bandTop + (by2 + 0.5) * cellH - sq / 2,
          sq,
          sq
        );
      }
    }
    renderIcon(cells); // bake the favicon once per plate build
  }

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
  // (d) modulus star, kept: i -> (i * CHORD_STEP) mod N, shallow arcs
  sctx.strokeStyle = "rgba(230,230,230,0.35)";
  sctx.lineWidth = 1;
  sctx.beginPath();
  for (let i = 0; i < N; i++) {
    const j = (i * FieldSeed.CHORD_STEP) % N;
    const ax = nodes[i].x;
    const ay = nodes[i].y;
    const bx = nodes[j].x;
    const by = nodes[j].y;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const off = len * 0.08;
    sctx.moveTo(ax, ay);
    sctx.quadraticCurveTo(mx + (-dy / len) * off, my + (dx / len) * off, bx, by);
  }
  sctx.stroke();
  // (e) explicit fetch-next edges, kept and fainter than the modulus star
  sctx.strokeStyle = "rgba(200,200,200,0.12)";
  sctx.lineWidth = 1;
  sctx.beginPath();
  for (const [a, b] of FieldSeed.FETCH_NEXT_GRAPH) {
    if (!nodepos.has(a) || !nodepos.has(b)) continue;
    const ax = nodes[nodepos.get(a)].x;
    const ay = nodes[nodepos.get(a)].y;
    const bx = nodes[nodepos.get(b)].x;
    const by = nodes[nodepos.get(b)].y;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const off = len * 0.08;
    sctx.moveTo(ax, ay);
    sctx.quadraticCurveTo(mx + (-dy / len) * off, my + (dx / len) * off, bx, by);
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

  // Three tall bit bars: mcp | store | xrpl. 8px slots; on = prefix6
  // lightened, off = void.
  const slots = 3;
  const slotW = 8; // CSS px, full height
  const span = W - slotW;
  const prefix6s = ("000000" + (seed & 0xffffff).toString(16)).slice(-6);
  const sr = parseInt(prefix6s.slice(0, 2), 16);
  const sg = parseInt(prefix6s.slice(2, 4), 16);
  const sb = parseInt(prefix6s.slice(4, 6), 16);
  const lit =
    "rgb(" +
    Math.round(sr + (255 - sr) * 0.55) +
    "," +
    Math.round(sg + (255 - sg) * 0.55) +
    "," +
    Math.round(sb + (255 - sb) * 0.55) +
    ")";
  for (let k = 0; k < slots; k++) {
    const on = currentBits[k] === 1;
    const bx = (span / slots) * (k + 0.5) - slotW / 2;
    ctx.fillStyle = on ? lit : "#050505";
    ctx.fillRect(bx, 0, slotW, Hbar);
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