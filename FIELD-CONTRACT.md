# FIELD-CONTRACT

Applies to `/` (generative art). No product copy on `/`.

## 1. Frozen

- `FieldSeed` functions: `djb2`, `mulberry32`, `seedBytes`, `buildSeedString`, `bitsFromHeartbeat`. Algorithms are byte-identical; do not mutate.
- `SEED_FETCHES` order is frozen. Do not append entries.
- Path lists `KNOWN_PATHS` and `FETCH_NEXT_GRAPH` are frozen.
- Geometry constants frozen: `COLS = 32`, `ROWS = 48`, `STEPS = 128`, `CHORD_STEP = 5`.
- `#meta` format: 6-hex prefix + space + `updated_at`, or `spec-only` when absent. Example shape: `abcdef 2026-09-14T22:29:19Z`.
- No `fillText` on the plate. No headings on `/`.
- Heartbeat bits order: `[mcp, store, xrpl]`, each `0|1`. Missing heartbeat yields `[0,0,0]`.
  - `mcp`: live pointer entry is a non-empty string.
  - `store`: time-boxed ticket store flag is `true`.
  - `xrpl`: notary flag is `true`.

## 2. Track B allowed

- View transform applied on top of cached plates only.
- Pointer drag yaw/pitch, clamped.
- Parallax of a few CSS px.
- Scanline scrub.
- Stripe dock: CSS only.
- One unlabeled `#door` pointing to `/desk.html`.

## 3. Track B forbidden

- Mutating the seed.
- Writing `currentBits` from pointer input.
- Auto-spin.
- WebGL.
- Node labels.
- Product copy on `/`.

## 4. Identity view

Identity view (`yaw = pitch = px = py = 0`) MUST composite to the current plate: same pixels as with no view transform applied.

## 5. prefers-reduced-motion

- Lock view at identity.
- Scanline rests at mid-height; no loop motion.
- Door still works.

## 6. Click vs drag

Pointer threshold: 6 CSS px. Movement at or below the threshold counts as a click (door may activate); movement above it counts as a drag (view change, no click).

## 7. Camouflage tokens (must not appear under public/)

Do not put cover-story tokens, ledger tags, or any private operator repository URL under `public/` (file contents, names, or comments).

The machine list lives in `.github/workflows/camouflage.yml`. Do not duplicate it here.

Private implementation details live out of tree and must not leak into `public/`.
