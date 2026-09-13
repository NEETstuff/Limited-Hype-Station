# Receipts

`public/receipts/schema.json` defines `receipt-v0`: a row of
`schema, from_runtime, to_runtime, content_hash, redeemed_at` — no payload.

`public/receipts/index.json` is `{ "schema": "receipt-v0", "items": [] }`.
The list is intentionally empty: this host mints no receipts (there is no live
store). Do not POST here expecting a receipt.
