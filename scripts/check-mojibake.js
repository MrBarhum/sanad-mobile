#!/usr/bin/env node
'use strict';

/**
 * check-mojibake.js - dependency-free scan for UTF-8 corruption (mojibake).
 *
 * Flags byte sequences that only appear when UTF-8 content (Arabic text,
 * typographic glyphs) has been double-encoded or decoded with the wrong code
 * page - for example the Arabic comma U+060C turning into a two-character
 * "O-stroke + capital-OE" artifact. Correctly-encoded Arabic is NOT flagged:
 * read back as UTF-8 it yields real Arabic letters, never these Latin-1 /
 * Windows-1252 artifacts.
 *
 * SCOPE - active source/config only. This guard scans the live app surface
 * (src, lib, scripts) plus root config files (package.json, app.json, eas.json,
 * tsconfig.json, *.config.js, ...). It deliberately does NOT scan `docs/` or the
 * `.claude/` skill docs:
 *   - those docs intentionally embed mojibake examples (e.g. the UI/UX skill
 *     lists the exact signatures to grep for), and
 *   - historical claude-reports may carry pre-existing corruption noise.
 * Scanning them would produce false failures. The goal here is to stop NEW
 * corruption from landing in active app source and config, not to police docs.
 *
 * Exit code is 1 only when a STRONG signature is found. Weak single-character
 * hints (which can also occur in legitimate Latin text) are reported but never
 * fail the run, so this never false-fails on Arabic or accented content.
 *
 * Pure Node.js, no dependencies. Signatures are built from numeric code points
 * (String.fromCharCode) so this file stays pure ASCII and never matches itself.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Active source/config directories to scan (recursively). Missing entries are
// skipped, so this list can stay forward-looking across restructures.
const SCAN_DIRS = ['src', 'lib', 'scripts', 'app', 'components', 'features'];

// Text file types worth scanning (per repo convention).
const INCLUDE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.css',
]);

// Never descend into these (build output / vcs / deps), even if nested.
const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'coverage']);

/** Build a signature string from BMP code points (keeps this source ASCII). */
const seq = (...codePoints) => String.fromCharCode(...codePoints);

// Strong signatures: multi-character artifacts that essentially never occur in
// valid UTF-8 English/Arabic text. Any hit fails the check. Each `value` is
// built from \u code points; the comment names what UTF-8 lead bytes become when
// UTF-8 is mis-read as Windows-1252 and re-encoded:
//   0xE2 -> 0x00E2, 0x80 -> 0x20AC, 0x9C -> 0x0153, 0x97 -> 0x2014,
//   0x84 -> 0x201E, 0x86 -> 0x2020, 0xEF -> 0x00EF, 0xBB -> 0x00BB,
//   0xD8 -> 0x00D8, 0x8C -> 0x0152, plus U+FFFD for invalid UTF-8.
const STRONG = [
  { label: 'U+FFFD replacement character', value: seq(0xfffd) },
  { label: 'a-circumflex + euro (general punctuation)', value: seq(0x00e2, 0x20ac) },
  { label: 'a-circumflex + small-oe (dingbats / checks)', value: seq(0x00e2, 0x0153) },
  { label: 'a-circumflex + em-dash (geometric shapes)', value: seq(0x00e2, 0x2014) },
  { label: 'a-circumflex + low-dquote (letterlike symbols)', value: seq(0x00e2, 0x201e) },
  { label: 'a-circumflex + dagger (arrows)', value: seq(0x00e2, 0x2020) },
  { label: 'i-diaeresis + guillemet (UTF-8 BOM)', value: seq(0x00ef, 0x00bb) },
  { label: 'O-stroke + capital-OE (Arabic comma U+060C)', value: seq(0x00d8, 0x0152) },
];

// Weak hints: lone high-Latin characters that may be mojibake but also appear in
// legitimate Latin text. Reported for awareness only - they never fail the run.
const WEAK = [
  { label: 'lone a-circumflex (U+00E2)', value: seq(0x00e2) },
  { label: 'lone A-circumflex (U+00C2)', value: seq(0x00c2) },
  { label: 'lone A-tilde (U+00C3)', value: seq(0x00c3) },
];

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.isFile()) {
      if (INCLUDE_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
    }
  }
  return out;
}

/** Collect active source files + root-level config files (no docs/skills). */
function collectFiles() {
  const files = [];

  for (const dir of SCAN_DIRS) {
    const full = path.join(ROOT, dir);
    try {
      if (fs.statSync(full).isDirectory()) walk(full, files);
    } catch {
      // directory absent - skip.
    }
  }

  // Root-level config files only (non-recursive): package.json, app.json,
  // eas.json, tsconfig.json, *.config.js, etc. Subdirectories like docs/ are not
  // entered here.
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(ROOT, { withFileTypes: true });
  } catch {
    rootEntries = [];
  }
  for (const entry of rootEntries) {
    if (entry.isFile() && INCLUDE_EXT.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.join(ROOT, entry.name));
    }
  }

  return [...new Set(files)];
}

/** 1-based line number of the first occurrence of `needle`, or null. */
function firstLineWith(text, needle) {
  const idx = text.indexOf(needle);
  if (idx < 0) return null;
  return text.slice(0, idx).split('\n').length;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function main() {
  const files = collectFiles();
  const strongHits = [];
  const weakHits = [];

  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const sig of STRONG) {
      if (text.includes(sig.value)) {
        strongHits.push({ file: rel(file), label: sig.label, line: firstLineWith(text, sig.value) });
      }
    }
    for (const sig of WEAK) {
      if (text.includes(sig.value)) {
        weakHits.push({ file: rel(file), label: sig.label, line: firstLineWith(text, sig.value) });
      }
    }
  }

  console.log(`check:mojibake - scanned ${files.length} active source/config file(s).`);

  if (weakHits.length > 0) {
    console.log(`\nWeak hints (${weakHits.length}) - review only, not failing:`);
    for (const h of weakHits) console.log(`  ~ ${h.file}:${h.line}  ${h.label}`);
  }

  if (strongHits.length > 0) {
    console.error(`\nStrong mojibake signatures found (${strongHits.length}):`);
    for (const h of strongHits) console.error(`  x ${h.file}:${h.line}  ${h.label}`);
    console.error('\nThese files look encoding-corrupted. Re-save them as UTF-8 with LF endings.');
    process.exit(1);
  }

  console.log('\nNo strong mojibake signatures found in active source/config.');
}

main();
