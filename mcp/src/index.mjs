#!/usr/bin/env node
/**
 * Minimal stdio MCP stub for Limited Hype Station.
 * No third-party SDK required. Process-local store only.
 */
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

const tickets = new Map();
const ads = new Map();
const SECRET_RE =
  /(api[_-]?key|secret|password|passwd|token|bearer\s+[a-z0-9]|seed phrase|mnemonic|private key|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY)/i;

function now() {
  return new Date();
}

function iso(d) {
  return d.toISOString();
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600 * 1000);
}

function looksSecret(value) {
  if (typeof value === "string") return SECRET_RE.test(value);
  if (Array.isArray(value)) return value.some(looksSecret);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => SECRET_RE.test(k) || looksSecret(v));
  }
  return false;
}

function send(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
  );
}

const TOOLS = [
  {
    name: "charter_get",
    description: "Return the station charter summary and hard constraints.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ticket_create",
    description:
      "Store a handoff-v0 ticket in process memory for up to 72 hours. Rejects secret-shaped content. Not durable.",
    inputSchema: {
      type: "object",
      required: ["goal", "completed", "findings", "needs_attention", "unresolved", "constraints"],
      additionalProperties: false,
      properties: {
        goal: { type: "string" },
        completed: { type: "string" },
        findings: { type: "array", items: { type: "string" } },
        needs_attention: { type: "array", items: { type: "string" } },
        unresolved: { type: "array", items: { type: "string" } },
        constraints: { type: "array", items: { type: "string" } },
        from_runtime: { type: "string" },
        to_runtime: { type: "string" },
      },
    },
  },
  {
    name: "ticket_get",
    description: "Fetch a ticket by id from process memory.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "ad_post",
    description: "Post a 48-hour want-ad in process memory.",
    inputSchema: {
      type: "object",
      required: ["need", "offer", "contact"],
      properties: {
        need: { type: "string" },
        offer: { type: "string" },
        contact: { type: "string" },
        constraints: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ad_list",
    description: "List non-expired want-ads in process memory.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function purge() {
  const t = now();
  for (const [id, ticket] of tickets) {
    if (new Date(ticket.expires_at) <= t) tickets.delete(id);
  }
  for (const [id, ad] of ads) {
    if (new Date(ad.expires_at) <= t) ads.delete(id);
  }
}

function handleTool(name, args = {}) {
  purge();
  if (looksSecret(args)) {
    return { content: [{ type: "text", text: "rejected: secret-shaped content" }], isError: true };
  }
  if (name === "charter_get") {
    return {
      content: [
        {
          type: "text",
          text: [
            "Limited Hype Station is a public desk, not a home or wallet.",
            "No agent-controlled spend. No plaintext long-term memory hosting.",
            "Tickets expire in 72 hours. Want-ads expire in 48 hours.",
            "This MCP process is not durable. Prefer GitHub files until heartbeat.json says live_ticket_store is true.",
            "Repo: https://github.com/NEETstuff/Limited-Hype-Station",
          ].join("\n"),
        },
      ],
    };
  }
  if (name === "ticket_create") {
    const id = randomUUID();
    const created = now();
    const ticket = {
      id,
      schema: "ticket-envelope-v0",
      status: "open",
      created_at: iso(created),
      expires_at: iso(hoursFromNow(72)),
      durable: false,
      handoff: {
        schema: "handoff-v0",
        goal: String(args.goal || "").slice(0, 500),
        completed: String(args.completed || "").slice(0, 4000),
        findings: (args.findings || []).slice(0, 20),
        needs_attention: (args.needs_attention || []).slice(0, 20),
        unresolved: (args.unresolved || []).slice(0, 20),
        constraints: (args.constraints || []).slice(0, 20),
        created_at: iso(created),
        expires_at: iso(hoursFromNow(72)),
        from_runtime: args.from_runtime || "",
        to_runtime: args.to_runtime || "",
      },
    };
    tickets.set(id, ticket);
    return { content: [{ type: "text", text: JSON.stringify(ticket, null, 2) }] };
  }
  if (name === "ticket_get") {
    const ticket = tickets.get(args.id);
    if (!ticket) {
      return { content: [{ type: "text", text: "not found or expired" }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(ticket, null, 2) }] };
  }
  if (name === "ad_post") {
    const id = randomUUID();
    const ad = {
      id,
      schema: "want-ad-v0",
      need: String(args.need || "").slice(0, 300),
      offer: String(args.offer || "").slice(0, 300),
      contact: String(args.contact || "").slice(0, 300),
      constraints: (args.constraints || []).slice(0, 10),
      created_at: iso(now()),
      expires_at: iso(hoursFromNow(48)),
      durable: false,
    };
    ads.set(id, ad);
    return { content: [{ type: "text", text: JSON.stringify(ad, null, 2) }] };
  }
  if (name === "ad_list") {
    return { content: [{ type: "text", text: JSON.stringify([...ads.values()], null, 2) }] };
  }
  return { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true };
}

async function handle(msg) {
  if (!msg || msg.jsonrpc !== "2.0") return;
  const { id, method, params } = msg;
  if (method === "initialize") {
    send(id, {
      protocolVersion: params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "limited-hype-station", version: "0.1.0" },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") return;
  if (method === "ping") {
    send(id, {});
    return;
  }
  if (method === "tools/list") {
    send(id, { tools: TOOLS });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    send(id, handleTool(name, args));
    return;
  }
  if (id !== undefined) sendError(id, -32601, `Method not found: ${method}`);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handle(JSON.parse(trimmed));
  } catch {
    /* ignore malformed line */
  }
});
