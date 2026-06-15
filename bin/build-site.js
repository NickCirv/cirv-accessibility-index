#!/usr/bin/env node
'use strict';

// Generate the static directory site from the dataset.
//   node bin/build-site.js [--db data/index.db] [--out ../directory/public] [--base https://index.cirvgreen.com]

const path = require('path');
const { openStore } = require('../src/store');
const { buildSite } = require('../src/site');

function argVal(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const args = process.argv.slice(2);
const dbPath = argVal(args, '--db') || path.join(__dirname, '..', 'data', 'index.db');
const outDir = argVal(args, '--out') || path.join(__dirname, '..', 'public');
const base = argVal(args, '--base');

const db = openStore(dbPath);
const res = buildSite(db, outDir, base ? { base } : {});
db.close();
console.log(`built ${res.pages} pages (${res.scored} scored / ${res.total} domains) -> ${outDir}`);
