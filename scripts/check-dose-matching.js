#!/usr/bin/env node
/**
 * check:doses — regression test for how recorded doses are matched to schedule slots.
 *
 * ── WHY THIS IS A CHECKED-IN TEST AND NOT A ONE-OFF ──────────────────────────
 *
 * `computeDoseItems` decides what a caregiver is shown as still-outstanding today.
 * Get it wrong in one direction and an already-administered dose reappears as
 * outstanding — inviting a SECOND dose of a real medication. Get it wrong the
 * other way and a genuinely due dose is hidden.
 *
 * That is exactly what shipped: a log is bound to the `(schedule_id,
 * scheduled_time)` it was recorded against, so editing a schedule's time left the
 * log stranded and the dose re-presented as unlogged. The same defect made the
 * family's weekly summary count one dose twice.
 *
 * The repo has no test runner, so this is a standalone script. It transpiles the
 * real module with the TypeScript compiler (already a devDependency — nothing new
 * is installed) and asserts against it, so it tests the shipping code rather than
 * a copy of it.
 *
 * Usage:  node scripts/check-dose-matching.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'sanad-dose-'));

/** Transpile one TS file to CommonJS. Types are erased, so type-only imports vanish. */
function transpile(srcRel, destName, rewrites = []) {
  const source = fs.readFileSync(path.join(ROOT, srcRel), 'utf8');
  let js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: srcRel,
  }).outputText;
  for (const [from, to] of rewrites) js = js.split(from).join(to);
  fs.writeFileSync(path.join(OUT, destName), js);
}

transpile('src/utils/date.ts', 'date.js');
// The path alias `@/utils/date` means nothing to node; point it at the sibling.
transpile('src/features/medications/today.ts', 'today.js', [['"@/utils/date"', '"./date.js"']]);

const { computeDoseItems, summarizeDoses } = require(path.join(OUT, 'today.js'));

const MED_A = { id: 'med-a', name: 'Metformin', dosage: '500mg', form: 'tablet',
  instructions: null, with_food: false, responsible_user_id: 'user-1' };
const MED_B = { id: 'med-b', name: 'Aspirin', dosage: '75mg', form: 'tablet',
  instructions: null, with_food: false, responsible_user_id: 'user-1' };

const sched = (id, medId, times, extra = {}) => ({
  id, medication_id: medId, times, is_active: true,
  start_date: '2020-01-01', end_date: null,
  days_of_week: [0, 1, 2, 3, 4, 5, 6], ...extra,
});
const log = (id, medId, schedId, time, status = 'given') => ({
  id, medication_id: medId, schedule_id: schedId,
  dose_date: '2026-07-29', scheduled_time: time, status,
});

const DATE = '2026-07-29';
const shape = (items) => items.map((i) =>
  ({ t: i.scheduledTime, med: i.medicationName, status: i.status, logged: i.logId !== null }));

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${name}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

check('baseline: schedule 08:00 with its own log',
  shape(computeDoseItems({ date: DATE, medications: [MED_A],
    schedules: [sched('s1', 'med-a', ['08:00:00'])],
    logs: [log('l1', 'med-a', 's1', '08:00:00')] })),
  [{ t: '08:00:00', med: 'Metformin', status: 'given', logged: true }]);

check('moved time 08:00->09:00: dose stays recorded, no phantom unlogged slot',
  shape(computeDoseItems({ date: DATE, medications: [MED_A],
    schedules: [sched('s1', 'med-a', ['09:00:00'])],
    logs: [log('l1', 'med-a', 's1', '08:00:00')] })),
  [{ t: '09:00:00', med: 'Metformin', status: 'given', logged: true }]);

check('schedule deleted: recorded dose still surfaces',
  shape(computeDoseItems({ date: DATE, medications: [MED_A], schedules: [],
    logs: [log('l1', 'med-a', null, '08:00:00')] })),
  [{ t: '08:00:00', med: 'Metformin', status: 'given', logged: true }]);

check('twice-daily: only the matching slot is filled',
  shape(computeDoseItems({ date: DATE, medications: [MED_A],
    schedules: [sched('s1', 'med-a', ['08:00:00', '20:00:00'])],
    logs: [log('l1', 'med-a', 's1', '08:00:00')] })),
  [{ t: '08:00:00', med: 'Metformin', status: 'given', logged: true },
   { t: '20:00:00', med: 'Metformin', status: null, logged: false }]);

check('cross-medication: med-a log does not fill med-b slot',
  shape(computeDoseItems({ date: DATE, medications: [MED_A, MED_B],
    schedules: [sched('s2', 'med-b', ['09:00:00'])],
    logs: [log('l1', 'med-a', 'sX', '08:00:00')] })),
  [{ t: '08:00:00', med: 'Metformin', status: 'given', logged: true },
   { t: '09:00:00', med: 'Aspirin', status: null, logged: false }]);

check('moved dose cannot overwrite an explicit outcome',
  shape(computeDoseItems({ date: DATE, medications: [MED_A],
    schedules: [sched('s1', 'med-a', ['09:00:00'])],
    logs: [log('l1', 'med-a', 's1', '09:00:00', 'missed'),
           log('l2', 'med-a', 'sOld', '08:00:00', 'given')] })),
  [{ t: '08:00:00', med: 'Metformin', status: 'given', logged: true },
   { t: '09:00:00', med: 'Metformin', status: 'missed', logged: true }]);

const args = { date: DATE, medications: [MED_A],
  schedules: [sched('s1', 'med-a', ['09:00:00', '21:00:00'])],
  logs: [log('l2', 'med-a', 'sOld', '20:00:00'), log('l1', 'med-a', 'sOld', '08:00:00')] };
check('determinism: pairing independent of log order',
  shape(computeDoseItems(args)),
  shape(computeDoseItems({ ...args, logs: [...args.logs].reverse() })));

check('summary: moved dose counts as given, 0 remaining',
  summarizeDoses(computeDoseItems({ date: DATE, medications: [MED_A],
    schedules: [sched('s1', 'med-a', ['09:00:00'])],
    logs: [log('l1', 'med-a', 's1', '08:00:00')] })),
  { total: 1, given: 1, remaining: 0 });

fs.rmSync(OUT, { recursive: true, force: true });
console.log('');
console.log(failures === 0 ? 'check:doses - all dose-matching invariants hold.' : `${failures} FAILED`);
process.exit(failures ? 1 : 0);
