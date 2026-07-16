# Milestone 4 — Backend Apply Runbook (maintainer-run)

Everything below is **run by the maintainer**, in this order. Nothing here was auto-applied. Project ref: `qccgshanmoeybagxwvcs`. Never inline the cron secret — it lives in Supabase Vault and is referenced by name, exactly like the existing jobs.

> **Ordering matters.** Migrations must precede the client build that writes the new columns (`cancelled_by`, `missed_dose_grace_minutes`) and precede the edge-function deploys that read them.

---

## 1) Apply migrations (filename order)

New this milestone (already timestamp-ordered so `db push` applies them correctly):
1. `20260715120000_add_cancelled_by_to_care_tasks.sql` — adds `care_tasks.cancelled_by` + constraint + trigger update.
2. `20260715130000_create_list_care_activity.sql` — the Care Pulse RPC (**reads `cancelled_by`, so it must run after #1**).
3. `20260715140000_create_daily_summary_recipients.sql` — `daily_summary` type + digest recipient resolver.
4. `20260715150000_add_missed_dose_grace.sql` — `care_circles.missed_dose_grace_minutes` + manager-only setter.

```
supabase db push --project-ref qccgshanmoeybagxwvcs
```

Verify (read-only): confirm the column exists, the RPCs are present, and the enum value was added:
```
-- in the SQL editor / psql
select column_name from information_schema.columns
  where table_schema='public' and table_name='care_tasks' and column_name='cancelled_by';
select proname from pg_proc where proname in
  ('list_care_activity','daily_summary_recipients','set_missed_dose_grace_minutes');
select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
  where t.typname='notification_type' and enumlabel='daily_summary';
```

**Only after the migrations are live**, build/ship the client (it writes `cancelled_by`, reads the grace column, and calls the new RPCs — an un-migrated DB would error).

---

## 2) Deploy edge functions

- **New**: `send-daily-summaries` (B2 digest).
- **Modified**: `check-missed-doses` (B3 per-circle grace + tier-3).

```
supabase functions deploy send-daily-summaries --project-ref qccgshanmoeybagxwvcs
supabase functions deploy check-missed-doses   --project-ref qccgshanmoeybagxwvcs
```

These require the same secrets the existing functions use (`NOTIFICATIONS_CRON_SECRET`, service role) — already configured; no new secret is introduced. Confirm they deployed:
```
supabase functions list --project-ref qccgshanmoeybagxwvcs
```

---

## 3) Schedule the cron jobs (SQL)

Two jobs to add. **Mirror the existing `sanad-enqueue-due-reminders` job definition** (see the Phase-2F-10L/10M records) — copy its `cron.schedule(...)` call verbatim, changing only the **job name**, the **schedule**, and the **function URL path**. The job body pulls the cron secret from Vault by name; do **not** paste the secret into the SQL.

| New job name | Schedule | Function |
|---|---|---|
| `sanad-check-missed-doses` | `*/15 * * * *` (every 15 min) | `check-missed-doses` — **resolves P1-9** (this job was never scheduled) |
| `sanad-send-daily-summaries` | `0 * * * *` (hourly, on the hour) | `send-daily-summaries` — the function itself fires only when a circle's local time is 20:00 |

After scheduling, confirm (never print the command body / secret):
```
select jobname, schedule, active from cron.job
  where jobname in ('sanad-check-missed-doses','sanad-send-daily-summaries');
```
`pg_cron` + `pg_net` must be enabled (they already are for the 3 existing jobs).

---

## 4) Supabase Auth — redirect URL allow-list (A6 password reset)

Add the reset-password redirect targets to **Authentication → URL Configuration → Redirect URLs**, or the recovery links won't open:
- Native deep link: `sanadmobile://reset-password`
- Web (only if the web build is hosted): `https://<your-web-origin>/reset-password`

(The WhatsApp **join** deep link `sanadmobile://join-circle?code=…` is a plain app link — it does **not** need Auth allow-listing.)

---

## 5) Post-apply smoke checks
- Open `/pulse` in the app → the feed loads (not the "not enabled" state).
- Managers: notification-settings shows the missed-dose grace stepper; change it and confirm it persists.
- Trigger a manual run of `check-missed-doses` and `send-daily-summaries` (invoke with the cron secret header) and confirm `ok:true` in the logs — no secrets in output.
- Full device QA per `2026-07-14-milestone-4-device-qa-checklist.md`.
