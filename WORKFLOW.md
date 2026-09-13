# Local-first site workflow (Mac + Zed)

Develop the station on `http://localhost:4173`.
Do not attach `limitedhy.pe` or publish the MCP Registry until the local surface is correct.

Production target later: `https://limitedhy.pe` serving the same paths as localhost.

```
localhost:4173/llms.txt          →  limitedhy.pe/llms.txt
localhost:4173/.well-known/...   →  limitedhy.pe/.well-known/...
```

## 0. What you are building

A static desk, not an app.

| Layer | Now | Later |
| --- | --- | --- |
| Site | `public/` on localhost | Vercel, domain `limitedhy.pe` |
| Spec | `CHARTER.md`, `schemas/` | same GitHub files |
| Verbs | `mcp/` stdio stub | Fly.io, only after the site is honest |
| Broadcast | off | still off |

Success on localhost: you can open the page, fetch `/llms.txt`, fetch the agent card, and an agent you point at those URLs can read the charter.

## 1. Prerequisites (Mac)

In Terminal:

```bash
# Xcode CLI tools (if git/make missing)
xcode-select --install

# Homebrew if you do not have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git node
node -v   # 18 or newer
git -v
```

Zed: [https://zed.dev](https://zed.dev) — install, sign in if you want, then:

- **File → Open Folder…** → the clone directory
- Optional: Zed Settings → enable format on save for Markdown/JSON/HTML

## 2. Clone and open

If you already cloned, skip to the `cd`.

```bash
cd ~
mkdir -p src
cd src
git clone https://github.com/NEETstuff/Limited-Hype-Station.git
cd Limited-Hype-Station
git status
```

Open that folder in Zed. You should see `WORKFLOW.md`, `public/`, `CHARTER.md`.

Pull if this file was added after your first clone:

```bash
git pull origin main
```

## 3. Start localhost

From the repo root:

```bash
npm run dev
```

That serves `public/` at **http://localhost:4173**.

Leave the process running. In Zed: **Tasks** (command palette → "task") → **Station: localhost** if `.zed/tasks.json` loaded.

Smoke-check in a second terminal:

```bash
curl -sI http://localhost:4173/ | head -n 1
curl -s http://localhost:4173/llms.txt | head
curl -s http://localhost:4173/.well-known/agent-card.json | head
curl -s http://localhost:4173/heartbeat.json
```

Browser: open [http://localhost:4173](http://localhost:4173).

You want HTTP 200 on all four. If `.well-known` 404s, you are not serving `public/` as the web root.

## 4. What to edit while the server is running

Refresh the browser after each save. No build step.

### Site (what localhost and later Vercel serve)

| File | Job |
| --- | --- |
| `public/index.html` | Human-readable desk. Keep it HTML + links. No SPA. |
| `public/llms.txt` | First fetch for agents. Keep under ~50k characters. |
| `public/llms-full.txt` | Longer map. |
| `public/robots.txt` | Allow the agent crawlers you actually want. |
| `public/sitemap.xml` | Canonical URLs. Use `https://limitedhy.pe` even while local. |
| `public/heartbeat.json` | Honest status. `live_ticket_store` stays `false` until Fly exists. |
| `public/.well-known/agent-card.json` | A2A card |
| `public/.well-known/agent.json` | Legacy card path. Keep in sync with the file above. |
| `public/.well-known/mcp/server-card.json` | MCP discovery card |
| `public/styles.css` | Optional. Only if the HTML stays readable without it. |

### Spec (GitHub is the durable copy; site links here)

| File | Job |
| --- | --- |
| `CHARTER.md` | Will / will not |
| `CONSTRAINTS.md` | Hard rules |
| `SECURITY.md` | Abuse + refusals |
| `schemas/*.json` | Contracts |
| `examples/*.json` | Valid samples |
| `skills/handoff.md` | Text you paste into an agent |

Do not put secrets in any of these files.

## 5. Daily loop in Zed

1. `git pull`
2. `npm run dev`
3. Edit one concern per sitting (copy, card, schema — not all three at once).
4. Curl the path you changed.
5. Point Grok / Claude / Cursor at `http://localhost:4173/llms.txt` and ask it to summarize the charter. That is the real test.
6. Commit small:

```bash
git add -p
git commit -m "Adjust station copy on the local desk."
git push origin main
```

Keep commits boring and reversible.

## 6. Local agent test (before any deploy)

In Zed or any agent, paste:

```text
Read http://localhost:4173/llms.txt then http://localhost:4173/.well-known/agent-card.json.
Summarize what this desk will do and what it refuses.
Do not invent a live ticket store.
```

Pass if the agent:

- treats it as a desk, not a sanctuary
- does not claim Fly or XRPL is live
- does not offer to spend funds

## 7. Optional: local MCP stub

Separate from the site. Only if you want tool calls on this machine.

```bash
cd mcp
npm start
```

Point an MCP client at `mcp/src/index.mjs`. Tickets live in that process only. They vanish when you kill it. That is correct for v0.1.

## 8. Do not do yet

- Do not run `vercel` or connect the GitHub repo to a production domain.
- Do not point DNS for `limitedhy.pe` until localhost paths are stable.
- Do not `mcp-publisher publish`.
- Do not uncomment `fly.toml`.
- Do not add an unattended wallet, a social feed, or a JS-only shell that hides `/llms.txt`.

## 9. Later: Vercel + limitedhy.pe (when you say go)

When local is good enough:

1. In Vercel, import `NEETstuff/Limited-Hype-Station`.
2. Set **Root Directory** to `public` *or* deploy from repo root using the root `vercel.json` `buildCommand` that copies `public/` to the output dir.
3. Confirm preview URLs:
   - `/`
   - `/llms.txt`
   - `/.well-known/agent-card.json`
   - `/heartbeat.json`
4. Only then attach `limitedhy.pe`.
5. Update `heartbeat.json` if the public URL changes. Keep `live_ticket_store: false` until Fly exists.
6. Update sitemap host if needed (already `https://limitedhy.pe`).

Same paths as localhost. That is the whole point.

## 10. Path checklist

After any structural change, hit these on localhost:

- [ ] `GET /` HTML, no blank page
- [ ] `GET /llms.txt` plain text
- [ ] `GET /llms-full.txt` plain text
- [ ] `GET /robots.txt`
- [ ] `GET /sitemap.xml`
- [ ] `GET /heartbeat.json` JSON
- [ ] `GET /.well-known/agent-card.json` JSON
- [ ] `GET /.well-known/agent.json` JSON
- [ ] `GET /.well-known/mcp/server-card.json` JSON

## 11. If something breaks

| Symptom | Likely cause |
| --- | --- |
| Port in use | `lsof -i :4173` then stop the old `serve`, or `PORT=4174 npm run dev` |
| 404 on `/llms.txt` | Server not rooted on `public/` |
| Agent reads GitHub HTML instead of the desk | You pointed it at a `/blob/` URL. Use raw or localhost. |
| Card and HTML disagree | You edited one file and not the other. |
