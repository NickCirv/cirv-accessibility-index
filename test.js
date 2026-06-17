'use strict';

// No-framework tests — mirrors the scanner's style. Run: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSite, renderSite, renderPricing, renderReport, renderAnalytics, esc, grade, topIssue } = require('./src/site');
const { pLimit } = require('./src/limit');
const { parseRobots, matchRule } = require('./src/robots');
const { openStore, recordScan, latestScans, countScans } = require('./src/store');
const { crawl, scanOne, normalizeDomain } = require('./src/crawl');
const { fetchHtml } = require('./src/fetch');
const { ScanError } = require('./engine/fetch');

// Queue-based fake HTTP client: each .get() returns the next response (or throws
// if it's an Error). Last entry repeats. Lets us test fetch logic with no network.
function fakeClient(responses) {
  let i = 0;
  return {
    calls: 0,
    get() {
      this.calls++;
      const r = responses[Math.min(i, responses.length - 1)];
      i++;
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  };
}
const html200 = { status: 200, headers: { 'content-type': 'text/html' }, data: '<html><h1>x</h1></html>' };
const identitySafe = async (u) => u;

let pass = 0,
  fail = 0;
const t = (name, fn) => {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.then(() => { console.log(`  ok  ${name}`); pass++; }, (e) => { console.error(`  FAIL ${name}\n       ${e.message}`); fail++; });
    console.log(`  ok  ${name}`);
    pass++;
  } catch (e) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    fail++;
  }
};

async function run() {
  // ---- concurrency limiter ----
  await t('pLimit caps simultaneous tasks', async () => {
    const limit = pLimit(2);
    let active = 0,
      maxActive = 0;
    const mk = () =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
      });
    await Promise.all([mk(), mk(), mk(), mk(), mk()]);
    assert.strictEqual(maxActive, 2, `maxActive=${maxActive}`);
  });

  // ---- domain normalisation ----
  t('normalizeDomain strips scheme/www/path', () =>
    assert.strictEqual(normalizeDomain('https://www.Foo.com/bar?x=1'), 'foo.com'));

  // ---- robots parsing ----
  t('robots: disallow blocks matching path', () => {
    const r = parseRobots('User-agent: *\nDisallow: /private');
    assert.strictEqual(r.allowed('/private/x'), false);
    assert.strictEqual(r.allowed('/public'), true);
  });
  t('robots: empty disallow allows all', () => {
    const r = parseRobots('User-agent: *\nDisallow:');
    assert.strictEqual(r.allowed('/anything'), true);
  });
  t('robots: longest match wins (allow overrides disallow)', () => {
    const r = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/b');
    assert.strictEqual(r.allowed('/a/b/c'), true);
    assert.strictEqual(r.allowed('/a/x'), false);
  });
  t('robots: our UA group beats wildcard', () => {
    const r = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: CirvA11yScanner\nDisallow:');
    assert.strictEqual(r.allowed('/'), true);
  });
  t('robots: no file means allow', () => {
    assert.strictEqual(parseRobots('').allowed('/'), true);
  });
  t('matchRule honours $ anchor', () => {
    assert.strictEqual(matchRule('/x$', '/x'), true);
    assert.strictEqual(matchRule('/x$', '/x/y'), false);
  });

  // ---- store ----
  t('store records and reads latest per domain', () => {
    const db = openStore(':memory:');
    recordScan(db, { domain: 'a.com', status: 'ok', score: 50, passes: 5, fails: 5, total: 10, results: [{ x: 1 }], scanned_at: 100 });
    recordScan(db, { domain: 'a.com', status: 'ok', score: 80, passes: 8, fails: 2, total: 10, results: [{ x: 2 }], scanned_at: 200 });
    recordScan(db, { domain: 'b.com', status: 'error', error_code: 'fetch', scanned_at: 150 });
    assert.strictEqual(countScans(db), 3);
    const latest = latestScans(db);
    const a = latest.find((r) => r.domain === 'a.com');
    assert.strictEqual(a.score, 80, 'latest a.com score should be 80');
    assert.strictEqual(latest[0].domain, 'a.com', 'best score ordered first');
    const b = latest.find((r) => r.domain === 'b.com');
    assert.strictEqual(b.status, 'error');
    db.close();
  });

  // ---- robust fetch (P1.5) ----
  await t('fetch: 200 html returns finalUrl', async () => {
    const client = fakeClient([html200]);
    const r = await fetchHtml('https://shop.com/', { client, assertSafeUrl: identitySafe });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.finalUrl, 'https://shop.com/');
  });
  await t('fetch: 403 maps to blocked_403 (not retried)', async () => {
    const client = fakeClient([{ status: 403, headers: {} }]);
    try {
      await fetchHtml('https://shop.com/', { client, assertSafeUrl: identitySafe, retries: 2, backoffMs: 0 });
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'blocked_403');
      assert.strictEqual(client.calls, 1, '403 must not retry');
    }
  });
  await t('fetch: follows redirect then succeeds', async () => {
    const client = fakeClient([
      { status: 301, headers: { location: 'https://shop.com/home' } },
      html200,
    ]);
    const r = await fetchHtml('https://shop.com/', { client, assertSafeUrl: identitySafe });
    assert.strictEqual(r.finalUrl, 'https://shop.com/home');
    assert.strictEqual(client.calls, 2);
  });
  await t('fetch: non-html maps to not_html', async () => {
    const client = fakeClient([{ status: 200, headers: { 'content-type': 'application/json' }, data: '{}' }]);
    try {
      await fetchHtml('https://shop.com/', { client, assertSafeUrl: identitySafe });
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'not_html');
    }
  });
  await t('fetch: retries transient 5xx then succeeds', async () => {
    const client = fakeClient([{ status: 503, headers: {} }, html200]);
    const r = await fetchHtml('https://shop.com/', { client, assertSafeUrl: identitySafe, retries: 2, backoffMs: 0 });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(client.calls, 2, 'one retry after 5xx');
  });

  // ---- scanOne with injected fakes (no network) ----
  const fakeOk = {
    fetchRobots: async () => ({ allowed: () => true }),
    fetchHtml: async () => ({ html: '<x>', finalUrl: 'https://shop.com/' }),
    scan: () => ({ score: 72, passes: 7, fails: 3, total: 10, results: [{ check: 'Alt Text', status: 'fail' }] }),
  };
  await t('scanOne ok path returns score + results', async () => {
    const row = await scanOne('shop.com', { deps: fakeOk, now: 1 });
    assert.strictEqual(row.status, 'ok');
    assert.strictEqual(row.score, 72);
    assert.strictEqual(row.final_url, 'https://shop.com/');
  });
  await t('scanOne respects robots disallow', async () => {
    const deps = { ...fakeOk, fetchRobots: async () => ({ allowed: () => false }) };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'skipped');
    assert.strictEqual(row.error_code, 'robots_disallow');
  });
  await t('scanOne captures fetch errors', async () => {
    const deps = { ...fakeOk, fetchHtml: async () => { const e = new Error('boom'); e.code = 'fetch'; throw e; } };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'error');
    assert.strictEqual(row.error_code, 'fetch');
  });

  // ---- Firecrawl fallback (bot-management blocks) ----
  const blocked = { ...fakeOk, fetchHtml: async () => { throw new ScanError('Access blocked.', 'blocked_403'); } };
  await t('scanOne recovers a blocked_403 via Firecrawl fallback', async () => {
    const deps = { ...blocked, fetchViaFirecrawl: async () => ({ html: '<x>', finalUrl: 'https://shop.com/' }) };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'ok');
    assert.strictEqual(row.via, 'firecrawl');
    assert.strictEqual(row.score, 72);
  });
  await t('scanOne keeps the original error when Firecrawl also fails', async () => {
    const deps = { ...blocked, fetchViaFirecrawl: async () => { throw new ScanError('fc down', 'firecrawl_network'); } };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'error');
    assert.strictEqual(row.error_code, 'blocked_403'); // true reason, not the fallback's
  });
  await t('scanOne does NOT use Firecrawl for non-recoverable codes (http_404)', async () => {
    let called = false;
    const deps = {
      ...fakeOk,
      fetchHtml: async () => { throw new ScanError('gone', 'http_404'); },
      fetchViaFirecrawl: async () => { called = true; return { html: '<x>', finalUrl: 'x' }; },
    };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'error');
    assert.strictEqual(row.error_code, 'http_404');
    assert.strictEqual(called, false);
  });
  await t('scanOne skips Firecrawl when firecrawl:false even if a fetcher exists', async () => {
    const deps = { ...blocked, fetchViaFirecrawl: async () => ({ html: '<x>', finalUrl: 'x' }) };
    const row = await scanOne('shop.com', { deps, now: 1, firecrawl: false });
    assert.strictEqual(row.status, 'error');
    assert.strictEqual(row.error_code, 'blocked_403');
  });

  // ---- crawl end-to-end with fakes ----
  await t('crawl scans, dedups, and stores every domain', async () => {
    const db = openStore(':memory:');
    const rows = await crawl(db, ['a.com', 'www.a.com', 'https://b.com/x'], {
      concurrency: 2,
      delayMs: 0,
      deps: fakeOk,
    });
    assert.strictEqual(rows.length, 2, 'deduped to 2 domains');
    assert.strictEqual(countScans(db), 2, 'one row stored per domain');
    assert(latestScans(db).every((r) => r.status === 'ok'));
    db.close();
  });

  // ---- directory generator (P2) ----
  t('esc neutralises HTML', () =>
    assert.strictEqual(esc('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;'));
  t('grade boundaries', () => {
    assert.strictEqual(grade(90), 'A');
    assert.strictEqual(grade(89), 'B');
    assert.strictEqual(grade(60), 'C');
    assert.strictEqual(grade(40), 'D');
    assert.strictEqual(grade(39), 'F');
    assert.strictEqual(grade(null), '—');
  });
  t('topIssue picks most common failing check', () => {
    const j = JSON.stringify([
      { status: 'fail', check: 'Alt Text' },
      { status: 'fail', check: 'Alt Text' },
      { status: 'fail', check: 'Link Text' },
      { status: 'pass', check: 'Headings' },
    ]);
    assert.strictEqual(topIssue(j), 'Alt Text');
  });
  t('renderSite escapes untrusted finding markup (no stored XSS)', () => {
    const row = {
      domain: 'evil.com',
      score: 50,
      fails: 1,
      passes: 1,
      scanned_at: 1,
      status: 'ok',
      results_json: JSON.stringify([
        { status: 'fail', check: 'Alt Text', wcag: 'A (1.1.1)', message: 'bad', element: '<img src=x onerror=alert(1)><script>evil()</script>' },
      ]),
    };
    const html = renderSite(row);
    assert(!html.includes('<script>evil()'), 'raw script must not appear');
    assert(html.includes('&lt;script&gt;'), 'payload must be escaped');
  });
  await t('buildSite writes a full site + valid data.json', async () => {
    const db = openStore(':memory:');
    recordScan(db, { domain: 'good.com', status: 'ok', score: 80, passes: 8, fails: 2, total: 10, results: [{ status: 'fail', check: 'Alt Text', wcag: 'A', message: 'm', element: '' }], scanned_at: 1000 });
    recordScan(db, { domain: 'blocked.com', status: 'error', error_code: 'blocked_403', scanned_at: 1000 });
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cirv-site-'));
    const res = buildSite(db, out);
    assert.strictEqual(res.scored, 1);
    assert(fs.existsSync(path.join(out, 'index.html')));
    assert(fs.existsSync(path.join(out, 'sites', 'good.com.html')));
    assert(fs.existsSync(path.join(out, 'methodology.html')));
    assert(fs.existsSync(path.join(out, 'pricing.html')));
    assert(fs.existsSync(path.join(out, 'report.html')));
    assert(fs.existsSync(path.join(out, 'sitemap.xml')));
    assert(fs.existsSync(path.join(out, 'robots.txt')));
    const data = JSON.parse(fs.readFileSync(path.join(out, 'data.json'), 'utf-8'));
    assert.strictEqual(data.count, 1);
    assert(data.sites.some((s) => s.domain === 'blocked.com' && s.status === 'error'));
    const idx = fs.readFileSync(path.join(out, 'index.html'), 'utf-8');
    assert(idx.includes('blocked.com') && idx.includes('bot-protected'), 'index shows unscannable honestly');
    fs.rmSync(out, { recursive: true, force: true });
    db.close();
  });
  await t('soft mode hides D/F brands; named mode reveals them', async () => {
    const db = openStore(':memory:');
    recordScan(db, { domain: 'great.com', status: 'ok', score: 95, passes: 19, fails: 1, total: 20, results: [], scanned_at: 1 });
    recordScan(db, { domain: 'failing.com', status: 'ok', score: 20, passes: 2, fails: 8, total: 10, results: [{ status: 'fail', check: 'Alt Text', wcag: 'A', message: 'm', element: '' }], scanned_at: 1 });
    // soft (default): F brand hidden — no page, no name in index/data
    const soft = fs.mkdtempSync(path.join(os.tmpdir(), 'cirv-soft-'));
    const rs = buildSite(db, soft);
    assert.strictEqual(rs.mode, 'soft');
    assert(fs.existsSync(path.join(soft, 'sites', 'great.com.html')), 'A-grade page exists');
    assert(!fs.existsSync(path.join(soft, 'sites', 'failing.com.html')), 'F-grade page must NOT exist in soft mode');
    const softIdx = fs.readFileSync(path.join(soft, 'index.html'), 'utf-8');
    assert(!softIdx.includes('failing.com'), 'F brand name must not appear in soft index');
    assert(softIdx.includes('scan to reveal'), 'soft index shows reveal CTA');
    const softData = JSON.parse(fs.readFileSync(path.join(soft, 'data.json'), 'utf-8'));
    assert(softData.sites.some((s) => s.hidden && s.score === 20), 'F row marked hidden in data.json');
    // named: F brand fully revealed
    const named = fs.mkdtempSync(path.join(os.tmpdir(), 'cirv-named-'));
    buildSite(db, named, { mode: 'named' });
    assert(fs.existsSync(path.join(named, 'sites', 'failing.com.html')), 'F-grade page exists in named mode');
    assert(fs.readFileSync(path.join(named, 'index.html'), 'utf-8').includes('failing.com'), 'named index shows F brand');
    fs.rmSync(soft, { recursive: true, force: true });
    fs.rmSync(named, { recursive: true, force: true });
    db.close();
  });

  t('renderPricing wires tiers + the API url', () => {
    const html = renderPricing({ apiUrl: 'https://api.test' });
    assert(html.includes('data-tier="pro"'), 'has a subscribe button');
    assert(html.includes('"https://api.test"'), 'embeds the API base');
    assert(html.includes('Get a free key'), 'has the free-key form');
    assert(html.includes('/v1/billing/checkout'), 'calls checkout');
  });

  t('renderReport aggregates the dataset (grades, failures, best/worst, PDF link)', () => {
    const rows = [
      { status: 'ok', domain: 'good.com', score: 100, results_json: JSON.stringify([{ status: 'pass', check: 'Alt Text' }]), scanned_at: 1 },
      { status: 'ok', domain: 'bad.com', score: 20, results_json: JSON.stringify([{ status: 'fail', check: 'Alt Text' }, { status: 'fail', check: 'Link Text' }]), scanned_at: 1 },
    ];
    const named = renderReport(rows, { mode: 'named' });
    assert(named.includes('The State of EU E-commerce Accessibility'), 'has title');
    assert(named.includes('Grade A') && named.includes('Grade F'), 'has grade bars');
    assert(named.includes('good.com') && named.includes('bad.com'), 'names best + worst in named mode');
    assert(/state-of-eu-accessibility-\d{4}\.pdf/.test(named), 'links the PDF');
    const soft = renderReport(rows, { mode: 'soft' });
    assert(!soft.includes('bad.com'), 'soft mode hides the F-grade brand');
  });

  t('renderAnalytics emits a cookieless snippet (or nothing without an id)', () => {
    assert.strictEqual(renderAnalytics('goatcounter', ''), '', 'no id = no snippet');
    const g = renderAnalytics('goatcounter', 'cirv');
    assert(g.includes('cirv.goatcounter.com') && g.includes('gc.zgo.at'), 'goatcounter snippet');
    assert(!g.toLowerCase().includes('cookie'), 'is cookieless');
    assert(renderAnalytics('plausible', 'cirvgreen.com').includes('plausible.io'), 'plausible supported');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run();
