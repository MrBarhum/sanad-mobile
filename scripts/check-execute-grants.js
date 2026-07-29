#!/usr/bin/env node
/**
 * check:grants — stop the `authenticated` EXECUTE gap from silently reopening.
 *
 * ── THE PROBLEM THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * Supabase's `pg_default_acl` grants `anon`, `authenticated` and `service_role`
 * EXECUTE on EVERY function created in schema `public`. So a new service-role-only
 * function arrives open to any signed-in user, exactly as the 30 closed by
 * Milestone 9 A1 did. `revoke ... from public` does not help — it never removes an
 * explicit named-role grant. Nothing in the repo previously noticed.
 *
 * A one-off migration cannot prevent recurrence; only a standing check can.
 *
 * ── TWO HALVES ───────────────────────────────────────────────────────────────
 *
 * STATIC (always runs, no database, no secrets):
 *   The allow-list is coherent with the caller matrix — nothing listed as allowed
 *   is on the revoke list, and every function with a real `authenticated` caller
 *   (client rpc, user-scoped edge call, RLS/storage policy, DEFAULT/CHECK) IS
 *   allowed. Catches an allow-list edited to silence the live half.
 *
 * LIVE (runs when a linked database is reachable):
 *   The database's ACTUAL grants match the allow-list exactly, in both directions:
 *     - a DENIED function holding `authenticated` EXECUTE  -> the gap reopened
 *     - an ALLOWED function that LOST it                   -> over-revoked, app breaks
 *     - a function present in neither list                 -> newly created, unreviewed
 *   Only `has_function_privilege` can see this; the repo's SQL text cannot, which
 *   is precisely how the original gap hid.
 *
 * Exit codes: 0 pass · 1 drift found · 2 could not run the live half.
 * Pass --offline to run the static half only (exit 0 without a live check).
 *
 * Usage:  node scripts/check-execute-grants.js [--offline]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ALLOWLIST = path.join(ROOT, 'docs', 'deployment', 'authenticated-execute-allowlist.json');
const MATRIX = path.join(ROOT, 'docs', 'claude-reports', 'milestone-9-probes', 'function-caller-matrix.csv');
const PROBE = path.join(ROOT, 'docs', 'deployment', 'milestone-9-execute-privilege-probe.sql');

const offline = process.argv.includes('--offline');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

const list = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
const allowed = new Set(list.allowed);
const denied = new Set(list.denied);
const failures = [];

// ── STATIC HALF ──────────────────────────────────────────────────────────────
for (const fn of allowed) {
  if (denied.has(fn)) failures.push(`allow-list contradicts itself: ${fn} is in BOTH lists`);
}

if (fs.existsSync(MATRIX)) {
  const rows = parseCsv(fs.readFileSync(MATRIX, 'utf8'));
  const header = rows[0];
  const ix = (n) => header.indexOf(n);
  for (const r of rows.slice(1)) {
    const fn = r[ix('function')];
    const num = (c) => Number(r[ix(c)] || 0);
    const hasAuthCaller =
      num('client') > 0 || num('edgeUser') > 0 || num('policy') > 0 || num('default') > 0;
    if (hasAuthCaller && denied.has(fn)) {
      failures.push(
        `${fn} is DENIED but has an authenticated caller ` +
        `(client=${num('client')} edgeUser=${num('edgeUser')} policy=${num('policy')} default=${num('default')}) ` +
        `— denying it breaks the app`,
      );
    }
  }
} else {
  console.log('note: caller matrix not found; static cross-check skipped');
  console.log('      regenerate with: node scripts/analyze-function-grants.js');
}

// ── LIVE HALF ────────────────────────────────────────────────────────────────
let live = null;
if (!offline) {
  try {
    // Run through a shell: on Windows npx is a .cmd shim, which execFileSync has
    // refused to spawn directly since Node 20 (EINVAL). Passed as ONE command
    // string rather than a string + argv array — the latter is deprecated under
    // `shell: true` because arguments are concatenated unescaped. The only
    // interpolated value is a repo path this file computed, quoted below.
    const command =
      `npx supabase db query --linked -f ${JSON.stringify(PROBE)} -o csv`;
    const out = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
    });
    const start = out.indexOf('function_name,');
    if (start < 0) throw new Error('probe returned no CSV header');
    live = parseCsv(out.slice(start));
  } catch (err) {
    console.error('check:grants — could not run the live half.');
    console.error('  ' + String(err.message || err).split('\n')[0]);
    console.error('');
    console.error('  This check needs a linked Supabase project, because the gap it guards');
    console.error('  (pg_default_acl granting authenticated EXECUTE on new functions) is');
    console.error('  invisible in the repo\'s SQL. Run `supabase link` first, or pass');
    console.error('  --offline to run only the static half.');
    if (failures.length) {
      console.error('');
      for (const f of failures) console.error('  x ' + f);
    }
    process.exit(2);
  }
}

if (live) {
  const header = live[0];
  const ix = (n) => header.indexOf(n);
  const seen = new Set();
  for (const r of live.slice(1)) {
    const fn = r[ix('function_name')];
    const hasAuth = r[ix('authenticated_execute')] === 'true';
    seen.add(fn);
    if (!allowed.has(fn) && !denied.has(fn)) {
      failures.push(
        `${fn} is in NEITHER list — a new function nobody classified. ` +
        `If only cron/edge calls it, revoke authenticated and add it to "denied".`,
      );
      if (hasAuth) {
        failures.push(`  ^ and it currently HOLDS authenticated EXECUTE (the gap has reopened)`);
      }
      continue;
    }
    if (denied.has(fn) && hasAuth) {
      failures.push(`${fn} is DENIED but HOLDS authenticated EXECUTE — the gap reopened`);
    }
    if (allowed.has(fn) && !hasAuth) {
      failures.push(`${fn} is ALLOWED but LOST authenticated EXECUTE — over-revoked, app will break`);
    }
  }
  for (const fn of [...allowed, ...denied]) {
    if (!seen.has(fn)) failures.push(`${fn} is listed but no longer exists — drop it from the allow-list`);
  }
}

// ── REPORT ───────────────────────────────────────────────────────────────────
console.log(
  `check:grants - ${allowed.size} allowed, ${denied.size} denied` +
  (live ? `, ${live.length - 1} live functions checked` : ', static half only'),
);
if (failures.length) {
  console.log('');
  console.log(`FAILED (${failures.length}):`);
  for (const f of failures) console.log('  x ' + f);
  console.log('');
  console.log('If a change here is intentional, edit');
  console.log('docs/deployment/authenticated-execute-allowlist.json deliberately — and say why');
  console.log('in the commit. Do not edit it to make this check pass.');
  process.exit(1);
}
console.log(
  live
    ? 'No drift: every function\'s authenticated EXECUTE matches the reviewed allow-list.'
    : 'Static half passed. Run without --offline against a linked project for the real check.',
);
