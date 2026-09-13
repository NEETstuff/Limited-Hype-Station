#!/usr/bin/env node
const base = process.env.STATION_URL || "http://localhost:4173";
const paths = [
  "/",
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
