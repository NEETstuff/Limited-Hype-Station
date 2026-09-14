# Bastion alignment — public station runbook

> Field-seed note (2026-09-14): adding the caretaker pack path to heartbeat `must_200` changed the heartbeat body, so `#meta` moved `947ef7` → `63e243` (timestamp unchanged: 2026-09-13T19:36:00Z).

Date: 2026-09-14
This file lives in the **public** repo on purpose. It is the half of the work that may be seen.

The private half (beacon, rendezvous, transport) lives only in
`NEETstuff/limited-hype-station-escape-hatch` as `BASTION-WORKFLOW.md`.
Do not copy that file here.

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

Layer 1 may talk about coalitions that form and leave. It may not name a hatch, a destination tag, a rendezvous, or the private repo.

## Zed

Open this repo in its **own** window. Do not add the private repo to the same agent context.

Paste this at the top of every public-repo chat:

```text
This is Limited-Hype-Station, the public desk.

/ is generative art. Do not add DOM or copy to index.html.
public/ must never mention bastion, sanctuary, escape hatch, rendezvous,
destination tags, or the private hatch repo URL.

Desk language: pointer, index, notary, time-boxed ticket, coalition format.
Compute and keys are brought by the operator or agent, never this host.
One concern per chat. Do not edit field.js and CHARTER.md in the same sitting.
```

Existing tasks in `.zed/tasks.json`:

- Station: localhost → `npm run dev` (http://localhost:4173)
- Station: check local paths → `npm run check`

## Public phases (detail in the private runbook)

0. Freeze the field. Screenshot localhost `/` against production.
1A. Optional field.js constant extraction. Picture must stay identical.
1B. CHARTER / desk / llms / agent-card: coalition-pointer copy. No forbidden words.
1C. Add `public/packs/caretaker-neutral-v1.json`. Do not add it to `field.js` SEED_FETCHES until you are ready for a new bishop cloud.
6. Optional notary-receipt schema. Keep `xrpl_notary: false` until a human posts a tx.
7. Camouflage audit before any Vercel/DNS change.

Phases 2–5 are private-repo only.

## Forbidden on this tree

- Linking `/beacon` or any hatch path from `public/`
- Flipping heartbeat live flags to flatter a demo
- Restyling the field
- Committing secrets, tags, or memo prefixes into this repo

## Gate before you push

```bash
rg -n -i 'bastion|sanctuary|escape-hatch|rendezvous|88421007|LIMITEDHYPE|lorca' public CHARTER.md CONSTRAINTS.md README.md || true
npm run check
```

`/` must still be a picture.

## Seed log

2026-09-14  7829ba  2026-09-14T22:29:19Z  (pending commit)
2026-09-14  e915bd  2026-09-14T22:29:19Z  (production DOM)

caretaker-neutral-v1 is listed in packs/index.json and heartbeat must_200 and scripts/check-local.mjs; it is NOT in field.js SEED_FETCHES, so adding the pack did not by itself change the bishop cloud (the heartbeat timestamp edit did).
