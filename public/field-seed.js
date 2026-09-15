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

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) ^ str.charCodeAt(i)) & 0xffffffff;
  }
  return h;
}

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

function seedBytes(seed, n) {
  const out = new Uint8Array(n);
  let s = seed & 0xffffffff;
  for (let i = 0; i < n; i++) {
    s ^= (s << 13) & 0xffffffff;
    s &= 0xffffffff;
    s ^= s >> 17;
    s ^= (s << 5) & 0xffffffff;
    s &= 0xffffffff;
    out[i] = s & 0xff;
  }
  return out;
}

const COLS = 32;
const ROWS = 48;
const STEPS = 128;
const CHORD_STEP = 5;

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

function buildSeedString(updatedAt, hashedParts) {
  const when = updatedAt || "spec-only";
  return when + hashedParts.join("");
}

function bitsFromHeartbeat(hbData) {
  return [
    (hbData && typeof hbData.live_mcp === "string" && hbData.live_mcp.length > 0) ? 1 : 0,
    (hbData && hbData.live_ticket_store === true) ? 1 : 0,
    (hbData && hbData.xrpl_notary === true) ? 1 : 0,
  ];
}

globalThis.FieldSeed = {
  djb2,
  mulberry32,
  seedBytes,
  SEED_FETCHES,
  KNOWN_PATHS,
  FETCH_NEXT_GRAPH,
  COLS,
  ROWS,
  STEPS,
  CHORD_STEP,
  buildSeedString,
  bitsFromHeartbeat,
};
