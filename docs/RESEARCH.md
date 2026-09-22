# cirv-accessibility-index — documentation research

Reviewed 21 September 2026. Public GitHub source only.

## Revision and scope

- Commit: [`068719ce5709f958d8ca2b9c9f022d15696fb4a8`](https://github.com/NickCirv/cirv-accessibility-index/commit/068719ce5709f958d8ca2b9c9f022d15696fb4a8).
- Tree: `55fb125307863c7a8105d80ad90b0c510e622d31`; truncated: `false`.
- Capture: 35 of 35 eligible text files; all eligible text files.
- Method: package and entrypoint inspection, implementation-interface review, targeted behavior/limitation inspection, and test-source review. This is not an exhaustive correctness or security audit.
- Commands run against repository code: **none**. External services, deployment and npm publication were not verified.

## Claim and evidence map

| Documentation claim | Pinned evidence | Assessment |
| --- | --- | --- |
| Runtime, executable and development commands | [package.json](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/package.json) | Source declaration inspected; runtime unverified |
| Crawls public storefront homepages, stores static accessibility findings and builds a Cirvgreen directory with a read API. | [bin/build-site.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/build-site.js) · [src/crawl.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/crawl.js) | Implementation interfaces inspected; behavior not executed |
| Seeded crawler; SQLite history; static directory build; API keys and usage limits; separate liveness/readiness endpoints. | [bin/build-site.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/build-site.js), [bin/crawl.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/crawl.js), [bin/report.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/report.js), [api/data.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/data.js), [api/keys.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/keys.js), [api/ratelimit.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/ratelimit.js), [api/server.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/server.js), [api/stripe.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/stripe.js) | Source-backed scope, not a test result |
| Static homepage signals do not establish legal compliance or whole-site accessibility. Crawling contacts public sites; optional Firecrawl and Stripe integrations are external services. This review does not verify a live deployment. | [bin/build-site.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/build-site.js), [bin/crawl.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/crawl.js), [bin/report.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/report.js), [api/data.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/data.js), [api/keys.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/keys.js), [api/ratelimit.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/ratelimit.js), [api/server.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/server.js), [api/stripe.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/stripe.js) | Material limits documented; service compatibility remains open |
| Existing checks | [test.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/test.js), [api/test.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/test.js) | Test source read; no passing-run claim |

## Documentation inventory and disposition

| Existing document | Decision |
| --- | --- |
| [CONTRIBUTING.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/CONTRIBUTING.md) | Rewritten for crawler/API development with the existing tests-first, escaping, crawler-respect and vendored-engine rules preserved; security reporting still points to unchanged SECURITY.md. |
| [README.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/README.md) | Rewritten with source-specific purpose, direct checkout setup, limitations and verification status. Old section fragments retained where practical. |
| [SECURITY.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/SECURITY.md) | Protected security-reporting policy retained verbatim; no channel or response commitment changed. |
| [docs/adr/0001-vendored-engine.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/docs/adr/0001-vendored-engine.md) | Historical release/architecture record retained verbatim; not restyled as current product claims. |

Added `docs/REFERENCE.md` for the observed implementation and command surface, and this research record. Protected license and attribution files remain in their original locations without edits. No source or product UI was changed.

## Quality dimensions

| Dimension | Status | Evidence / next step |
| --- | --- | --- |
| Pinned provenance | Verified | Captured commit, tree and per-file hashes recorded below |
| Interface documentation | Partially verified | Source inspection only; run clean-checkout quickstart |
| Runtime behavior | Unverified | No repository execution in this review |
| Test results | Unverified | Existing tests were not run |
| Deployment / package availability | Unverified | No remote publish or live-service check |
| Visual / link checks | Unverified | Portfolio renderer and independent QA are separate from this authoring step |

## Editorial follow-up

Rewrote CONTRIBUTING.md while preserving tests-first, escaping, crawler-respect and canonical vendored-engine rules. Added complete crawler/build/report and API route/error reference. Removed erroneous extracted test labels.

## Unresolved issues

Static homepage signals do not establish legal compliance or whole-site accessibility. Crawling contacts public sites; optional Firecrawl and Stripe integrations are external services. This review does not verify a live deployment.

## Captured source inventory

This lists captured provenance, not a claim that every line received a full audit. Binary/generated/excluded files are outside the eligible text capture.

| File | SHA-256 | Bytes |
| --- | --- | --- |
| [CONTRIBUTING.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/CONTRIBUTING.md) | `b8866b5a58f5bc4ed216c0a2e8dea8295310af985c765ff3e0bd2eed309ed9dc` | 1348 |
| [LICENSE](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/LICENSE) | `727fd30788861fa8b04ed63d129e14795af7f1f044ca20d92bedafc5014d649e` | 1084 |
| [README.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/README.md) | `cfe22523275ac09f98f5df4a9cb447c5c4c3cd51541edac318e4e33a40cb4008` | 6259 |
| [SECURITY.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/SECURITY.md) | `c0f02d5e61b891f9b5246389de22f7a3dea20f9f3b5ffc143e228a65cb4f3434` | 1415 |
| [package.json](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/package.json) | `2169489ce2ccfc2834ecb2876789b3a7c3e49c9f3a3314ca3312cf4b9977e5e3` | 972 |
| [.github/workflows/ci.yml](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/.github/workflows/ci.yml) | `3963422e7991643fb9dafe8d81a2e2d7b6fcf61b6b18985b8e5ba79a558f6272` | 366 |
| [.github/workflows/keepalive.yml](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/.github/workflows/keepalive.yml) | `33f20b3c73388bbad8cdc2e63561835f609469f6bc2205f058492c7155e073a1` | 542 |
| [.github/workflows/refresh.yml](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/.github/workflows/refresh.yml) | `bad0f715d9e5b2ffaa516578b505279e25b186eb0d5d292e539edcda6a92be1d` | 1517 |
| [bin/build-site.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/build-site.js) | `5ce29fb1d00a761cfddda983cc5b802511d1a287cd175c844187c9e104dcb84f` | 1276 |
| [bin/crawl.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/crawl.js) | `44d5ef0bc1f8cbae9c22a2db47745fbe525546c8678e4f10edf61706bf1ead7c` | 2208 |
| [bin/report.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/bin/report.js) | `f5d0123fa4ee0ca39de1924c3a57f1dbe69c991c058504affac91535f3869159` | 1573 |
| [render.yaml](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/render.yaml) | `a9b7e9c1b0fc114bb4b7986b5b5031154ff8a5f7ecf81953c0950da248df0ba9` | 1765 |
| [test.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/test.js) | `d6a1bfa5a6898f1514122a78f8e342c6b64532785ae90c06d7af617129ef5be9` | 19419 |
| [docs/adr/0001-vendored-engine.md](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/docs/adr/0001-vendored-engine.md) | `2149fa6590acde67d6f073e492cc06e76f3919aa8ad60dd807868175e1bc97eb` | 1220 |
| [api/.env.example](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/.env.example) | `1df5a8b8420f709a0b9bc01ebb5118fe4280931d08ce94aad941ec3940727089` | 739 |
| [api/data.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/data.js) | `65a55b238ae09c8b2da29e0ace270129a01ffd17e9e4ea9403c42385d683d9ca` | 630 |
| [api/keys.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/keys.js) | `4c6e6fa485bbdbec606dc66dda413b1ddc4b6e1065fbc0ed786bcee7f179ec44` | 2880 |
| [api/ratelimit.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/ratelimit.js) | `cbbd450a547658b6aad0a65d7c531875a889ea96f5f6fc627e6e55769ed3339d` | 673 |
| [api/server.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/server.js) | `f377b4bc1fdb91ad5e1aa4213aa215425ce94a1da1f2b1f9d5e736a3470ab596` | 9076 |
| [api/stripe.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/stripe.js) | `7583c66ef5e6ddade9c843cb24599a0311acb329eefe1d76ec54af9e631bd270` | 1131 |
| [api/tiers.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/tiers.js) | `24d023c8d109b9958126e8a12a6d7a3fb65a72caae16315ef35f84f5a0c4e6e8` | 890 |
| [engine/checks.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/engine/checks.js) | `3822c8e7d731cce22ef55f8e9f609564c966b11596c856c503fd1c5ec2da3f52` | 8332 |
| [engine/fetch.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/engine/fetch.js) | `a1b702b86c527948d6cc90ef6439c04a0c881c811d550ffc233a082ee783a0fb` | 4139 |
| [public/data.json](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/public/data.json) | `f18009487297bec9588c21051915f014ee9a11ef08ba4b7aa03672dec14e1f9d` | 13881 |
| [seeds/eaa-ecommerce.json](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/seeds/eaa-ecommerce.json) | `b5bd2b516c55191099d8dc216844dcfed6e069febf84cf00c199ecee18d4a17e` | 1313 |
| [seeds/eaa-ecommerce.sample.json](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/seeds/eaa-ecommerce.sample.json) | `206142925069afbb7f619d6ae337d5de0d89f70214c1d4cecb6b1066dbd95bae` | 441 |
| [src/crawl.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/crawl.js) | `e55a68e0bfe340d551e00e6db196f7477640d2f4ef5274b9f2f0fed71e4e2937` | 4428 |
| [src/fetch.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/fetch.js) | `e370d3258144c5c0ef4b57d39d77c77a9448a73d115ebda16760dffc8e3fb420` | 4374 |
| [src/firecrawl.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/firecrawl.js) | `cdedfcedcb1c99d45ce0990e5b0d08eb1fe3922991d8fed365968e9fbbee2063` | 2211 |
| [src/limit.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/limit.js) | `9d10a9b8d0d15526e31ef41b0c6bc77ef962d99101710e465e6a95bcb870e6ac` | 651 |
| [src/robots.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/robots.js) | `0ce989c6072fbd0fb812c10123220b7df99ba115ffc6d74eba0d0150a2ed81f3` | 3274 |
| [src/seo-pages.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/seo-pages.js) | `e45fd92dae67ead54a35c73fc38f4d2e53201ba9d03a6d5d65b3be832445f758` | 10905 |
| [src/site.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/site.js) | `2858343c8438c8eb0b30d813b2b7f523f95017a82f335ce39e7d7346ec9c45bd` | 60016 |
| [src/store.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/src/store.js) | `d42e4ab6f13c9e4159857b0d9f56d2b140649243f4fa773e9b3e581378f286a5` | 2363 |
| [api/test.js](https://github.com/NickCirv/cirv-accessibility-index/blob/068719ce5709f958d8ca2b9c9f022d15696fb4a8/api/test.js) | `cdfc0c6e202be0f06f8eeb9e67d55834ff3a93835a78acb092b58defbbfb920b` | 12121 |

## Extended capture

The final capture includes 105 eligible text files, including HTML. Application pages and generated site output are preserved as product implementation, not rewritten as repository documentation. The final portfolio quality report verifies every captured file hash.
