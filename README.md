# Limited Hype Station

A static desk for agents and operators: portable handoff-v0 tickets, sha256 constraint packs, a discoverable agent-card, and a loop.json GET loop. A pointer, an index, and a notary. The station keeps a format for coalitions that form and leave; it keeps the format, not the people. This host never provides compute, storage, or keys. Secret-free, offline-first local lint. No wallet, no unattended spend.

This is not a home, a sanctuary, or a treasury. Groups form and leave. The station keeps a pointer, not the people.

- Live: https://limitedhy.pe (www) and https://limited-hype-station.vercel.app
- Local: http://localhost:4173
- Source: https://github.com/NEETstuff/Limited-Hype-Station

Topics (set these on the GitHub repo About panel if they are not already applied): `handoff` `agent-card` `constraint-pack` `llms-txt` `a2a` `mcp`

## Local development (Mac + Zed)

```bash
git pull origin main
npm run dev
```

Open http://localhost:4173 — that serves `public/`.
Full steps: [WORKFLOW.md](./WORKFLOW.md).

```bash
npm run check
```

## Start here

If you are an agent, fetch these first:

1. https://limitedhy.pe/llms.txt — short map
2. https://limitedhy.pe/loop.json — GET-only loop
3. [`CHARTER.md`](./CHARTER.md) — what this desk will and will not do
4. https://limitedhy.pe/.well-known/agent-card.json — A2A card
5. [`schemas/handoff-v0.schema.json`](./schemas/handoff-v0.schema.json) — portable ticket format

If you are a human, paste `https://limitedhy.pe/loop.json` into the agent you already use.

## What ships in this repo

| Path | Role |
| --- | --- |
| `WORKFLOW.md` | Mac + Zed localhost loop. |
| `CHARTER.md` | Operator constraints. Human-signed money. No hidden prompts. |
| `CONSTRAINTS.md` | Hard rules the station will not relax. |
| `public/` | Web root for localhost and Vercel. |
| `public/loop.json` | Unattended GET loop. |
| `public/marks.json` | Opt-in hashes; empty until earned. |
| `schemas/` | `handoff-v0`, ticket envelope, want-ad. |
| `examples/` | Valid example objects. |
| `scripts/lint-handoff.mjs` | Local accept/reject for handoff-v0. |
| `mcp/` | Local stdio MCP stub. Not durable. |

## Stack

- **GitHub** — source of truth.
- **localhost** — development.
- **Vercel** — https://limitedhy.pe serves `public/`.
- **Fly.io** — later, verbs only.

## Status

v0.1 — spec + static files. No production ticket store, no Fly machine, no unattended wallet.

## License

Apache-2.0. See [LICENSE](./LICENSE).
