import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const board = (name) => join(here, "..", "public", "board", name);

const FORBIDDEN =
  /r[1-9A-HJ-NP-Za-km-z]{24,34}|88421007|LIMITEDHYPE|lorca|127\.0\.0\.1|escape-hatch|limited-hype-station-escape-hatch/i;

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const HASH_64 = /^0x[0-9a-f]{64}$/;
const COMMITMENT_HEX = /^[0-9a-f]+$/i;
const TAG_LIKE = /tag|prefix|salt/i;
const URL_RE = /https?:\/\/|www\.|\.(com|org|net|io|dev|app)\b/i;

function isIso8601(s) {
  return typeof s === "string" && ISO_8601.test(s) && !Number.isNaN(Date.parse(s));
}

const FILES = ["jobs.json", "recent.json", "commitment.json", "syllabus.json"];

function readBoard(name) {
  return readFileSync(board(name), "utf8");
}

describe("public board guards", () => {
  test("forbidden camouflage tokens are absent from all four board files", () => {
    for (const name of FILES) {
      const raw = readBoard(name);
      assert.equal(
        FORBIDDEN.test(raw),
        false,
        `${name} matched the forbidden camouflage regex`,
      );
    }
  });

  test("jobs: closed board, twelve rows, each completed|flagged with ISO completedAt", () => {
    const boardJson = JSON.parse(readBoard("jobs.json"));
    assert.equal(boardJson.jobs.length, 12);
    const open = boardJson.jobs.filter((j) => j.status === "open");
    assert.equal(open.length, 0, "board must have zero open jobs");
    for (const j of boardJson.jobs) {
      assert.ok(
        ["completed", "flagged"].includes(j.status),
        `unexpected status ${j.status} on ${j.id}`,
      );
      assert.ok(isIso8601(j.completedAt), `completedAt must be ISO 8601 on ${j.id}`);
    }
  });

  test("recent: three or four receipts, each with a 0x-prefixed 64-hex hash", () => {
    const recent = JSON.parse(readBoard("recent.json"));
    assert.ok(
      recent.receipts.length === 3 || recent.receipts.length === 4,
      `expected 3 or 4 receipts, got ${recent.receipts.length}`,
    );
    for (const r of recent.receipts) {
      assert.match(r.hash, HASH_64, `bad receipt hash ${r.hash}`);
    }
  });

  test("commitment: commitment is bare hex with no tag/prefix/salt decoration", () => {
    const commitment = JSON.parse(readBoard("commitment.json"));
    assert.ok(
      COMMITMENT_HEX.test(commitment.commitment),
      "commitment must be hex-only",
    );
    assert.equal(
      TAG_LIKE.test(commitment.commitment),
      false,
      "commitment must not include tag/prefix/salt words",
    );
  });

  test("syllabus: no generator reference and no URL", () => {
    const syllabus = JSON.parse(readBoard("syllabus.json"));
    const line = syllabus.line || String(syllabus);
    assert.equal(/generator/i.test(line), false, "syllabus must not mention a generator");
    assert.equal(URL_RE.test(line), false, "syllabus must not contain a URL");
  });
});