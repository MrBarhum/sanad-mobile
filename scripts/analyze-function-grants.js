/**
 * Milestone 9 · A1 — derive which `public` functions may lose `authenticated`
 * EXECUTE, from ACTUAL CALLERS rather than from names.
 *
 * Read-only analysis over the repo. Emits a CSV + a human table classifying every
 * function in `public` by every route through which a caller could need EXECUTE:
 *
 *   client    — a `supabase.rpc('fn')` in src/ or lib/ (runs as `authenticated`)
 *   edgeUser  — an rpc() in supabase/functions/ issued on the USER-scoped client
 *   edgeSvc   — an rpc() in supabase/functions/ issued on the SERVICE client
 *   policy    — referenced inside a `create policy` expression. RLS predicates are
 *               evaluated as the QUERYING role, so `authenticated` needs EXECUTE or
 *               every query on that table fails. This is the regression trap.
 *   trigger   — used as `execute function` on a trigger. Postgres does NOT check
 *               EXECUTE on trigger functions, so this alone never requires a grant.
 *   inFn      — called from inside another function's body. Only matters when the
 *               OUTER function is SECURITY INVOKER; a DEFINER body runs as owner.
 *   default   — used in a column DEFAULT / CHECK / generated expression, evaluated
 *               as the writing role.
 *
 * Nothing here decides on its own — it produces the evidence a human (and the
 * verification pass) rules on.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

const files = fs
  .readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const sqlByFile = new Map();
for (const f of files) sqlByFile.set(f, fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));

// The storage.objects policies for the dose-proof bucket are hand-applied and live
// OUTSIDE supabase/migrations. They call public.storage_path_uuid(),
// can_view_all_operational(), is_circle_member() and is_responsible_for_medication(),
// and a storage policy is evaluated as the QUERYING role — so these count as
// `authenticated` callers exactly like an in-migration policy does. Omitting this
// directory is how you revoke EXECUTE on storage_path_uuid and break every dose
// photo read. Scanned for REFERENCES only; never for declarations.
const DEPLOY = path.join(ROOT, 'docs', 'deployment');
const deployFiles = fs.existsSync(DEPLOY)
  ? fs.readdirSync(DEPLOY).filter((f) => f.endsWith('.sql')).sort()
  : [];
const deploySqlByFile = new Map();
for (const f of deployFiles) {
  deploySqlByFile.set('deployment/' + f, fs.readFileSync(path.join(DEPLOY, f), 'utf8'));
}

const allSql = files.map((f) => sqlByFile.get(f)).join('\n');

/**
 * Strip SQL comments. Used ONLY when locating function DECLARATIONS: the H1
 * migration discusses `create function public.foo()` in prose, which a naive scan
 * reports as a real function.
 *
 * Deliberately NOT used when locating REFERENCES. Over-counting a reference keeps
 * a function OUT of the revoke list (safe); under-counting one would revoke a
 * grant something still needs (a regression). The asymmetry is the point.
 */
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// 1. Every function declared in `public`, with the security mode of its LAST
//    definition (a later migration can redefine it).
// ---------------------------------------------------------------------------
const fnRe = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi;
const fns = new Map(); // name -> { name, security, definedIn: [] }

for (const f of files) {
  const sql = stripComments(sqlByFile.get(f));
  let m;
  const re = new RegExp(fnRe.source, 'gi');
  while ((m = re.exec(sql))) {
    const name = m[1].toLowerCase();
    // Look ahead to the body start for `security definer` / `security invoker`.
    const tail = sql.slice(m.index, m.index + 2000).toLowerCase();
    const bodyStart = tail.search(/\bas\s*\$\$|\bas\s*\$function\$/);
    const head = bodyStart > 0 ? tail.slice(0, bodyStart) : tail;
    const security = /security\s+definer/.test(head)
      ? 'definer'
      : /security\s+invoker/.test(head)
        ? 'invoker'
        : 'invoker(default)';
    const prev = fns.get(name) || { name, definedIn: [] };
    prev.security = security; // last definition wins
    prev.definedIn.push(f);
    fns.set(name, prev);
  }
}

// ---------------------------------------------------------------------------
// 2. Callers from application code.
// ---------------------------------------------------------------------------
function rpcNamesIn(dir, filter) {
  const out = new Map(); // fn -> [ "file:line" ]
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const re = /(\w+)?\s*\.rpc\(\s*'([a-z0-9_]+)'/g;
        let m;
        while ((m = re.exec(line))) {
          const receiver = m[1] || '';
          const fn = m[2];
          if (filter && !filter(receiver, line)) continue;
          const rel = path.relative(ROOT, p).replace(/\\/g, '/');
          if (!out.has(fn)) out.set(fn, []);
          out.get(fn).push(rel + ':' + (i + 1) + (receiver ? '  [' + receiver + ']' : ''));
        }
      });
    }
  })(dir);
  return out;
}

const clientCalls = rpcNamesIn(path.join(ROOT, 'src'));
for (const [k, v] of rpcNamesIn(path.join(ROOT, 'lib'))) {
  if (!clientCalls.has(k)) clientCalls.set(k, []);
  clientCalls.get(k).push(...v);
}

// In edge functions, distinguish the user-scoped client from the service client.
// `asUser` / `userClient(...)` => runs as `authenticated`.
const edgeAll = rpcNamesIn(path.join(ROOT, 'supabase', 'functions'));
const edgeUser = new Map();
const edgeSvc = new Map();
for (const [fn, sites] of edgeAll) {
  for (const s of sites) {
    const isUser = /\[(asUser|userClient|user)\]/i.test(s);
    const target = isUser ? edgeUser : edgeSvc;
    if (!target.has(fn)) target.set(fn, []);
    target.get(fn).push(s);
  }
}

// ---------------------------------------------------------------------------
// 3. References inside SQL: policies, triggers, other function bodies, defaults.
// ---------------------------------------------------------------------------
// Slice the corpus into `create policy ...;` statements and function bodies so a
// reference can be attributed to the construct that contains it.
function sliceBlocks(sql, startRe, endToken) {
  const blocks = [];
  const re = new RegExp(startRe.source, 'gi');
  let m;
  while ((m = re.exec(sql))) {
    const start = m.index;
    const end = sql.indexOf(endToken, start);
    blocks.push(sql.slice(start, end === -1 ? sql.length : end + endToken.length));
  }
  return blocks;
}

const policyBlocks = [];
const fnBodyBlocks = []; // { owner, body }

// Hand-applied storage policies count as `authenticated` call sites.
for (const [label, sql] of deploySqlByFile) {
  for (const b of sliceBlocks(sql, /create\s+policy\b/, ';')) {
    policyBlocks.push({ file: label, sql: b });
  }
}

for (const f of files) {
  const sql = sqlByFile.get(f);
  for (const b of sliceBlocks(sql, /create\s+policy\b/, ';')) policyBlocks.push({ file: f, sql: b });
  // function bodies: from `create function` to the closing `$$;`
  const re = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/gi;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[1].toLowerCase();
    const from = m.index;
    const end = sql.indexOf('$$;', from);
    fnBodyBlocks.push({ file: f, owner: name, sql: sql.slice(from, end === -1 ? from + 6000 : end) });
  }
}

const triggerSql = sliceBlocks(allSql, /create\s+trigger\b/, ';').join('\n').toLowerCase();
const defaultSql = (allSql.match(/^.*\b(default|check)\s*\(.*$/gim) || []).join('\n').toLowerCase();

function refCount(name, blocks) {
  const hits = [];
  const re = new RegExp('\\bpublic\\.' + name + '\\s*\\(', 'i');
  for (const b of blocks) if (re.test(b.sql)) hits.push(b.file + (b.owner ? ':' + b.owner : ''));
  return hits;
}

// ---------------------------------------------------------------------------
// 4. Current explicit grants written in the repo.
// ---------------------------------------------------------------------------
function grantsFor(name) {
  const g = new Set();
  const re = new RegExp('grant\\s+execute\\s+on\\s+function\\s+public\\.' + name + '\\s*\\([^)]*\\)\\s*to\\s+([a-z_, ]+)', 'gi');
  let m;
  while ((m = re.exec(allSql))) m[1].split(',').forEach((r) => g.add(r.trim()));
  return [...g];
}

// ---------------------------------------------------------------------------
// 5. Emit.
// ---------------------------------------------------------------------------
const rows = [];
for (const name of [...fns.keys()].sort()) {
  const f = fns.get(name);
  const inPolicy = refCount(name, policyBlocks);
  const inFn = refCount(name, fnBodyBlocks).filter((h) => !h.endsWith(':' + name));
  const isTrigger = new RegExp('\\bpublic\\.' + name + '\\s*\\(', 'i').test(triggerSql);
  const inDefault = new RegExp('\\bpublic\\.' + name + '\\s*\\(', 'i').test(defaultSql);
  rows.push({
    name,
    security: f.security,
    client: (clientCalls.get(name) || []).length,
    edgeUser: (edgeUser.get(name) || []).length,
    edgeSvc: (edgeSvc.get(name) || []).length,
    policy: inPolicy.length,
    inFn: inFn.length,
    trigger: isTrigger ? 1 : 0,
    dflt: inDefault ? 1 : 0,
    grants: grantsFor(name).join('|'),
    policyFiles: [...new Set(inPolicy)].slice(0, 4).join(' '),
    inFnOwners: [...new Set(inFn.map((x) => x.split(':')[1]))].slice(0, 6).join(' '),
    clientSites: (clientCalls.get(name) || []).slice(0, 2).join(' '),
    edgeSites: [...(edgeUser.get(name) || []), ...(edgeSvc.get(name) || [])].slice(0, 2).join(' '),
  });
}

const csv = [
  'function,security,client,edgeUser,edgeSvc,policy,inFn,trigger,default,grants,policy_files,called_inside,client_sites,edge_sites',
  ...rows.map((r) =>
    [r.name, r.security, r.client, r.edgeUser, r.edgeSvc, r.policy, r.inFn, r.trigger, r.dflt,
     r.grants, r.policyFiles, r.inFnOwners, r.clientSites, r.edgeSites]
      .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
      .join(','),
  ),
].join('\n');

const outDir = path.join(ROOT, 'docs', 'claude-reports', 'milestone-9-probes');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'function-caller-matrix.csv'), csv, 'utf8');

const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad('function', 42) + pad('sec', 16) + pad('cli', 4) + pad('eUsr', 5) + pad('eSvc', 5) +
  pad('pol', 4) + pad('inFn', 5) + pad('trg', 4) + pad('dflt', 5) + 'grants',
);
console.log('-'.repeat(120));
for (const r of rows) {
  console.log(
    pad(r.name, 42) + pad(r.security, 16) + pad(r.client, 4) + pad(r.edgeUser, 5) +
    pad(r.edgeSvc, 5) + pad(r.policy, 4) + pad(r.inFn, 5) + pad(r.trigger, 4) +
    pad(r.dflt, 5) + r.grants,
  );
}

const candidates = rows.filter(
  (r) => r.client === 0 && r.edgeUser === 0 && r.policy === 0 && r.dflt === 0,
);
console.log('\n\nTOTAL functions: ' + rows.length);
console.log('CANDIDATES for losing `authenticated` EXECUTE (no client / no user-scoped edge / no policy / no default): ' + candidates.length);
for (const c of candidates) {
  console.log('  - ' + pad(c.name, 42) + ' inFn=' + c.inFn + ' trigger=' + c.trigger +
    (c.inFnOwners ? '  called inside: ' + c.inFnOwners : ''));
}
console.log('\nCSV -> docs/claude-reports/milestone-9-probes/function-caller-matrix.csv');
