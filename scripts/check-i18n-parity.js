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
 * This checks eight things and exits 1 on any of them:
 *   1. A leaf key present in one locale and missing from the other.
 *   2. A DUPLICATE key inside one object (JSON.parse silently keeps the last one,
 *      so the earlier value is lost with no error anywhere).
 *   3. A leaf whose type differs between locales (string here, object there) -
 *      which means one side has a nested group where the other has a value.
 *   4. Interpolation tokens that differ between the two values of the same key,
 *      e.g. ar says {{count}} and en says {{total}}. i18next silently renders the
 *      literal token, so this is invisible until someone reads that exact string
 *      in that exact language.
 *   5. A plural family missing one of ITS OWN locale's CLDR categories, or
 *      carrying one that locale never selects.
 *   6. An unsuffixed base key left behind beside its plural family.
 *   7. A {{count}} key with no plural forms at all - the bug this guard was added
 *      for.
 *   8. Plural-family token coherence, within a locale and across the two.
 *
 * ── WHY 5-8 EXIST ────────────────────────────────────────────────────────────
 *
 * Arabic has SIX CLDR cardinal categories (zero one two few many other); English
 * has two. i18next appends the category to the leaf, so `minutes_few` in ar has
 * no counterpart in en and never will. Check 1 alone would call that four missing
 * keys, so a plural family is compared as ONE unit of parity across the locales,
 * and each locale is then held to its own category set instead.
 *
 * The failure these guard against is quiet in a way a missing ordinary key is
 * not. `fallbackLng: 'en'` means an absent Arabic form does not render a visible
 * `some.key.path` on screen - it renders the ENGLISH sentence, on an Arabic
 * screen, and nobody notices. And a leftover unsuffixed base key is worse still:
 * i18next pops the bare key LAST as its final fallback, so the stale twin quietly
 * absorbs every category you forgot to write.
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

/** Every CLDR cardinal category i18next can append, in CLDR's own order. */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * The categories each locale must supply, straight from CLDR. Selection happens
 * through Intl.PluralRules at runtime - see src/i18n/index.ts, which polyfills it
 * because Hermes does not implement it.
 */
const PLURAL_FORMS = {
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
  en: ['one', 'other'],
};

/**
 * `_zero` is permitted on top of a locale's required set, in every locale.
 * i18next 26 looks up `<leaf>_zero` ahead of the CLDR category whenever
 * count === 0, so an English `_zero` ("No active medications") is a real,
 * reachable override rather than dead weight. Any OTHER off-list category is
 * dead weight and is rejected.
 */
const ALWAYS_ALLOWED = 'zero';

/**
 * The escape hatch for a {{count}} that is not a plural SELECTOR: a heading like
 * «مواعيد اليوم: 3», where the number sits after a colon and inflects nothing in
 * front of it.
 *
 * Keep this empty. If the number does not inflect the sentence, the real fix is
 * to stop calling the token `count` - rename it to {{n}} and i18next never enters
 * plural resolution at all. That is what the five «X اليوم: {{n}}» headings do.
 * Only add an entry here if a key genuinely must keep the name `count`, and give
 * a one-line reason.
 */
const COUNT_WITHOUT_PLURAL = new Set([
  // (empty on purpose - rename the token to {{n}} instead)
]);

const PLURAL_SUFFIX_RE = new RegExp(`^(.+)_(${PLURAL_CATEGORIES.join('|')})$`);

/**
 * Splits a dotted leaf path into its plural family and category, or returns null
 * for an ordinary key. Only the LAST dotted segment is inspected, so a nested
 * group that happens to be named `one` or `other` is left alone.
 */
function splitPlural(dotted) {
  const cut = dotted.lastIndexOf('.');
  const leaf = cut === -1 ? dotted : dotted.slice(cut + 1);
  const match = PLURAL_SUFFIX_RE.exec(leaf);
  if (!match) return null;
  return {
    base: cut === -1 ? match[1] : `${dotted.slice(0, cut)}.${match[1]}`,
    category: match[2],
  };
}

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
      // Remember where the string STARTS - a multi-line value would otherwise be
      // reported at its closing line.
      const startLine = line;

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
      i = j + 1;

      // A key is a string followed (after whitespace) by a colon. This is a
      // LOOKAHEAD ONLY: it must not touch `line`, because `i` does not advance
      // past this whitespace and the main loop re-reads it. Counting here too
      // double-counted the newline before every `}`, so the reported line number
      // drifted steadily upward - by the end of ar.json a duplicate was being
      // blamed on a key ~100 lines away, which makes the check worse than silent.
      let k = i;
      while (k < raw.length && /\s/.test(raw[k])) k++;
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

/** Renders the difference between two token sets, or null when they match. */
function describeDrift(baseTokens, otherTokens) {
  if (!baseTokens || !otherTokens) return null;
  const onlyBase = [...baseTokens].filter((t) => !otherTokens.has(t));
  const onlyOther = [...otherTokens].filter((t) => !baseTokens.has(t));
  if (!onlyBase.length && !onlyOther.length) return null;
  const parts = [];
  if (onlyBase.length) parts.push(`only in ${BASE}: {{${onlyBase.join('}}, {{')}}}`);
  if (onlyOther.length) parts.push(`only in ${OTHER}: {{${onlyOther.join('}}, {{')}}}`);
  return parts.join('; ');
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

  // Split every leaf into ordinary keys and plural families. A family is compared
  // across the locales as ONE unit (check 1); its members are then checked against
  // their own locale's category set (check 5).
  const leaves = {};
  const singles = {}; // lang -> Map(dotted path -> value type)
  const families = {}; // lang -> Map(family base -> Map(category -> dotted path))
  for (const lang of [BASE, OTHER]) {
    leaves[lang] = new Map();
    collectLeaves(files[lang].parsed, '', leaves[lang]);
    singles[lang] = new Map();
    families[lang] = new Map();
    for (const [key, type] of leaves[lang]) {
      const split = splitPlural(key);
      if (!split) {
        singles[lang].set(key, type);
        continue;
      }
      if (!families[lang].has(split.base)) families[lang].set(split.base, new Map());
      families[lang].get(split.base).set(split.category, key);
    }
  }

  // 1) parity of ordinary keys, and of plural families as whole units
  for (const key of singles[BASE].keys()) {
    if (!singles[OTHER].has(key)) problems.push(`missing in ${OTHER}.json: ${key}`);
  }
  for (const key of singles[OTHER].keys()) {
    if (!singles[BASE].has(key)) problems.push(`missing in ${BASE}.json: ${key}`);
  }
  for (const base of families[BASE].keys()) {
    if (!families[OTHER].has(base)) problems.push(`missing in ${OTHER}.json: plural family ${base}_*`);
  }
  for (const base of families[OTHER].keys()) {
    if (!families[BASE].has(base)) problems.push(`missing in ${BASE}.json: plural family ${base}_*`);
  }

  // 3) + 4) type mismatch and interpolation drift, over EVERY leaf.
  //
  // These deliberately walk `leaves`, not `singles`. Only check 1 needs to treat a
  // plural family as one unit; scoping 3 and 4 to ordinary keys as well would
  // exempt `minutes_one`, `summary_zero` and friends from the two checks most
  // likely to catch a hand-edit - and those are the forms that render for the
  // counts users actually see. Both loops already skip a key the other locale does
  // not have, so Arabic's `_two`/`_few`/`_many`, which English legitimately never
  // carries, are a no-op here rather than a false positive.
  for (const [key, type] of leaves[BASE]) {
    const otherType = leaves[OTHER].get(key);
    if (otherType !== undefined && otherType !== type) {
      problems.push(`type differs for ${key}: ${BASE}=${type} ${OTHER}=${otherType}`);
    }
  }

  for (const key of leaves[BASE].keys()) {
    if (!leaves[OTHER].has(key)) continue;
    const drift = describeDrift(
      tokensIn(readPath(files[BASE].parsed, key)),
      tokensIn(readPath(files[OTHER].parsed, key))
    );
    if (drift) problems.push(`interpolation tokens differ for ${key} - ${drift}`);
  }

  // 5) each locale supplies exactly its own CLDR categories (plus optional _zero)
  for (const lang of [BASE, OTHER]) {
    const required = PLURAL_FORMS[lang];
    if (!required) continue;
    const allowed = new Set([...required, ALWAYS_ALLOWED]);
    for (const [base, forms] of families[lang]) {
      for (const category of required) {
        if (!forms.has(category)) {
          problems.push(
            `${lang}.json is missing ${base}_${category} - ${lang} selects ` +
              `[${required.join(' ')}], and a missing form falls through to ${OTHER === lang ? BASE : OTHER}.json`
          );
        }
      }
      for (const category of forms.keys()) {
        if (!allowed.has(category)) {
          problems.push(
            `${lang}.json has ${base}_${category}, which ${lang} never selects - dead weight, remove it`
          );
        }
      }
    }
  }

  // 6) an unsuffixed base key left beside its family. i18next pops the bare key
  //    LAST, so it silently absorbs whichever category is missing instead of
  //    letting check 5 surface it.
  for (const lang of [BASE, OTHER]) {
    for (const base of families[lang].keys()) {
      if (singles[lang].has(base)) {
        problems.push(
          `${lang}.json still has the unsuffixed "${base}" alongside ${base}_* - ` +
            `delete it, it masks a missing plural form instead of failing`
        );
      }
    }
  }

  // 7) a {{count}} key with no plural forms - the actual bug this guard exists for
  for (const lang of [BASE, OTHER]) {
    for (const key of singles[lang].keys()) {
      if (COUNT_WITHOUT_PLURAL.has(key)) continue;
      const tokens = tokensIn(readPath(files[lang].parsed, key));
      if (!tokens || !tokens.has('count')) continue;
      problems.push(
        `${lang}.json: "${key}" interpolates {{count}} but has no plural forms - ` +
          `add ${PLURAL_FORMS[lang].map((c) => `_${c}`).join('/')}, or rename the ` +
          `token to {{n}} if the number inflects nothing in the sentence`
      );
    }
  }

  // 8) plural-family token coherence.
  //    Across locales: the `other` forms must agree, the same rule ordinary keys get.
  //    Within a locale: a numeral-less `one`/`two` form may legitimately drop
  //    {{count}}, but it may NOT drop {{name}} - so every non-count token that the
  //    `other` form carries must appear in every form of that family.
  for (const lang of [BASE, OTHER]) {
    for (const [base, forms] of families[lang]) {
      const otherPath = forms.get('other');
      if (!otherPath) continue; // already reported by check 5
      const otherTokens = tokensIn(readPath(files[lang].parsed, otherPath));
      if (!otherTokens) continue;

      if (!otherTokens.has('count')) {
        problems.push(
          `${lang}.json: ${base}_other has no {{count}} - the catch-all form must ` +
            `show the number`
        );
      }
      const carried = [...otherTokens].filter((t) => t !== 'count');
      for (const [category, keyPath] of forms) {
        if (category === 'other') continue;
        const formTokens = tokensIn(readPath(files[lang].parsed, keyPath));
        if (!formTokens) continue;
        const dropped = carried.filter((t) => !formTokens.has(t));
        if (dropped.length) {
          problems.push(
            `${lang}.json: ${base}_${category} drops {{${dropped.join('}}, {{')}}} ` +
              `that ${base}_other carries`
          );
        }
      }
    }
  }
  // (No cross-locale `_other` comparison here: check 4 already walks every leaf
  // both locales share, which includes `_other`. Repeating it would just print
  // the same problem twice.)

  const count = leaves[BASE].size;
  const familyCount = families[BASE].size;
  if (problems.length > 0) {
    console.error(`check:i18n - ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`\n${BASE}=${count} ${OTHER}=${leaves[OTHER].size}`);
    process.exit(1);
  }

  console.log(
    `check:i18n - ${BASE} and ${OTHER} are at exact parity ` +
      `(${count} leaf keys in ${BASE}, of which ${familyCount} plural famil${familyCount === 1 ? 'y' : 'ies'}).`
  );
  console.log('No duplicate keys, no type mismatches, no interpolation drift.');
  console.log('Every plural family is complete in both locales; no bare {{count}} key.');
}

main();
