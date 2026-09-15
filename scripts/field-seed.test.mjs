import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "public", "field-seed.js"), "utf8");

const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.window = undefined;
vm.createContext(sandbox);
vm.runInContext(src + "\nthis.__FS = globalThis.FieldSeed;", sandbox);
const FieldSeed = sandbox.__FS;
assert.ok(FieldSeed, "FieldSeed must be exposed");

const hex8 = (n) => (n >>> 0).toString(16).padStart(8, "0");

// 1. stable hashes for known fixture strings
assert.equal(hex8(FieldSeed.djb2("hello")), "0a9cede7");
assert.equal(hex8(FieldSeed.djb2("field-seed")), "54ac22fd");
assert.equal(hex8(FieldSeed.djb2("spec-only")), "11dcc659");
assert.equal(hex8(FieldSeed.djb2("/heartbeat.json:1")), "a3fbe9af");

// 2. all-off heartbeat fixture
assert.deepEqual(
  FieldSeed.bitsFromHeartbeat({
    updated_at: "2026-09-14T22:29:19Z",
    live_mcp: null,
    live_ticket_store: false,
    xrpl_notary: false,
  }),
  [0, 0, 0]
);

// 3. all-on heartbeat
assert.deepEqual(
  FieldSeed.bitsFromHeartbeat({
    updated_at: "2026-09-14T22:29:19Z",
    live_mcp: "https://pointer.example/index",
    live_ticket_store: true,
    xrpl_notary: true,
  }),
  [1, 1, 1]
);

// 4. null and empty
assert.deepEqual(FieldSeed.bitsFromHeartbeat(null), [0, 0, 0]);
assert.deepEqual(FieldSeed.bitsFromHeartbeat({}), [0, 0, 0]);

// 5. seed string deterministic and sensitive to hashed parts
const a1 = FieldSeed.buildSeedString("spec-only", ["/heartbeat.json:1"]);
const a2 = FieldSeed.buildSeedString("spec-only", ["/heartbeat.json:1"]);
const b = FieldSeed.buildSeedString("spec-only", ["/heartbeat.json:2"]);
assert.equal(a1, a2);
assert.notEqual(a1, b);
assert.equal(a1, "spec-only/heartbeat.json:1");

console.log("field-seed fixtures ok");
