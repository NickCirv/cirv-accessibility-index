// VENDORED from cirv-guard.php (the canonical WCAG rules), mirrored via the public scanner.
// Keep in sync with the plugin — see docs/adr/0001-vendored-engine.md.
'use strict';

// WCAG checks ported rule-for-rule from cirv-guard.php so the public scanner
// agrees with the plugin exactly. 5 checks: alt text, heading hierarchy,
// inline-style colour contrast, form labels, link text.

const cheerio = require('cheerio');

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n) + '...' : s || '');

// ---- colour helpers (WCAG relative luminance) ----
function parseColor(color) {
  color = String(color).trim();
  let m;
  if ((m = color.match(/^#([0-9a-fA-F]{3})$/))) {
    const h = m[1];
    return [h[0] + h[0], h[1] + h[1], h[2] + h[2]].map((x) => parseInt(x, 16));
  }
  if ((m = color.match(/^#([0-9a-fA-F]{6})$/))) {
    const h = m[1];
    return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((x) => parseInt(x, 16));
  }
  if ((m = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i))) {
    return [+m[1], +m[2], +m[3]];
  }
  return null;
}
function relLum(rgb) {
  const c = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastRatio(fg, bg) {
  const l1 = relLum(fg);
  const l2 = relLum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---- CHECK 1: ALT TEXT (WCAG 1.1.1) ----
function checkAltText($) {
  const out = [];
  const imgs = $('img').toArray();
  let missing = 0;
  for (const el of imgs) {
    const a = el.attribs || {};
    const hasAlt = 'alt' in a;
    if (hasAlt && a.alt === '') {
      const role = a.role;
      if (role === 'presentation' || role === 'none') continue;
    }
    if (!hasAlt) {
      missing++;
      out.push({ status: 'fail', check: 'Alt Text', wcag: 'A (1.1.1)',
        message: 'Image missing alt attribute', element: `<img src="${trunc(a.src || '', 60)}">` });
      if (missing >= 20) break;
    }
  }
  if (missing === 0 && imgs.length > 0)
    out.push({ status: 'pass', check: 'Alt Text', wcag: 'A (1.1.1)', message: `All ${imgs.length} images have alt attributes`, element: '' });
  if (imgs.length === 0)
    out.push({ status: 'pass', check: 'Alt Text', wcag: 'A (1.1.1)', message: 'No images found on page', element: '' });
  return out;
}

// ---- CHECK 2: HEADING HIERARCHY (WCAG 1.3.1) ----
function checkHeadings($) {
  const out = [];
  const hs = $('h1,h2,h3,h4,h5,h6').toArray();
  if (hs.length === 0) {
    out.push({ status: 'fail', check: 'Heading Hierarchy', wcag: 'A (1.3.1)', message: 'No headings found. Pages should have a heading structure.', element: '' });
    return out;
  }
  let prev = 0, hasH1 = false, h1count = 0, skip = false;
  for (const el of hs) {
    const level = parseInt(el.tagName.slice(1), 10);
    const text = trunc($(el).text().trim(), 50);
    if (level === 1) { hasH1 = true; h1count++; }
    if (prev > 0 && level > prev + 1) {
      skip = true;
      out.push({ status: 'fail', check: 'Heading Hierarchy', wcag: 'A (1.3.1)', message: `Heading level skipped: H${prev} to H${level}`, element: `<h${level}>${text}</h${level}>` });
    }
    prev = level;
  }
  if (!hasH1) out.push({ status: 'fail', check: 'Heading Hierarchy', wcag: 'A (1.3.1)', message: 'Page is missing an H1 heading', element: '' });
  if (h1count > 1) out.push({ status: 'fail', check: 'Heading Hierarchy', wcag: 'A (1.3.1)', message: `Multiple H1 headings found (${h1count}). Pages should have exactly one H1.`, element: '' });
  if (!skip && hasH1 && h1count === 1)
    out.push({ status: 'pass', check: 'Heading Hierarchy', wcag: 'A (1.3.1)', message: `Heading hierarchy is correct (${hs.length} headings)`, element: '' });
  return out;
}

// ---- CHECK 3: COLOUR CONTRAST (WCAG 1.4.3) — inline styles only ----
function checkContrast($) {
  const out = [];
  let checked = 0, fail = 0;
  for (const el of $('[style]').toArray()) {
    const style = (el.attribs && el.attribs.style) || '';
    let fg = null, bg = null, m;
    if ((m = style.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))/i))) fg = parseColor(m[1]);
    if ((m = style.match(/background-color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))/i))) bg = parseColor(m[1]);
    if (fg && bg) {
      checked++;
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) {
        fail++;
        out.push({ status: 'fail', check: 'Color Contrast', wcag: 'AA (1.4.3)', message: `Contrast ratio ${ratio.toFixed(1)}:1 (needs 4.5:1 minimum)`, element: `"${trunc($(el).text().trim(), 40)}"` });
        if (fail >= 10) break;
      }
    }
  }
  if (fail === 0)
    out.push({ status: 'pass', check: 'Color Contrast', wcag: 'AA (1.4.3)', message: checked > 0 ? `All ${checked} inline color pairs meet contrast requirements` : 'No inline color pairs found to check', element: '' });
  return out;
}

// ---- CHECK 4: FORM LABELS (WCAG 1.3.1) ----
function checkFormLabels($) {
  const out = [];
  const skipTypes = ['hidden', 'submit', 'button', 'reset', 'image'];
  const inputs = [
    ...$('input').toArray().filter((el) => !skipTypes.includes(((el.attribs || {}).type || '').toLowerCase())),
    ...$('select').toArray(),
    ...$('textarea').toArray(),
  ];
  const forIds = $('label[for]').toArray().map((el) => el.attribs.for);
  let unlabeled = 0;
  for (const el of inputs) {
    const a = el.attribs || {};
    let labeled = false;
    if (a.id && forIds.includes(a.id)) labeled = true;
    if (!labeled) {
      let p = el.parent;
      while (p) { if (p.tagName === 'label') { labeled = true; break; } p = p.parent; }
    }
    if (!labeled && (a['aria-label'] || a['aria-labelledby'])) labeled = true;
    if (!labeled && a.title) labeled = true;
    if (!labeled) {
      unlabeled++;
      let disp = '<' + el.tagName;
      if (a.type) disp += ` type="${a.type}"`;
      if (a.name) disp += ` name="${a.name}"`;
      disp += '>';
      out.push({ status: 'fail', check: 'Form Labels', wcag: 'A (1.3.1)', message: 'Form input has no associated label', element: disp });
      if (unlabeled >= 15) break;
    }
  }
  if (unlabeled === 0)
    out.push({ status: 'pass', check: 'Form Labels', wcag: 'A (1.3.1)', message: inputs.length > 0 ? `All ${inputs.length} form inputs have labels` : 'No form inputs found on page', element: '' });
  return out;
}

// ---- CHECK 5: LINK TEXT (WCAG 2.4.4) ----
const GENERIC = ['click here', 'here', 'read more', 'more', 'learn more', 'link', 'this', 'continue', 'go'];
function checkLinkText($) {
  const out = [];
  const links = $('a').toArray();
  let bad = 0;
  for (const el of links) {
    const a = el.attribs || {};
    const text = $(el).text().trim().toLowerCase();
    if (!a.href) continue;
    if (a['aria-label']) continue;
    if (text === '') {
      const hasImgAlt = $(el).find('img').toArray().some((im) => (im.attribs || {}).alt);
      if (!hasImgAlt) {
        bad++;
        out.push({ status: 'fail', check: 'Link Text', wcag: 'A (2.4.4)', message: 'Link has no text content', element: `<a href="${trunc(a.href, 50)}">` });
      }
    } else if (GENERIC.includes(text)) {
      bad++;
      out.push({ status: 'fail', check: 'Link Text', wcag: 'A (2.4.4)', message: `Generic link text: "${text}"`, element: `<a href="...">${text}</a>` });
    }
    if (bad >= 15) break;
  }
  if (bad === 0 && links.length > 0)
    out.push({ status: 'pass', check: 'Link Text', wcag: 'A (2.4.4)', message: `All ${links.length} links have descriptive text`, element: '' });
  if (links.length === 0)
    out.push({ status: 'pass', check: 'Link Text', wcag: 'A (2.4.4)', message: 'No links found on page', element: '' });
  return out;
}

// ---- runner + score (score formula matches cirv-guard.php:357) ----
function scan(html) {
  const $ = cheerio.load(html);
  const results = [
    ...checkAltText($), ...checkHeadings($), ...checkContrast($),
    ...checkFormLabels($), ...checkLinkText($),
  ];
  const passes = results.filter((r) => r.status === 'pass').length;
  const fails = results.length - passes;
  const score = results.length > 0 ? Math.round((passes / results.length) * 100) : 0;
  return { score, passes, fails, total: results.length, results };
}

module.exports = { scan, parseColor, contrastRatio };
