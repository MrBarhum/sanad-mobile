#!/usr/bin/env node
'use strict';

/**
 * check-i18n-parity.js - dependency-free guard for the ar/en locale contract.
 *
 * The standing law is that `src/locales/ar.json` and `src/locales/en.json` carry
 * EXACTLY the same leaf keys. Until now that was enforced by convention only:
 * nothing in the repo failed when a key landed in one file and not the other, and
 * the symptom - a raw key string rendering in the UI - only shows up on a device,
 * in the one locale nobody was looking at.
 *
 * This checks four things and exits 1 on any of them:
 *   1. A leaf key present in one locale and missing from the other.
 *   2. A DUPLICATE key inside one object (JSON.parse silently keeps the last one,
 *      so the earlier value is lost with no error anywhere).
 *   3. A leaf whose type differs between locales (string here, object there) -
 *      which means one side has a nested group where the other has a value.
 *   4. Interpolation tokens that differ between the two values of the same key,
 *      e.g. ar says {{count}} and en says {{total}}. i18next silently renders the
 *      literal token, so this is invisible until someone reads that exact string
 *      in that exact language.
 *
 * Pure Node.js, no dependencies. Run: `npm run check:i18n`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const LOCALE_DIR = path.join(ROOT, 'src', 'locales');
const BASE = 'ar'; // Arabic is the source language; English mirrors it.
const OTHER = 'en';

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Collects every leaf key path, plus the value type, in stable order. */
function collectLeaves(node, prefix, out) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      collectLeaves(value, full, out);
    } else {
      out.set(full, typeof value === 'string' ? 'string' : typeof value);
    }
  }
}

/**
 * Finds duplicate keys within a single JSON object literal. JSON.parse keeps the
 * LAST occurrence and reports nothing, so a duplicate silently discards a
 * translation. Walks the raw text with a small tokenizer rather than a parser -
 * enough to track object depth and the keys seen at each level.
 */
function findDuplicateKeys(raw, file) {
  const problems = [];
  const stack = [new Set()];
  let line = 1;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (ch === '\n') {
      line++;
      i++;
      continue;
    }

    if (ch === '{') {
      stack.push(new Set());
      i++;
      continue;
    }

    if (ch === '}') {
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }

    if (ch === '"') {
      // Read the full string, honouring escapes.
      let j = i + 1;
      let str = '';
      while (j < raw.length) {
        if (raw[j] === '\\') {
          str += raw[j + 1] === 'n' ? '\n' : raw[j + 1];
          j += 2;
          continue;
        }
        if (raw[j] === '"') break;
        if (raw[j] === '\n') line++;
        str += raw[j];
        j++;
      }
      const startLine = line;
      i = j + 1;

      // A key is a string followed (after whitespace) by a colon.
      let k = i;
      while (k < raw.length && /\s/.test(raw[k])) {
        if (raw[k] === '\n') line++;
        k++;
      }
      if (raw[k] === ':') {
        const seen = stack[stack.length - 1];
        if (seen.has(str)) {
          problems.push(`${file}:${startLine}  duplicate key "${str}" in the same object`);
        }
        seen.add(str);
      }
      continue;
    }

    i++;
  }

  return problems;
}

/** The set of {{tokens}} used in a string, order-independent. */
function tokensIn(value) {
  if (typeof value !== 'string') return null;
  const found = new Set();
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(value)) !== null) found.add(match[1]);
  return found;
}

/** Reads a dotted leaf path out of a parsed locale object. */
function readPath(obj, dotted) {
  return dotted.split('.').reduce((node, part) => (node == null ? node : node[part]), obj);
}

function main() {
  const files = {};
  for (const lang of [BASE, OTHER]) {
    const file = path.join(LOCALE_DIR, `${lang}.json`);
    if (!fs.existsSync(file)) {
      console.error(`check:i18n - missing locale file: ${path.relative(ROOT, file)}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(file, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error(`check:i18n - ${path.relative(ROOT, file)} is not valid JSON: ${error.message}`);
      process.exit(1);
    }
    files[lang] = { raw, parsed, rel: path.relative(ROOT, file).replace(/\\/g, '/') };
  }

  const problems = [];

  // 2) duplicates, per file
  for (const lang of [BASE, OTHER]) {
    problems.push(...findDuplicateKeys(files[lang].raw, files[lang].rel));
  }

  // 1) + 3) leaf sets and types
  const leaves = {};
  for (const lang of [BASE, OTHER]) {
    leaves[lang] = new Map();
    collectLeaves(files[lang].parsed, '', leaves[lang]);
  }

  for (const key of leaves[BASE].keys()) {
    if (!leaves[OTHER].has(key)) problems.push(`missing in ${OTHER}.json: ${key}`);
  }
  for (const key of leaves[OTHER].keys()) {
    if (!leaves[BASE].has(key)) problems.push(`missing in ${BASE}.json: ${key}`);
  }
  for (const [key, type] of leaves[BASE]) {
    const otherType = leaves[OTHER].get(key);
    if (otherType !== undefined && otherType !== type) {
      problems.push(`type differs for ${key}: ${BASE}=${type} ${OTHER}=${otherType}`);
    }
  }

  // 4) interpolation tokens
  for (const key of leaves[BASE].keys()) {
    if (!leaves[OTHER].has(key)) continue;
    const baseTokens = tokensIn(readPath(files[BASE].parsed, key));
    const otherTokens = tokensIn(readPath(files[OTHER].parsed, key));
    if (!baseTokens || !otherTokens) continue;
    const onlyBase = [...baseTokens].filter((t) => !otherTokens.has(t));
    const onlyOther = [...otherTokens].filter((t) => !baseTokens.has(t));
    if (onlyBase.length || onlyOther.length) {
      const parts = [];
      if (onlyBase.length) parts.push(`only in ${BASE}: {{${onlyBase.join('}}, {{')}}}`);
      if (onlyOther.length) parts.push(`only in ${OTHER}: {{${onlyOther.join('}}, {{')}}}`);
      problems.push(`interpolation tokens differ for ${key} - ${parts.join('; ')}`);
    }
  }

  const count = leaves[BASE].size;
  if (problems.length > 0) {
    console.error(`check:i18n - ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`\n${BASE}=${count} ${OTHER}=${leaves[OTHER].size}`);
    process.exit(1);
  }

  console.log(`check:i18n - ${BASE} and ${OTHER} are at exact parity (${count} leaf keys).`);
  console.log('No duplicate keys, no type mismatches, no interpolation drift.');
}

main();
