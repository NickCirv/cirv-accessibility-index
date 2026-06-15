'use strict';

// Static directory generator. Reads the dataset and emits a self-promoting,
// SEO + AI-citation-friendly site: a ranked index, a per-site report page for
// every domain, a methodology page, a machine-readable data.json, sitemap +
// robots. Pure static HTML — no runtime deps, deployable to any static host.
//
// SECURITY: every dynamic value (domain, finding text, element snippets) comes
// from scanned THIRD-PARTY HTML and is untrusted. esc() runs on every
// interpolation to prevent injecting other sites' markup into ours.

const fs = require('fs');
const path = require('path');
const { latestScans } = require('./store');

const DEFAULT_BASE = 'https://index.cirvgreen.com'; // placeholder — see repo/domain ADR
const SCANNER_URL = 'https://cirv-a11y-scanner.onrender.com';
const GUARD_URL = 'https://wordpress.org/plugins/cirv-guard/';
const API_URL = 'https://cirv-index-api.onrender.com'; // override with --api-url

// ---- pure helpers (exported for tests) ----
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function grade(score) {
  if (score == null) return '—';
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function gradeClass(g) {
  return { A: 'g-a', B: 'g-b', C: 'g-c', D: 'g-d', F: 'g-f' }[g] || 'g-x';
}

function topIssue(resultsJson) {
  let results;
  try {
    results = JSON.parse(resultsJson || '[]');
  } catch {
    return null;
  }
  const counts = {};
  for (const r of results) {
    if (r && r.status === 'fail' && r.check) counts[r.check] = (counts[r.check] || 0) + 1;
  }
  let best = null;
  let n = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

function safeFile(domain) {
  return String(domain).toLowerCase().replace(/[^a-z0-9.-]/g, '_');
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toISOString().slice(0, 10);
}

// ---- shared layout ----
// Aesthetic: Swiss Minimal (Müller-Brockmann × Stripe × Linear). Hairline rules
// as architecture, one green accent as a coding signal, Inter Tight + tabular
// mono numerals, near-zero motion. WCAG AA throughout (we're an a11y index).
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">';
const CSS = `
:root{
  --paper:#fff;--paper-2:#fafafa;
  --ink:#14171a;--ink-2:#3f464c;--muted:#6b7280;
  --line:#e6e8ea;--line-2:#cfd3d6;--rule:#14171a;
  --accent:#1f7a4d;--accent-d:#155c39;--accent-wash:#f0f6f2;
  --radius:0;--radius-btn:3px;--ease:cubic-bezier(.23,1,.32,1);--maxw:1040px;
}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:'Inter Tight','Inter',sans-serif;letter-spacing:-.02em;line-height:1.06;color:var(--ink);font-weight:680;margin:0}
a{color:var(--accent-d);text-decoration:none}a:hover{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-999px}.skip:focus{left:8px;top:8px;background:var(--paper);padding:8px 12px;border:1px solid var(--ink);z-index:20}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
.num{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
header.site{border-bottom:1px solid var(--rule);position:sticky;top:0;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.1) blur(6px);z-index:10}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.brand{font-family:'Inter Tight',sans-serif;font-weight:700;letter-spacing:-.01em;color:var(--ink);font-size:1.06rem}
.brand b{color:var(--accent)}
nav.primary{display:flex;gap:24px}nav.primary a{color:var(--ink-2);font-size:.92rem;font-weight:500}nav.primary a:hover{color:var(--accent);text-decoration:none}
.hero{padding:72px 0 8px}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--accent-d);margin:0 0 18px}
.hero h1{font-size:clamp(2.4rem,5.2vw,4rem);margin:0 0 18px;max-width:17ch}
.lead{font-size:clamp(1.05rem,1.6vw,1.25rem);color:var(--ink-2);max-width:62ch;margin:0}
.stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule);margin:40px 0 8px}
.stat{padding:22px 20px;border-left:1px solid var(--line)}.stat:first-child{border-left:0}
.stat b{display:block;font-family:'Inter Tight',sans-serif;font-variant-numeric:tabular-nums;font-size:2.1rem;font-weight:700;line-height:1;letter-spacing:-.02em}
.stat span{display:block;margin-top:8px;font-size:.76rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.search{margin:30px 0 0;padding:11px 14px;border:1px solid var(--line-2);background:var(--paper);width:100%;max-width:360px;font-size:.95rem;font-family:inherit;border-radius:var(--radius)}
.search:focus{border-color:var(--accent);outline:none}
.tbl-wrap{margin-top:14px;border:1px solid var(--rule);overflow-x:auto}
table{width:100%;border-collapse:collapse}
thead th{text-align:left;padding:13px 16px;font-family:'JetBrains Mono',monospace;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--rule);font-weight:600;white-space:nowrap}
tbody td{padding:13px 16px;border-bottom:1px solid var(--line);font-size:.95rem;vertical-align:middle}
tbody tr:last-child td{border-bottom:0}tbody tr{transition:background .12s var(--ease)}tbody tr:hover{background:var(--paper-2)}
td.rank,td.score{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;color:var(--ink-2)}td.score{font-weight:600;color:var(--ink)}
.badge{display:inline-block;min-width:1.9em;text-align:center;padding:3px 7px;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:.8rem;color:#fff;border-radius:2px}
.g-a{background:#1f7a4d}.g-b{background:#3f7d42}.g-c{background:#8a6500}.g-d{background:#b4531a}.g-f{background:#c0392b}.g-x{background:#6b7280}
.report-hero{display:flex;align-items:flex-end;gap:32px;flex-wrap:wrap;padding:44px 0 28px;border-bottom:1px solid var(--line)}
.score-big{font-family:'Inter Tight',sans-serif;font-variant-numeric:tabular-nums;font-size:clamp(3.4rem,8vw,5rem);font-weight:700;line-height:.9;letter-spacing:-.03em}
.score-big small{font-size:1.05rem;color:var(--muted);font-weight:500}
main h2{font-size:1.5rem;margin:44px 0 6px;letter-spacing:-.02em}
.findings{list-style:none;padding:0;margin:18px 0}
.findings li{padding:14px 0;border-bottom:1px solid var(--line)}.findings li:last-child{border-bottom:0}
.lbl{font-weight:600}.fail .lbl{color:#b8341f}.pass .lbl{color:var(--accent-d)}
.wcag{font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--muted)}
.snippet{display:inline-block;margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:.8rem;background:var(--paper-2);border:1px solid var(--line);padding:2px 6px;color:var(--ink-2);word-break:break-all;border-radius:2px}
.cta{border:1px solid var(--rule);border-left:3px solid var(--accent);padding:24px 26px;margin:32px 0;background:var(--paper)}
.cta strong{font-family:'Inter Tight',sans-serif;font-size:1.05rem}
.btn{display:inline-block;background:var(--accent);color:#fff;padding:11px 20px;font-weight:600;font-size:.95rem;border:1px solid var(--accent);border-radius:var(--radius-btn);cursor:pointer;transition:background .14s var(--ease),transform .14s var(--ease);font-family:inherit}
.btn:hover{background:var(--accent-d);color:#fff;text-decoration:none}.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--accent-d)}.btn.ghost:hover{background:var(--accent-wash)}
.btn:disabled{opacity:.55;cursor:wait}
.tiers{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule);margin:32px 0}
.tier{padding:26px 22px;border-left:1px solid var(--line);display:flex;flex-direction:column}.tier:first-child{border-left:0}
.tier.feat{background:var(--accent-wash)}
.tier h3{font-size:1.05rem}
.tier .price{font-family:'Inter Tight',sans-serif;font-variant-numeric:tabular-nums;font-size:2rem;font-weight:700;letter-spacing:-.02em;margin:8px 0 2px}
.tier .price small{font-size:.8rem;color:var(--muted);font-weight:500}
.tier ul{list-style:none;padding:0;margin:14px 0 22px;font-size:.9rem;color:var(--ink-2);flex:1}
.tier li{padding:5px 0;border-bottom:1px solid var(--line)}.tier li:last-child{border-bottom:0}
.field{display:block;margin:12px 0}
.field label{display:block;font-size:.78rem;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.field input{width:100%;max-width:380px;padding:11px 14px;border:1px solid var(--line-2);font-size:.95rem;font-family:inherit;border-radius:var(--radius)}
.field input:focus{border-color:var(--accent);outline:none}
.keybox{margin-top:14px;padding:14px;border:1px solid var(--accent);background:var(--accent-wash);font-family:'JetBrains Mono',monospace;font-size:.85rem;word-break:break-all}
.msg{margin-top:10px;font-size:.9rem;min-height:1.2em}.msg.err{color:#b8341f}.msg.ok{color:var(--accent-d)}
.note{color:var(--muted);font-size:.88rem}
footer.site{border-top:1px solid var(--rule);margin-top:64px;padding:32px 0;color:var(--muted);font-size:.88rem}footer.site a{color:var(--ink-2)}
@media (max-width:760px){.stats,.tiers{grid-template-columns:1fr 1fr}.stat,.tier{border-left:0;border-top:1px solid var(--line)}.stats .stat:nth-child(-n+2),.tiers .tier:nth-child(-n+2){border-top:0}}
@media (max-width:480px){.stats{grid-template-columns:1fr}.stat{border-top:1px solid var(--line)}.stat:first-child{border-top:0}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

function layout({ title, description, canonical, jsonld, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
${FONTS}
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
<a class="brand" href="/">Cirv <b>Index</b></a>
<nav class="primary" aria-label="Primary"><a href="/">Index</a><a href="/pricing.html">Pricing &amp; API</a><a href="/methodology.html">Methodology</a><a href="${esc(SCANNER_URL)}">Free scanner</a></nav>
</div></header>
<main id="main"><div class="wrap">
${body}
</div></main>
<footer class="site"><div class="wrap">
Cirv Accessibility Index — an open WCAG/EAA compliance index for EU e-commerce. Automated homepage scans against WCAG 2.1 A/AA criteria. Not legal advice. Built by <a href="https://cirvgreen.com">Cirvgreen</a>.
</div></footer>
</body>
</html>`;
}

// ---- index page ----
function renderIndex(rows, opts = {}) {
  const base = opts.base || DEFAULT_BASE;
  const ok = rows.filter((r) => r.status === 'ok');
  const unscannable = rows.filter((r) => r.status !== 'ok');
  const avg = ok.length ? Math.round(ok.reduce((s, r) => s + r.score, 0) / ok.length) : 0;
  const updated = rows.reduce((m, r) => Math.max(m, r.scanned_at || 0), 0);

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const r of ok) gradeCounts[grade(r.score)]++;

  const mode = opts.mode === 'named' ? 'named' : 'soft';
  const tableRows = ok
    .map((r, i) => {
      const g = grade(r.score);
      const named = mode === 'named' || !(g === 'D' || g === 'F');
      const issue = topIssue(r.results_json);
      const store = named
        ? `<a href="/sites/${esc(safeFile(r.domain))}.html">${esc(r.domain)}</a>`
        : `<span class="note">🔒 hidden — <a href="${esc(SCANNER_URL)}">scan to reveal</a></span>`;
      return `<tr>
<td class="rank">${i + 1}</td>
<td>${store}</td>
<td class="score">${esc(r.score)}</td>
<td><span class="badge ${gradeClass(g)}">${esc(g)}</span></td>
<td>${named ? (issue ? esc(issue) : '<span class="note">none</span>') : '<span class="note">—</span>'}</td>
</tr>`;
    })
    .join('\n');

  const unscannableRows = unscannable
    .map(
      (r) => `<tr><td>${esc(r.domain)}</td><td><span class="note">${esc(
        r.status === 'skipped' ? 'robots.txt opt-out' : labelError(r.error_code)
      )}</span></td></tr>`
    )
    .join('\n');

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Cirv Accessibility Index — EU e-commerce',
    description:
      'Automated WCAG/EAA accessibility compliance scores for EU e-commerce homepages.',
    url: base + '/',
    dateModified: fmtDate(updated),
    creator: { '@type': 'Organization', name: 'Cirvgreen', url: 'https://cirvgreen.com' },
    measurementTechnique: 'WCAG 2.1 A/AA automated homepage analysis',
  };

  const body = `
<section class="hero">
<p class="eyebrow">Open data · WCAG 2.1 A/AA · EAA</p>
<h1>EU E-commerce Accessibility Index</h1>
<p class="lead">How accessible are Europe's online stores? We scan e-commerce homepages against WCAG 2.1 A/AA — the standard behind the <strong>European Accessibility Act (EAA)</strong> — and publish the scores openly.</p>
<div class="stats">
<div class="stat"><b>${ok.length}</b><span>stores scored</span></div>
<div class="stat"><b>${avg}</b><span>average score</span></div>
<div class="stat"><b>${gradeCounts.D + gradeCounts.F}</b><span>graded D or F</span></div>
<div class="stat"><b>${esc(fmtDate(updated))}</b><span>last updated</span></div>
</div>
</section>

<label class="skip" for="q">Filter stores</label>
<input class="search" id="q" type="search" placeholder="Filter stores by name…" aria-label="Filter stores by name">

<div class="tbl-wrap"><table id="board">
<thead><tr><th>#</th><th>Store</th><th>Score</th><th>Grade</th><th>Top issue</th></tr></thead>
<tbody>
${tableRows}
</tbody>
</table></div>

${
  unscannable.length
    ? `<h2>Couldn't scan</h2>
<p class="note">These returned a bot-protection wall, error, or opted out via robots.txt. We don't bypass bot protection — we report honestly.</p>
<div class="tbl-wrap"><table><thead><tr><th>Store</th><th>Reason</th></tr></thead><tbody>
${unscannableRows}
</tbody></table></div>`
    : ''
}

<div class="cta">
<strong>Run a live scan of any page</strong><br>
Check your own store in seconds with the free Cirv accessibility scanner.
<br><a class="btn" href="${esc(SCANNER_URL)}">Open the free scanner</a>
</div>

<p class="note">Scores reflect an automated homepage scan, not a full audit. See <a href="/methodology.html">methodology</a>. Not legal advice.</p>

<script>
(function(){var q=document.getElementById('q'),rows=[].slice.call(document.querySelectorAll('#board tbody tr'));
q.addEventListener('input',function(){var v=q.value.toLowerCase();rows.forEach(function(tr){tr.style.display=tr.textContent.toLowerCase().indexOf(v)>-1?'':'none';});});})();
</script>`;

  return layout({
    title: 'EU E-commerce Accessibility Index — WCAG & EAA compliance scores',
    description: `Open WCAG/EAA accessibility scores for ${ok.length} EU online stores. Average score ${avg}. Updated ${fmtDate(updated)}.`,
    canonical: base + '/',
    jsonld,
    body,
  });
}

function labelError(code) {
  const map = {
    blocked_401: 'bot-protected (401)',
    blocked_403: 'bot-protected (403)',
    rate_limited: 'rate limited',
    server_5xx: 'server error',
    timeout: 'timed out',
    not_html: 'no HTML page',
    network: 'unreachable',
    fetch: 'unreachable',
    dns: 'domain not found',
    redirects: 'too many redirects',
  };
  return map[code] || (code ? esc(code) : 'error');
}

// ---- per-site report ----
function renderSite(row, opts = {}) {
  const base = opts.base || DEFAULT_BASE;
  const g = grade(row.score);
  const url = base + '/sites/' + safeFile(row.domain) + '.html';
  let results = [];
  try {
    results = JSON.parse(row.results_json || '[]');
  } catch {
    results = [];
  }
  const fails = results.filter((r) => r && r.status === 'fail');
  const passes = results.filter((r) => r && r.status === 'pass');

  const failList = fails.length
    ? `<ul class="findings">${fails
        .map(
          (f) =>
            `<li class="fail"><strong>${esc(f.check)}</strong> — ${esc(f.message)} <span class="note">[${esc(
              f.wcag
            )}]</span>${f.element ? `<br><span class="snippet">${esc(f.element)}</span>` : ''}</li>`
        )
        .join('')}</ul>`
    : '<p>No automated failures detected on the homepage. 🎉</p>';

  const passList = passes.length
    ? `<ul class="findings">${passes
        .map((p) => `<li class="pass">${esc(p.check)} — ${esc(p.message)}</li>`)
        .join('')}</ul>`
    : '';

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Accessibility report for ${row.domain}`,
    url,
    dateModified: fmtDate(row.scanned_at),
    isPartOf: { '@type': 'Dataset', name: 'Cirv Accessibility Index', url: base + '/' },
    about: { '@type': 'WebSite', url: 'https://' + row.domain + '/' },
  };

  const body = `
<nav class="note" aria-label="Breadcrumb"><a href="/">Index</a> › ${esc(row.domain)}</nav>
<section class="report-hero">
<div><span class="badge ${gradeClass(g)}" style="font-size:1.4rem;padding:6px 14px">${esc(g)}</span></div>
<div><div class="score-big">${esc(row.score)}<span class="note" style="font-size:1rem">/100</span></div>
<div class="note">${esc(row.fails)} failed · ${esc(row.passes)} passed checks</div></div>
</section>

<h1>Is ${esc(row.domain)} accessible?</h1>
<p>Automated WCAG 2.1 A/AA homepage scan of <a href="https://${esc(row.domain)}/" rel="nofollow">${esc(
    row.domain
  )}</a>, last checked ${esc(fmtDate(row.scanned_at))}. This matters for <strong>European Accessibility Act (EAA)</strong> compliance.</p>

<h2>Issues found</h2>
${failList}

<div class="cta">
<strong>Selling into the EU? These issues are EAA exposure.</strong><br>
Fix them on WordPress with Cirv Guard, or re-scan any page live.
<br><a class="btn" href="${esc(GUARD_URL)}">Fix it with Cirv Guard</a>
&nbsp;<a href="${esc(SCANNER_URL)}">Re-scan live →</a>
</div>

${passList ? `<h2>Passing checks</h2>${passList}` : ''}

<p class="note">Automated homepage scan only — not a full WCAG audit and not legal advice. <a href="/methodology.html">How we score</a>.</p>`;

  return layout({
    title: `Is ${row.domain} accessible? — WCAG / EAA compliance report`,
    description: `${row.domain} scored ${row.score}/100 (grade ${g}) on an automated WCAG 2.1 homepage scan. ${row.fails} issues found. EAA compliance report.`,
    canonical: url,
    jsonld,
    body,
  });
}

function renderMethodology(opts = {}) {
  const base = opts.base || DEFAULT_BASE;
  const body = `
<section class="hero"><h1>Methodology</h1>
<p>How the Cirv Accessibility Index scores EU e-commerce stores.</p></section>
<h2>What we scan</h2>
<p>We fetch the public <strong>homepage</strong> of each store and analyse its HTML against a subset of WCAG 2.1 Level A/AA success criteria — the same standard underpinning the European Accessibility Act (EAA) and the ADA.</p>
<h2>The checks</h2>
<ul>
<li><strong>Alt text</strong> (WCAG 1.1.1) — images carry text alternatives.</li>
<li><strong>Heading hierarchy</strong> (1.3.1) — one H1, no skipped levels.</li>
<li><strong>Colour contrast</strong> (1.4.3) — inline text/background pairs meet 4.5:1.</li>
<li><strong>Form labels</strong> (1.3.1) — inputs have programmatic labels.</li>
<li><strong>Link text</strong> (2.4.4) — links are descriptive, not "click here".</li>
</ul>
<h2>The score</h2>
<p>The score is the share of checks that pass, expressed 0–100, then graded A–F. It's a fast signal, not a full audit — a high score means no <em>automated</em> failures on the homepage, not guaranteed conformance.</p>
<h2>What we don't do</h2>
<p>We respect <code>robots.txt</code>, rate-limit politely, identify ourselves honestly as <code>CirvA11yIndex</code>, and never bypass bot protection. Sites that block automated access are listed as "couldn't scan" rather than worked around.</p>
<h2>Limitations</h2>
<p>Automated tools catch roughly 30–40% of WCAG issues. Manual testing is required for full conformance. This index is informational and <strong>not legal advice</strong>.</p>
<p class="note"><a href="/">← Back to the index</a></p>`;
  return layout({
    title: 'Methodology — Cirv Accessibility Index',
    description: 'How the Cirv Accessibility Index scans and scores EU e-commerce accessibility against WCAG 2.1 A/AA.',
    canonical: base + '/methodology.html',
    jsonld: null,
    body,
  });
}

function renderPricing(opts = {}) {
  const base = opts.base || DEFAULT_BASE;
  const apiUrl = opts.apiUrl || API_URL;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Cirv Accessibility Index — API & pricing',
    url: base + '/pricing.html',
    isPartOf: { '@type': 'Dataset', name: 'Cirv Accessibility Index', url: base + '/' },
  };
  const body = `
<section class="hero">
<p class="eyebrow">Developer API</p>
<h1>Accessibility data, by API</h1>
<p class="lead">Programmatic access to the full, named EU e-commerce accessibility dataset — scores, grades, and per-site WCAG findings. Start free in seconds; upgrade when you need volume.</p>
</section>

<div id="getkey-form" class="cta">
<strong>Start free</strong>
<p class="note">100 requests/day, no card required. Your key is shown once — copy it.</p>
<div class="field"><label for="email">Email</label><input id="email" type="email" placeholder="you@company.com" autocomplete="email"></div>
<button class="btn" id="getkey" type="button">Get a free key</button>
<div id="msg" class="msg" role="status" aria-live="polite"></div>
<div id="keybox" class="keybox" style="display:none" aria-live="polite"></div>
</div>

<h2>Plans</h2>
<div class="tiers">
<div class="tier">
<h3>Free</h3><div class="price num">$0</div>
<ul><li>100 requests / day</li><li>Scores &amp; grades</li><li>Per-site findings</li><li>Community support</li></ul>
<a class="btn ghost" href="#getkey-form">Get free key</a>
</div>
<div class="tier">
<h3>Starter</h3><div class="price num">$29<small>/mo</small></div>
<ul><li>5,000 requests / day</li><li>Full named dataset</li><li>Per-site findings</li><li>Email support</li></ul>
<button class="btn" type="button" data-tier="starter">Subscribe</button>
</div>
<div class="tier feat">
<h3>Pro</h3><div class="price num">$99<small>/mo</small></div>
<ul><li>50,000 requests / day</li><li>Everything in Starter</li><li>History &amp; trends</li><li>Priority support</li></ul>
<button class="btn" type="button" data-tier="pro">Subscribe</button>
</div>
<div class="tier">
<h3>Bulk</h3><div class="price num">$299<small>/mo</small></div>
<ul><li>500,000 requests / day</li><li>Everything in Pro</li><li>Bulk export</li><li>SLA on request</li></ul>
<button class="btn" type="button" data-tier="bulk">Subscribe</button>
</div>
</div>

<h2>Endpoints</h2>
<div class="tbl-wrap"><table>
<thead><tr><th>Method</th><th>Path</th><th>Returns</th></tr></thead>
<tbody>
<tr><td class="rank">GET</td><td><span class="snippet">/v1/sites</span></td><td>Ranked scores</td></tr>
<tr><td class="rank">GET</td><td><span class="snippet">/v1/sites/:domain</span></td><td>Full report + findings</td></tr>
<tr><td class="rank">GET</td><td><span class="snippet">/v1/usage</span></td><td>Your tier + limit</td></tr>
</tbody>
</table></div>
<p class="note">Authenticate with <span class="snippet">Authorization: Bearer &lt;key&gt;</span>. Keys are stored hashed; payments run through Stripe. Full docs: <a href="https://github.com/NickCirv/cirv-accessibility-index#-api">README</a>.</p>

<script>
(function(){
var API=${JSON.stringify(apiUrl)};
var email=document.getElementById('email'),msg=document.getElementById('msg'),keybox=document.getElementById('keybox');
function setMsg(t,err){msg.textContent=t;msg.className='msg'+(err?' err':' ok');}
function emailOK(v){return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v);}
function offline(){setMsg('Could not reach the API — it may be waking up. Try again in ~30s.',true);}
document.getElementById('getkey').addEventListener('click',function(){
  var e=email.value.trim();
  if(!emailOK(e)){setMsg('Enter a valid email.',true);return;}
  setMsg('Creating your key…');
  fetch(API+'/v1/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:e})})
    .then(function(r){return r.json();})
    .then(function(j){if(j.api_key){keybox.textContent=j.api_key;keybox.style.display='block';setMsg('Key created — copy it now, it is shown only once.');}else{setMsg(j.message||'A key already exists for that email.',false);}})
    .catch(offline);
});
[].forEach.call(document.querySelectorAll('[data-tier]'),function(btn){
  btn.addEventListener('click',function(){
    var e=email.value.trim();
    if(!emailOK(e)){setMsg('Enter your email above first.',true);email.focus();return;}
    btn.disabled=true;setMsg('Opening secure checkout…');
    fetch(API+'/v1/billing/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tier:btn.getAttribute('data-tier'),email:e})})
      .then(function(r){return r.json();})
      .then(function(j){if(j.url){window.location.href=j.url;}else{setMsg(j.error||'Checkout unavailable.',true);btn.disabled=false;}})
      .catch(function(){offline();btn.disabled=false;});
  });
});
})();
</script>`;
  return layout({
    title: 'API & Pricing — Cirv Accessibility Index',
    description: 'Programmatic access to the EU e-commerce accessibility dataset. Free tier + Starter/Pro/Bulk plans. Scores, grades, and WCAG findings by API.',
    canonical: base + '/pricing.html',
    jsonld,
    body,
  });
}

function renderSitemap(rows, base) {
  const urls = [base + '/', base + '/pricing.html', base + '/methodology.html'].concat(
    rows.map((r) => base + '/sites/' + safeFile(r.domain) + '.html')
  );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `<url><loc>${esc(u)}</loc></url>`).join('\n') +
    '\n</urlset>\n'
  );
}

function publicRow(r, mode) {
  const g = grade(r.score);
  const hidden = mode !== 'named' && r.status === 'ok' && (g === 'D' || g === 'F');
  return {
    domain: hidden ? null : r.domain,
    hidden: hidden || undefined,
    status: r.status,
    score: r.score,
    grade: g,
    fails: r.fails,
    passes: r.passes,
    top_issue: hidden ? null : topIssue(r.results_json),
    error_code: r.error_code || null,
    scanned_at: r.scanned_at,
  };
}

// ---- orchestrator ----
// mode: 'named' publishes every scored store; 'soft' (default) names only A–C and
// hides D/F behind a "scan to reveal" CTA — the reputational safety toggle, set
// at deploy via the MODE env var, no code change.
function buildSite(db, outDir, opts = {}) {
  const base = opts.base || DEFAULT_BASE;
  const mode = opts.mode === 'named' ? 'named' : 'soft';
  const rows = latestScans(db);
  const ok = rows.filter((r) => r.status === 'ok');
  const eligible = ok.filter((r) => mode === 'named' || !['D', 'F'].includes(grade(r.score)));

  fs.mkdirSync(path.join(outDir, 'sites'), { recursive: true });
  const apiUrl = opts.apiUrl || API_URL;
  fs.writeFileSync(path.join(outDir, 'index.html'), renderIndex(rows, { base, mode }));
  fs.writeFileSync(path.join(outDir, 'pricing.html'), renderPricing({ base, apiUrl }));
  fs.writeFileSync(path.join(outDir, 'methodology.html'), renderMethodology({ base }));
  for (const r of eligible) {
    fs.writeFileSync(path.join(outDir, 'sites', safeFile(r.domain) + '.html'), renderSite(r, { base }));
  }
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), renderSitemap(eligible, base));
  fs.writeFileSync(
    path.join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
  );
  fs.writeFileSync(
    path.join(outDir, 'data.json'),
    JSON.stringify({ updated: fmtDate(rows.reduce((m, r) => Math.max(m, r.scanned_at || 0), 0)), mode, count: ok.length, sites: rows.map((r) => publicRow(r, mode)) }, null, 2)
  );

  return { outDir, pages: 2 + eligible.length, scored: ok.length, named: eligible.length, total: rows.length, mode };
}

module.exports = { buildSite, renderIndex, renderSite, renderMethodology, renderPricing, esc, grade, topIssue, safeFile };
