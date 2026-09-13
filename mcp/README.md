# Station MCP stub

Local stdio server. Process memory only. Tickets die when the process dies.

## Run

```bash
cd mcp
npm install
npm start
```

Client config example:

```json
{
  "mcpServers": {
    "limited-hype-station": {
      "command": "node",
      "args": ["mcp/src/index.mjs"]
    }
  }
}
```

## Tools

- `charter_get`
- `ticket_create`
- `ticket_get`
- `ad_post`
- `ad_list`

`ticket_create` rejects strings that look like keys or seed phrases.
