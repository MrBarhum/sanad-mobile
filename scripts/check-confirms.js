#!/usr/bin/env node
'use strict';

/**
 * check-confirms.js - dependency-free guard: no OS dialogs in `src/`.
 *
 * Sanad shows confirmations in its own Dar bottom sheet (`useConfirm()`, see
 * src/providers/confirm-provider.tsx), never in a platform dialog. This guard makes
 * that a law rather than a convention, the same way the NativeWind Pressable rule is
 * enforced by a grep.
 *
 * WHY IT MATTERS, beyond consistency:
 *   - A platform dialog is the one moment the app stops looking like itself: system
 *     font instead of Cairo, no 2px border, no control over confirm/cancel order
 *     under forceRTL, no calm-danger tone. It lands at exactly the instant before an
 *     irreversible action, when the user is most anxious.
 *   - On react-native-web `window.confirm` is SYNCHRONOUS and blocks the JS thread,
 *     which freezes the renderer outright. That single fact makes an unattended
 *     end-to-end browser QA pass impossible.
 *
 * WHAT IT BANS: Alert.alert, Alert.prompt, window.confirm, window.alert - anywhere
 * under `src/`, in any .ts/.tsx/.js/.jsx file including platform twins (*.web.tsx).
 *
 * DETECTION is deliberately textual, not an AST walk: zero dependencies is a house
 * rule for these scripts, and the ban is on a small fixed set of call expressions
 * that cannot be spelled many ways. To keep it honest about false positives, line
 * and block comments and string/template literals are stripped before matching, so
 * prose that merely NAMES a banned call (this file's own header, the note in
 * src/components/item-actions.tsx) is not a violation.
 *
 * Exit 1 on any violation outside the allow-list below.
 *
 * Pure Node.js, no dependencies.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCAN_DIR = 'src';
const INCLUDE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'coverage']);

/** The banned call expressions, matched after comments and literals are stripped. */
const BANNED = [
  { label: 'Alert.alert', re: /\bAlert\s*\.\s*alert\s*\(/g },
  { label: 'Alert.prompt', re: /\bAlert\s*\.\s*prompt\s*\(/g },
  { label: 'window.confirm', re: /\bwindow\s*\.\s*confirm\s*\(/g },
  { label: 'window.alert', re: /\bwindow\s*\.\s*alert\s*\(/g },
];

/**
 * Deliberate, reasoned exceptions. Keep this list SHORT and justified — an entry
 * here is a promise that the case genuinely cannot use the in-app sheet.
 *
 * A file is exempted only for the listed calls, so an unrelated new violation in the
 * same file still fails.
 */
const ALLOW = [
  {
    file: 'src/features/notifications/hooks.ts',
    calls: ['Alert.alert'],
    why:
      'Two ONE-BUTTON success notices after a push quick-action ("تم" / snooze), not ' +
      'confirmations — there is nothing to cancel and nothing is gated on them. They ' +
      'fire from a notification-response handler, including the cold-start replay ' +
      'path, where there may be no mounted, focused React tree to host an in-app ' +
      'surface. Converting them to a queued in-app toast is tracked as a follow-up.',
  },
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
    } else if (entry.isFile() && INCLUDE_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank out comments and string/template literals, preserving newlines and length so
 * line numbers stay exact. A single left-to-right pass, so a `//` inside a string and
 * a quote inside a comment are both handled correctly.
 */
function stripCommentsAndLiterals(src) {
  const out = src.split('');
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = src.length;
      blank(i, j);
      i = j;
    } else if (two === '/*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? src.length : j + 2;
      blank(i, j);
      i = j;
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const quote = src[i];
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === quote) break;
        j += 1;
      }
      blank(i + 1, Math.min(j, src.length));
      i = Math.min(j + 1, src.length);
    } else {
      i += 1;
    }
  }
  return out.join('');
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function allowanceFor(relPath, label) {
  return ALLOW.find((entry) => entry.file === relPath && entry.calls.includes(label));
}

function main() {
  const root = path.join(ROOT, SCAN_DIR);
  let files = [];
  try {
    if (fs.statSync(root).isDirectory()) files = walk(root, []);
  } catch {
    console.error(`check:confirms - no ${SCAN_DIR}/ directory at ${ROOT}`);
    process.exit(1);
  }

  const violations = [];
  const allowed = [];

  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const code = stripCommentsAndLiterals(text);
    const relPath = rel(file);

    for (const { label, re } of BANNED) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(code)) !== null) {
        const line = code.slice(0, match.index).split('\n').length;
        const hit = { file: relPath, line, label };
        if (allowanceFor(relPath, label)) allowed.push(hit);
        else violations.push(hit);
      }
    }
  }

  console.log(`check:confirms - scanned ${files.length} file(s) under ${SCAN_DIR}/.`);

  if (allowed.length > 0) {
    console.log(`\nAllow-listed (${allowed.length}) - deliberate, see ALLOW in this script:`);
    for (const hit of allowed) console.log(`  - ${hit.file}:${hit.line}  ${hit.label}`);
  }

  if (violations.length > 0) {
    console.error(`\nOS dialogs found in ${SCAN_DIR}/ (${violations.length}):`);
    for (const hit of violations) console.error(`  x ${hit.file}:${hit.line}  ${hit.label}`);
    console.error(
      '\nSanad confirms in its own sheet, never an OS dialog. Use `useConfirm()` from' +
        '\n@/providers (or `useConfirmDiscard()` for a discard-changes prompt).' +
        '\nIf a case genuinely cannot, add a justified entry to ALLOW in this script.',
    );
    process.exit(1);
  }

  console.log('\nNo OS dialogs outside the allow-list. Confirmations go through the app sheet.');
}

main();
