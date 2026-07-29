/**
 * Milestone 9 · A1 — judge a before/after pair of EXECUTE-privilege probes against
 * the acceptance criteria in docs/deployment/milestone-9-tier-1-runbook.md.
 *
 *   node scripts/compare-execute-probe.js before-exec.csv [after-exec.csv]
 *
 * With one file it reports the current state of the revoke targets. With two it
 * enforces every stop-condition:
 *
 *   - the ONLY changed cell may be authenticated_execute, true -> false
 *   - it may change only on functions the migration names
 *   - no row added or removed
 *   - nothing gains anon_execute
 *   - nothing loses service_role_execute
 *
 * Exits non-zero if any criterion fails, so it can gate the runbook.
 *
 * NOTE ON PARSING: `pg_get_function_identity_arguments` emits comma-separated
 * argument lists, which the CLI correctly quotes. A naive split(',') silently
 * shifts every column for multi-argument functions and reports confident nonsense
 * — that is exactly what it did on the first pass here. Hence a real parser.
 */
const fs = require('fs');
const path = require('path');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function load(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const header = rows[0];
  const col = (n) => header.indexOf(n);
  const map = new Map();
  for (const r of rows.slice(1)) {
    map.set(r[col('function_name')] + '(' + r[col('args')] + ')', {
      name: r[col('function_name')],
      args: r[col('args')],
      security: r[col('security')],
      anon: r[col('anon_execute')] === 'true',
      auth: r[col('authenticated_execute')] === 'true',
      svc: r[col('service_role_execute')] === 'true',
    });
  }
  return map;
}

const ROOT = path.resolve(__dirname, '..');
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase', 'migrations',
    '20260729120000_revoke_authenticated_execute_service_role_functions.sql'), 'utf8');
const targets = new Set(
  [...migration.match(/revoked\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i)[1]
    .matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]),
);

const before = load(process.argv[2]);
const after = process.argv[3] ? load(process.argv[3]) : null;

if (!after) {
  const open = [], closed = [];
  for (const v of before.values()) {
    if (!targets.has(v.name)) continue;
    (v.auth ? open : closed).push(v.name);
  }
  console.log('revoke targets: ' + targets.size);
  console.log('currently OPEN to authenticated: ' + open.length);
  open.sort().forEach((n) => console.log('  ! ' + n));
  console.log('already closed: ' + closed.length);
  closed.sort().forEach((n) => console.log('    ' + n));
  const nonTargetOpen = [...before.values()].filter((v) => !targets.has(v.name) && v.auth).length;
  console.log('\nnon-target functions still authenticated-executable (expected, must not change): ' + nonTargetOpen);
  process.exit(0);
}

const fail = [], changed = [];
for (const [k, b] of before) {
  const a = after.get(k);
  if (!a) { fail.push('ROW REMOVED: ' + k); continue; }
  if (b.anon !== a.anon) {
    fail.push((a.anon ? 'GAINED anon_execute: ' : 'anon_execute changed: ') + k);
  }
  if (b.svc !== a.svc) {
    fail.push((!a.svc ? 'LOST service_role_execute: ' : 'service_role_execute changed: ') + k);
  }
  if (b.auth !== a.auth) {
    if (b.auth && !a.auth) {
      changed.push(b.name);
      if (!targets.has(b.name)) fail.push('UNTARGETED function lost authenticated_execute: ' + k);
    } else {
      fail.push('GAINED authenticated_execute: ' + k);
    }
  }
}
for (const k of after.keys()) if (!before.has(k)) fail.push('ROW ADDED: ' + k);

const stillOpen = [...after.values()].filter((v) => targets.has(v.name) && v.auth).map((v) => v.name);
for (const n of stillOpen) fail.push('TARGET still authenticated-executable after apply: ' + n);

console.log('authenticated_execute true -> false on ' + changed.length + ' function(s):');
changed.sort().forEach((n) => console.log('  - ' + n));
console.log('\nrows before/after: ' + before.size + ' / ' + after.size);
console.log('all ' + targets.size + ' targets now closed: ' + (stillOpen.length === 0));

if (fail.length) {
  console.log('\nFAILED (' + fail.length + '):');
  fail.forEach((f) => console.log('  x ' + f));
  process.exit(1);
}
console.log('\nPASS — every acceptance criterion met.');
