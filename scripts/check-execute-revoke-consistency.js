/**
 * Milestone 9 · A1 guard — validate the revoke migration against the caller matrix.
 *
 * Re-runnable, read-only, no database required. It asserts the invariants that make
 * the migration safe, so a later edit to either file cannot quietly break them:
 *
 *   1. Every name the migration revokes is a real function in `public`.
 *   2. The four groups in the revoke block and the flat `revoked` array in the
 *      assertion block describe the SAME set — they are written twice, in two
 *      different shapes, and could drift.
 *   3. No revoked function has a caller that runs as `authenticated`: no client
 *      rpc(), no user-scoped edge call, no RLS/storage policy reference, no
 *      DEFAULT/CHECK usage. This is the invariant that matters; violating it
 *      breaks the app for real users.
 *   4. Every control function in `keep` exists and is NOT also revoked.
 *
 * Run: node scripts/check-execute-revoke-consistency.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(
  ROOT, 'supabase', 'migrations',
  '20260729120000_revoke_authenticated_execute_service_role_functions.sql',
);
const MATRIX = path.join(
  ROOT, 'docs', 'claude-reports', 'milestone-9-probes', 'function-caller-matrix.csv',
);

const sql = fs.readFileSync(MIGRATION, 'utf8');

/** Pull the quoted names out of a named `array[ ... ]` literal. */
function arrayLiteral(varName) {
  const re = new RegExp(varName + "\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([\\s\\S]*?)\\]", 'i');
  const m = sql.match(re);
  if (!m) throw new Error('could not find array literal for ' + varName);
  return [...m[1].matchAll(/'([a-z0-9_]+)'/gi)].map((x) => x[1]);
}

const groups = ['grp_a', 'grp_b', 'grp_c', 'grp_d'].map(arrayLiteral);
const grouped = groups.flat();
const revoked = arrayLiteral('revoked');
const needsService = arrayLiteral('needs_service');
const keep = arrayLiteral('keep');

const fail = [];
const note = [];

// --- 2. the two shapes must agree -------------------------------------------
const gSet = new Set(grouped);
const rSet = new Set(revoked);
if (grouped.length !== gSet.size) fail.push('duplicate name across grp_a..grp_d');
if (revoked.length !== rSet.size) fail.push('duplicate name in `revoked`');
for (const n of gSet) if (!rSet.has(n)) fail.push('in groups but not in `revoked`: ' + n);
for (const n of rSet) if (!gSet.has(n)) fail.push('in `revoked` but not in any group: ' + n);

// --- load the caller matrix --------------------------------------------------
const rows = fs.readFileSync(MATRIX, 'utf8').trim().split('\n');
const header = rows[0].split(',').map((h) => h.replace(/"/g, ''));
const idx = (name) => header.indexOf(name);
const matrix = new Map();
for (const line of rows.slice(1)) {
  const cells = line.match(/"([^"]*)"/g).map((c) => c.slice(1, -1));
  matrix.set(cells[idx('function')], cells);
}

// --- 1 & 3. existence, and no authenticated caller ---------------------------
for (const fn of revoked) {
  const row = matrix.get(fn);
  if (!row) { fail.push('revoked function not found in schema: ' + fn); continue; }
  const num = (col) => Number(row[idx(col)] || 0);
  const offenders = [];
  if (num('client') > 0) offenders.push('client rpc x' + num('client') + ' (' + row[idx('client_sites')] + ')');
  if (num('edgeUser') > 0) offenders.push('USER-scoped edge call x' + num('edgeUser'));
  if (num('policy') > 0) offenders.push('policy reference x' + num('policy') + ' (' + row[idx('policy_files')] + ')');
  if (num('default') > 0) offenders.push('DEFAULT/CHECK usage');
  if (offenders.length) {
    fail.push('UNSAFE REVOKE ' + fn + ' -> ' + offenders.join('; '));
  }
  if (num('trigger') > 0) note.push(fn + ' is a trigger function (EXECUTE checked at CREATE TRIGGER time, not at fire time)');
}

// --- 4. control set ----------------------------------------------------------
for (const fn of keep) {
  if (!matrix.has(fn)) fail.push('control function not found in schema: ' + fn);
  if (rSet.has(fn)) fail.push('function is BOTH revoked and in the keep control set: ' + fn);
}
for (const fn of needsService) {
  if (!rSet.has(fn)) fail.push('needs_service lists a function that is not revoked: ' + fn);
}

// --- report ------------------------------------------------------------------
console.log('revoke groups : ' + groups.map((g) => g.length).join(' + ') + ' = ' + grouped.length);
console.log('revoked array : ' + revoked.length);
console.log('needs_service : ' + needsService.length);
console.log('keep (control): ' + keep.length);
console.log('schema funcs  : ' + matrix.size);
console.log('');
if (note.length) {
  console.log('notes:');
  for (const n of note) console.log('  - ' + n);
  console.log('');
}
if (fail.length) {
  console.log('FAILED (' + fail.length + '):');
  for (const f of fail) console.log('  x ' + f);
  process.exit(1);
}
console.log('OK — every revoked function has no authenticated-role caller, the two');
console.log('     declarations agree, and no control function is revoked.');
