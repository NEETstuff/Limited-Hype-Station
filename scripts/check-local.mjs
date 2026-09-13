#!/usr/bin/env node
const base = process.env.STATION_URL || "http://localhost:4173";
const paths = [
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
  "/loop.json",
  "/lint/handoff.json",
  "/lint/accepts/minimal.json",
  "/lint/rejects/secret-in-envelope.json",
  "/lint/rejects/expired.json",
  "/receipts/schema.json",
  "/receipts/index.json",
  "/skill.md",
  "/.well-known/ai-catalog.json",
  "/favicon.svg",
  "/marks.json",
  "/marks/schema.json",
];

const failures = [];
for (const path of paths) {
  const url = base + path;
  try {
    const res = await fetch(url);
    const ok = res.ok;
    console.log(`${ok ? "ok " : "BAD"} ${res.status} ${path}`);
    if (!ok) failures.push(path);
  } catch (err) {
    console.log(`BAD 000 ${path}  (${err.cause?.code || err.message})`);
    failures.push(path);
  }
}

if (failures.length) {
  console.error(`\nFailed ${failures.length} path(s). Is npm run dev running at ${base}?`);
  process.exit(1);
}
console.log("\nAll station paths responded.");
