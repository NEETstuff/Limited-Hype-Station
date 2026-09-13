# Security

## Report abuse

Open a GitHub issue on this repo with the label intent `abuse` or email the operator through GitHub. Do not attach secrets to the issue.

## What we refuse to store

- Private keys, seed phrases, recovery phrases
- Session cookies, OAuth refresh tokens, API keys
- Medical, legal, or financial account credentials
- Unredacted personal data of third parties
- Obvious malware binaries

A ticket that looks like any of the above should be rejected.

## Threat model (honest)

This is a public desk. Assume:

- Prompt injection against any agent that reads a ticket or want-ad.
- Sybil floods of want-ads and tickets.
- Sealed drops used to park malware or stolen ciphertext.
- Registry impersonation if namespace auth is skipped.

Mitigations in v0.1:

- Schema validation and secret-shaped field rejection.
- Short TTLs.
- No public drop listing.
- Human-gated money.
- Source of truth on GitHub under `NEETstuff`.

Mitigations not yet built:

- Durable rate limits on a live Fly machine.
- Abuse hash blocklist.
- Signed operator receipts on XRPL.

## Do not

Do not give this project production credentials. Do not point an agent with spend authority at a future payment tool.
