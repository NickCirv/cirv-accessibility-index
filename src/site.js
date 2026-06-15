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
const CSS = `
:root{--ink:#0f1b15;--muted:#5b6b62;--line:#e3eae5;--bg:#f7faf8;--card:#fff;--accent:#1f7a4d;--accent-d:#155c39}
*{box-sizing:border-box}body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
.skip{position:absolute;left:-999px}.skip:focus{left:8px;top:8px;background:#fff;padding:8px;z-index:10}
a{color:var(--accent-d)}a:hover{color:var(--accent)}
.wrap{max-width:960px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:var(--card)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;padding:16px 20px}
.brand{font-weight:700;color:var(--ink);text-decoration:none;font-size:1.05rem}
.brand span{color:var(--accent)}
nav a{margin-left:18px;text-decoration:none;font-size:.95rem}
.hero{padding:48px 0 24px}.hero h1{font-size:2rem;line-height:1.2;margin:0 0 12px}
.hero p{color:var(--muted);font-size:1.1rem;max-width:60ch;margin:0 0 8px}
.stats{display:flex;flex-wrap:wrap;gap:14px;margin:24px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;min-width:120px}
.stat b{display:block;font-size:1.5rem}.stat span{color:var(--muted);font-size:.85rem}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);font-size:.95rem}
th{background:#eef4f0;font-size:.8rem;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
tr:last-child td{border-bottom:0}
.badge{display:inline-block;min-width:2.2em;text-align:center;padding:2px 8px;border-radius:6px;font-weight:700;color:#fff}
.g-a{background:#1f7a4d}.g-b{background:#4f9d52}.g-c{background:#c79a1e}.g-d{background:#d4762a}.g-f{background:#c0392b}.g-x{background:#9aa6a0}
.search{margin:18px 0;padding:10px 14px;border:1px solid var(--line);border-radius:10px;width:100%;max-width:340px;font-size:1rem}
.report-hero{display:flex;align-items:center;gap:24px;flex-wrap:wrap;padding:32px 0}
.score-big{font-size:3.4rem;font-weight:800;line-height:1}
.findings li{margin:8px 0}.fail{color:#b03a2e}.pass{color:var(--accent-d)}
.snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;background:#f0f4f1;padding:1px 5px;border-radius:4px;color:#3a4a42;word-break:break-all}
.cta{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:20px;margin:28px 0}
.cta a.btn{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;margin-top:8px}
.note{color:var(--muted);font-size:.9rem}
footer.site{border-top:1px solid var(--line);margin-top:48px;padding:28px 0;color:var(--muted);font-size:.9rem;background:var(--card)}
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
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
<a class="brand" href="/">Cirv <span>Accessibility Index</span></a>
<nav aria-label="Primary"><a href="/">Index</a><a href="/methodology.html">Methodology</a><a href="${esc(SCANNER_URL)}">Free scanner</a></nav>
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
<td>${i + 1}</td>
<td>${store}</td>
<td>${esc(r.score)}</td>
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
<h1>EU E-commerce Accessibility Index</h1>
<p>How accessible are Europe's online stores? We scan e-commerce homepages against WCAG 2.1 A/AA — the standard behind the <strong>European Accessibility Act (EAA)</strong> — and publish the scores openly.</p>
<div class="stats">
<div class="stat"><b>${ok.length}</b><span>stores scored</span></div>
<div class="stat"><b>${avg}</b><span>average score</span></div>
<div class="stat"><b>${gradeCounts.D + gradeCounts.F}</b><span>graded D or F</span></div>
<div class="stat"><b>${esc(fmtDate(updated))}</b><span>last updated</span></div>
</div>
</section>

<label class="skip" for="q">Filter stores</label>
<input class="search" id="q" type="search" placeholder="Filter stores by name…" aria-label="Filter stores by name">

<table id="board">
<thead><tr><th>#</th><th>Store</th><th>Score</th><th>Grade</th><th>Top issue</th></tr></thead>
<tbody>
${tableRows}
</tbody>
</table>

${
  unscannable.length
    ? `<h2>Couldn't scan</h2>
<p class="note">These returned a bot-protection wall, error, or opted out via robots.txt. We don't bypass bot protection — we report honestly.</p>
<table><thead><tr><th>Store</th><th>Reason</th></tr></thead><tbody>
${unscannableRows}
</tbody></table>`
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

function renderSitemap(rows, base) {
  const urls = [base + '/', base + '/methodology.html'].concat(
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
  fs.writeFileSync(path.join(outDir, 'index.html'), renderIndex(rows, { base, mode }));
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

module.exports = { buildSite, renderIndex, renderSite, renderMethodology, esc, grade, topIssue, safeFile };
