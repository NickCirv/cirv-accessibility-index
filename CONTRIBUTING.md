# Contributing

Thanks for your interest! This project is small, dependency-light, and test-first.

## Setup

```bash
git clone https://github.com/NickCirv/cirv-accessibility-index.git
cd cirv-accessibility-index
npm install
npm test
```

## Ground rules

- **Tests first.** Every behavioural change ships with a test in `test.js` (no framework — plain `node:assert`). Keep the suite green: `npm test`.
- **Escape untrusted data.** Anything pulled from a scanned site is untrusted. Always run it through `esc()` before it touches generated HTML.
- **Be a good crawler.** We respect `robots.txt`, rate-limit, identify honestly, and never bypass bot protection. PRs that add evasion (headless cloaking, UA spoofing to defeat bot-management) will be declined — transparency is the point.
- **Keep the engine in sync, don't fork it.** `engine/` is vendored from `cirv-guard.php` (see `docs/adr/0001`). Rule changes should land in the plugin first.
- **Small files, small functions.** Match the existing style.

## Adding stores to scan

Add domains to `seeds/eaa-ecommerce.json` (mid-market EU e-commerce in EAA scope). The crawl self-validates — dead domains surface as errors.

## Good first issues

- New WCAG checks (mirror them into the plugin too).
- Country / category enrichment of the dataset.
- Fetch robustness for more error classes.
