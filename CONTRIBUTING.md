# Contributing

Keep changes small, source-backed and covered by a regression test. This repository includes a crawler, a vendored check engine, a generated directory and a separate API; changes should identify which of those surfaces they affect.

## Local setup

Use Node.js 22.x and npm. Clone the repository, install dependencies with `npm install`, then run `npm test`. The test command runs `node test.js` followed by `node api/test.js`; `npm run test:crawler` and `npm run test:api` run the suites separately. These are instructions, not a claim that the suites passed in the documentation review.

## Change checklist

- Add a behavior test in the relevant suite. Cover the previous failure and the intended result, including error paths when changing fetch, storage or authentication behavior.
- Treat fetched markup and domain names as untrusted. Run values through the existing `esc()` function before they enter generated HTML.
- Keep robots handling, throttling and honest crawler identification intact. Do not add bot-protection evasion or use configuration flags to bypass a site's access restrictions.
- Rule changes must land in the canonical `cirv-guard.php` plugin first. The check engine is vendored; follow the [accepted architecture decision](docs/adr/0001-vendored-engine.md) rather than silently diverging.
- Match the existing small-module style and describe user-visible changes in the pull request.

## Dataset and generated pages

Add candidate domains to `seeds/eaa-ecommerce.json`; use the small sample seed list for a bounded crawl. Crawling makes external requests and writes scan records. Check error/skipped records before interpreting scores. `npm run report` inspects stored results; `npm run build` writes generated pages into `public/` by default. Review those pages locally before any separate publication step.

## API changes

Keep dataset and API-key storage concerns separate. Changes to routes, bearer authentication, rate limits or billing should update `api/test.js` and the [API reference](docs/REFERENCE.md). Do not commit credentials or copy live keys into fixtures.

## Reporting security issues

Use the established [security policy](SECURITY.md). This contribution guide does not replace its reporting channel.
