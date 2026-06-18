'use strict';

// Programmatic SEO surface, generated from the same dataset:
//   - per-country hubs   /country/<slug>.html   (targets "<country> ecommerce accessibility")
//   - countries index    /countries.html
//   - best-in-class list  /best.html            (named A/B only — backlink bait, no name-and-shame)
//
// Country is derived from the domain TLD (the seed is flat domains, no metadata).
// Helpers (layout, esc, grade, …) are INJECTED from site.js to avoid a circular
// import and keep this unit independently testable. Soft mode still hides D/F
// store names — these pages reuse that convention via nameOrHidden().

const COUNTRY_BY_TLD = {
  de: 'Germany', fr: 'France', nl: 'Netherlands', it: 'Italy', es: 'Spain',
  se: 'Sweden', pl: 'Poland', be: 'Belgium', at: 'Austria', dk: 'Denmark',
  fi: 'Finland', pt: 'Portugal', ie: 'Ireland', cz: 'Czechia', gr: 'Greece',
  ro: 'Romania', hu: 'Hungary', sk: 'Slovakia', si: 'Slovenia', no: 'Norway',
};
const MIN_STORES_FOR_HUB = 2; // avoid thin one-store pages

function countryOf(domain) {
  const d = String(domain).toLowerCase();
  if (/\.co\.uk$/.test(d)) return 'United Kingdom';
  const tld = d.split('.').pop();
  return COUNTRY_BY_TLD[tld] || 'International';
}

function countrySlug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// → [{ country, slug, rows: [scored rows desc by score], avg, dfPct }] for countries
// with >= MIN_STORES_FOR_HUB scored stores, sorted by store count desc.
function groupByCountry(okRows) {
  const map = new Map();
  for (const r of okRows) {
    const c = countryOf(r.domain);
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(r);
  }
  const groups = [];
  for (const [country, rows] of map) {
    if (rows.length < MIN_STORES_FOR_HUB) continue;
    rows.sort((a, b) => (b.score || 0) - (a.score || 0));
    const avg = Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length);
    groups.push({ country, slug: countrySlug(country), rows, avg, total: rows.length });
  }
  groups.sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));
  return groups;
}

// Reusable: link a store, or hide D/F names in soft mode (matches report/index).
function nameLink(r, mode, h) {
  const g = h.grade(r.score);
  const named = mode === 'named' || !(g === 'D' || g === 'F');
  return named
    ? `<a href="/sites/${h.esc(h.safeFile(r.domain))}.html">${h.esc(r.domain)}</a>`
    : '<span class="note">hidden — run a scan</span>';
}

function scoreTable(rows, mode, h) {
  const body = rows
    .map((r, i) => {
      const g = h.grade(r.score);
      return `<tr><td class="rank num">${i + 1}</td><td><span class="badge ${h.gradeClass(g)}">${h.esc(g)}</span></td><td>${nameLink(r, mode, h)}</td><td class="score num">${h.esc(r.score)}/100</td></tr>`;
    })
    .join('');
  return `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Grade</th><th>Store</th><th>Score</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderCountryHub(group, opts) {
  const { base, mode, h } = opts;
  const { country, slug, rows, avg, total } = group;
  const df = rows.filter((r) => ['D', 'F'].includes(h.grade(r.score))).length;
  const dfPct = total ? Math.round((df / total) * 100) : 0;
  const canonical = base + '/country/' + slug + '.html';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Web accessibility of ${country} e-commerce homepages`,
    description: `WCAG 2.1 A/AA homepage scores for ${total} online stores in ${country}, under the European Accessibility Act.`,
    url: canonical,
    creator: { '@type': 'Organization', name: 'Cirvgreen', url: 'https://cirvgreen.com' },
  };
  const body = `
<section class="hero">
<p class="eyebrow">Country · ${h.esc(country)}</p>
<h1>Web accessibility of ${h.esc(country)} online stores</h1>
<p class="lead">We scanned ${h.esc(total)} e-commerce homepages based in ${h.esc(country)} against WCAG 2.1 A/AA — the standard behind the European Accessibility Act (EAA). Here's how they rank.</p>
</section>
<div class="stats">
<div class="stat"><b>${h.esc(total)}</b><span>stores in ${h.esc(country)}</span></div>
<div class="stat"><b>${h.esc(avg)}<span class="note" style="font-size:1rem">/100</span></b><span>average score</span></div>
<div class="stat"><b>${h.esc(dfPct)}%</b><span>graded D or F</span></div>
<div class="stat"><b>WCAG</b><span>2.1 A / AA</span></div>
</div>
<h2>${h.esc(country)} store ranking</h2>
${scoreTable(rows, mode, h)}
<div class="cta">
<strong>Is your ${h.esc(country)} store on this list — or should it be?</strong><br>
Run the free homepage scanner, or pull the full dataset via the API.
<br><a class="btn" href="${h.esc(h.SCANNER_URL)}">Open the free scanner</a> &nbsp;<a href="/pricing.html">Get API access →</a>
</div>
<p class="note">See also: <a href="/countries.html">all countries</a> · <a href="/report.html">the EU-wide report</a> · <a href="/methodology.html">methodology</a>. Automated WCAG 2.1 A/AA homepage scan; not legal advice.</p>`;
  return h.layout({
    title: `Web Accessibility in ${country} — ${total} E-commerce Stores Audited (EAA/WCAG)`,
    description: `${total} ${country} online stores scored against WCAG 2.1 A/AA: average ${avg}/100, ${dfPct}% graded D or F. European Accessibility Act readiness, ranked.`,
    canonical,
    jsonld,
    body,
  });
}

function renderCountriesIndex(groups, opts) {
  const { base, h } = opts;
  const canonical = base + '/countries.html';
  const rowsHtml = groups
    .map(
      (g) =>
        `<tr><td><a href="/country/${h.esc(g.slug)}.html">${h.esc(g.country)}</a></td><td class="num">${h.esc(g.total)}</td><td class="score num">${h.esc(g.avg)}/100</td></tr>`
    )
    .join('');
  const body = `
<section class="hero">
<p class="eyebrow">Index · By country</p>
<h1>EU e-commerce accessibility, by country</h1>
<p class="lead">European Accessibility Act readiness varies sharply by market. Pick a country to see how its online stores score against WCAG 2.1 A/AA.</p>
</section>
<h2>Countries</h2>
<div class="tbl-wrap"><table><thead><tr><th>Country</th><th>Stores</th><th>Avg score</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
<p class="note">See also: <a href="/">the full index</a> · <a href="/report.html">EU-wide report</a> · <a href="/best.html">best-scoring stores</a>.</p>`;
  return h.layout({
    title: 'Web Accessibility by Country — EU E-commerce (EAA Index)',
    description: 'Browse WCAG 2.1 A/AA accessibility scores for EU e-commerce by country — Germany, France, Netherlands and more. European Accessibility Act readiness.',
    canonical,
    jsonld: null,
    body,
  });
}

function renderBestList(okRows, opts) {
  const { base, h } = opts;
  const canonical = base + '/best.html';
  const best = okRows
    .filter((r) => ['A', 'B'].includes(h.grade(r.score)))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 25);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Best EU e-commerce stores for web accessibility',
    itemListElement: best.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.domain })),
  };
  const rowsHtml = best
    .map(
      (r, i) =>
        `<tr><td class="rank num">${i + 1}</td><td><span class="badge ${h.gradeClass(h.grade(r.score))}">${h.esc(h.grade(r.score))}</span></td><td><a href="/sites/${h.esc(h.safeFile(r.domain))}.html">${h.esc(r.domain)}</a> <span class="note">(${h.esc(countryOf(r.domain))})</span></td><td class="score num">${h.esc(r.score)}/100</td></tr>`
    )
    .join('');
  const body = `
<section class="hero">
<p class="eyebrow">Ranking · Best in class</p>
<h1>The best EU online stores for web accessibility</h1>
<p class="lead">These ${h.esc(best.length)} European e-commerce homepages score highest on an automated WCAG 2.1 A/AA check — the standard behind the European Accessibility Act. Proof that accessible commerce is achievable.</p>
</section>
<h2>Top ${h.esc(best.length)} (grade A–B)</h2>
${best.length ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Grade</th><th>Store</th><th>Score</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>` : '<p class="note">No A/B-grade stores in the current dataset.</p>'}
<div class="cta">
<strong>Want your store on this list?</strong><br>
Run the free homepage scanner to see where you stand.
<br><a class="btn" href="${h.esc(h.SCANNER_URL)}">Open the free scanner</a> &nbsp;<a href="/countries.html">Browse by country →</a>
</div>
<p class="note">Automated WCAG 2.1 A/AA homepage scan (~30–40% of issues); a high score still warrants a manual audit. <a href="/methodology.html">Methodology</a>.</p>`;
  return h.layout({
    title: 'Best EU Online Stores for Web Accessibility (WCAG-Audited) — Cirv Index',
    description: `The ${best.length} highest-scoring EU e-commerce homepages on an automated WCAG 2.1 A/AA accessibility check. European Accessibility Act readiness, ranked.`,
    canonical,
    jsonld,
    body,
  });
}

module.exports = { countryOf, countrySlug, groupByCountry, renderCountryHub, renderCountriesIndex, renderBestList };
