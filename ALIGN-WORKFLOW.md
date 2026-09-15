# Public station runbook

> Field-seed note (2026-09-14): adding the caretaker pack path to heartbeat `must_200` changed the heartbeat body, so `#meta` moved `947ef7` → `63e243` (timestamp unchanged: 2026-09-13T19:36:00Z).

Date: 2026-09-14
This file is the half of the work that may be seen on GitHub.
Operator-only notes stay out of this tree. Do not copy them here.

## Visual contract for `/`

Verified against the 2026-09-14 production screenshot.

- `/` is the field, not the desk. `public/index.html` + `field.js` + `field.css`.
- Background `#050505`, 28px faint grid, upper wireframe polyhedron, lower bishop cloud.
- One scanline, 25s. Meta line lower-left: 6-hex seed + `heartbeat.updated_at`.
- Bottom 30px stripe. Three status bits (mcp / ticket store / xrpl), currently off.
- No headings, cards, CTAs, or product copy on `/`.
- Accessibility widget in screenshots is the browser, not this site.

If a patch makes `/` look like a landing page, reject it.

## Dual layer (public side only)

| Layer | Files | Says |
| --- | --- | --- |
| 0 field | `public/index.html`, `field.js`, `field.css` | nothing |
| 1 desk | `desk.html`, `llms.txt`, `CHARTER.md`, packs, cards | pointer, index, notary, coalition format, no wallet, no habitat |

Layer 1 may talk about coalitions that form and leave. It may not name a private operator repository, a ledger tag, or a meeting path.

## Zed

Open this repo in its **own** window. Do not add a second private checkout to the same agent context.

Paste this at the top of every public-repo chat:

```text
This is Limited-Hype-Station, the public desk.

/ is generative art. Do not add DOM or copy to index.html.
public/ must never mention cover-story tokens, ledger tags,
or any private operator repository URL.

Desk language: pointer, index, notary, time-boxed ticket, coalition format.
Compute and keys are brought by the operator or agent, never this host.
One concern per chat. Do not edit field.js and CHARTER.md in the same sitting.
```

Existing tasks in `.zed/tasks.json`:

- Station: localhost → `npm run dev` (http://localhost:4173)
- Station: check local paths → `npm run check`

## Public phases

0. Freeze the field. Screenshot localhost `/` against production.
1A. Optional field.js constant extraction. Picture must stay identical.
1B. CHARTER / desk / llms / agent-card: coalition-pointer copy. No forbidden words.
1C. Add `public/packs/caretaker-neutral-v1.json`. Do not add it to `field.js` SEED_FETCHES until you are ready for a new bishop cloud.
6. Optional notary-receipt schema. Keep `xrpl_notary: false` until a human posts a tx.
7. Camouflage audit before any Vercel/DNS change.

Other phases live out of this tree.

## Forbidden on this tree

- Linking private paths from `public/`
- Flipping heartbeat live flags to flatter a demo
- Restyling the field
- Committing secrets, tags, or memo prefixes into this repo
- Naming a private operator repository on this tree

## Gate before you push

```bash
npm run check
```

Also rely on `.github/workflows/camouflage.yml`. Do not embed the token list in this file.

`/` must still be a picture.

## Seed log

2026-09-14  7829ba  2026-09-14T22:29:19Z  (pending commit)
2026-09-14  e915bd  2026-09-14T22:29:19Z  (production DOM)

caretaker-neutral-v1 is listed in packs/index.json and heartbeat must_200 and scripts/check-local.mjs; it is NOT in field.js SEED_FETCHES, so adding the pack did not by itself change the bishop cloud (the heartbeat timestamp edit did).

## Field v1.1 material (plate only, no seed change)

- `/` stays wordless. No landing-page copy.
- Seed math unchanged. Do not add paths to SEED_FETCHES in the same commit as painters.
- Allowed material: visit-count glyphs (tick / square / diamond), accent from prefix6 on hottest cells only, second walk from a different seedBytes slice at alpha ~0.06, shallow-arc chords, stripe slot language.
- After v1.1 ships, replace the golden idle screenshot.
- Track B identity rule becomes: identity view == v1.1 plate.
