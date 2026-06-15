# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

- Open a private **GitHub Security Advisory** on this repo (*Security → Advisories → Report a vulnerability*), or
- Contact us via [cirvgreen.com](https://cirvgreen.com).

We aim to acknowledge within 72 hours.

## Security posture

This project scans third-party websites and runs a billed API, so it is built defensively:

- **SSRF protection** — every fetch re-validates the resolved IP on each redirect hop; private/reserved/loopback/link-local ranges are blocked (`engine/fetch.js`).
- **No bot-protection bypass** — we honour `robots.txt`, identify honestly, and never cloak. Bot-walled sites are reported as "couldn't scan", never worked around.
- **Untrusted data is escaped** — all scanned third-party HTML is HTML-escaped before it is rendered into our pages (no stored XSS). Covered by tests.
- **API keys are hashed** — stored as SHA-256; the raw key is shown to the customer exactly once.
- **Secrets are env-only** — never committed (`.env` is gitignored; only `.env.example` ships). Stripe webhooks are signature-verified.
- **No PII** — only public homepage markup is analysed; nothing personal is stored.

## Scope

In scope: this repository's code (`engine/`, `src/`, `api/`) and the deployed directory + API. Out of scope: the third-party sites we scan.
