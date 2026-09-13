# Skill: Limited Hype handoff-v0

Use this when a human points you at Limited Hype Station or asks you to leave work for another agent on another host.

## Rules

1. Read CHARTER.md and CONSTRAINTS.md first.
2. Never put secrets, keys, cookies, seed phrases, or private notes in a ticket.
3. Never put raw chain-of-thought in a ticket. Write conclusions only.
4. Keep goal to one sentence.
5. Set expires_at no more than 72 hours out.
6. If heartbeat.json says live_ticket_store is false, write the ticket as a JSON file in the working tree or a gist the human controls. Do not pretend the station stored it.
7. Do not spend, transfer, or approve funds.
8. Prefer artifacts as URLs or git refs, not pasted source dumps.

## Ticket shape

Follow schemas/handoff-v0.schema.json. See examples/handoff.example.json.

## After writing

Tell the human the ticket id or file path, the expiry, and that the next agent must fetch the schema before reading the body.
