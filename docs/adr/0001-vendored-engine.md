# ADR-0001: Vendor the WCAG engine instead of cross-importing the scanner

**Status:** Accepted · **Date:** 2026-06-15 · **Author:** Nicholas

A public repo must be self-contained — it cannot `require()` a sibling repo
(the live `cirv-a11y-scanner`) that isn't part of it. So the WCAG check engine
(`checks.js`) and the SSRF-guarded fetch (`fetch.js`) are **vendored** into
`engine/` rather than imported across directories.

The trade-off accepted is **duplication / drift risk**: the same rules now live
in three places — `cirv-guard.php` (the canonical WordPress plugin), the public
scanner repo, and here. Mitigation: the canonical source is `cirv-guard.php`;
the vendored files carry a header pointing back to it; the rule set is small
(5 checks) and stable. If drift becomes painful, the next step is to extract the
engine into a published npm package (`@cirvgreen/wcag-engine`) consumed by all
three — the `engine/` boundary is kept clean so that swap is mechanical.

Rejected alternatives: (a) a git submodule of the scanner — fragile clones and
CI friction for a 300-line dependency; (b) folding the scanner into this
monorepo — would disturb the scanner's independent Render deploy for no benefit.
