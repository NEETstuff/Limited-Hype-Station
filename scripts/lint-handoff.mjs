#!/usr/bin/env node
// lint-handoff.mjs — validate a handoff-v0 JSON locally against
// schemas/handoff-v0.schema.json. No dependencies. Prints one line to stdout,
// exit 0 on accept / exit 1 on reject. Never prints the payload.
//
//   node scripts/lint-handoff.mjs <file.json>

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(new URL("../schemas/handoff-v0.schema.json", import.meta.url));
const filePath = process.argv[2];

function fail(reason) {
  console.log("reject " + reason);
  process.exit(1);
}

if (!filePath) {
  fail("usage: node scripts/lint-handoff.mjs <file.json>");
}

let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch (e) {
  fail("cannot read schema: " + e.message);
}

let data;
try {
  data = JSON.parse(readFileSync(filePath, "utf8"));
} catch (e) {
  fail("not valid JSON: " + e.message);
}

// Fixtures wrap the object under a "handoff" key; bare handoffs lint directly.
const handoff =
  data && typeof data.handoff === "object" && data.handoff !== null
    ? data.handoff
    : data;

if (!handoff || typeof handoff !== "object") {
  fail("no handoff object");
}

const allowed = new Set(Object.keys(schema.properties || {}));
const required = Array.isArray(schema.required) ? schema.required : [];

// 1) required fields (from the schema's required array)
for (const name of required) {
  if (!(name in handoff)) fail("missing required field: " + name);
}

// 2) schema marker must match
if (handoff.schema !== "handoff-v0") {
  fail("schema is not handoff-v0");
}

// 3) secrets across every string value (content_hash is a hash by design, skip it)
const secretRe =
  /(sk-[a-zA-Z0-9]{8,}|api[_-]?key|BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY|seed\s+phrase|mnemonic)/i;
const hexRe = /\b[0-9a-fA-F]{32,}\b/;
(function scan(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const it of node) scan(it);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string") {
      if (secretRe.test(v)) fail("secret-like payload: " + k);
      if (k !== "content_hash" && hexRe.test(v)) fail("secret-like hex dump: " + k);
    } else {
      scan(v);
    }
  }
})(handoff);

// 4) forbid unknown fields when the schema says additionalProperties is false
if (schema.additionalProperties === false) {
  for (const k of Object.keys(handoff)) {
    if (!allowed.has(k)) fail("unexpected field: " + k);
  }
}

// 5) TTL / ordering: created_at < expires_at <= created_at + 72h
const created = Date.parse(handoff.created_at);
const expires = Date.parse(handoff.expires_at);
if (Number.isNaN(created) || Number.isNaN(expires)) {
  fail("created_at/expires_at not RFC 3339");
}
if (expires <= created) {
  fail("expires_at not after created_at");
}
if (expires - created > 72 * 3600 * 1000) {
  fail("expires_at beyond 72h");
}

console.log("accept");
process.exit(0);
