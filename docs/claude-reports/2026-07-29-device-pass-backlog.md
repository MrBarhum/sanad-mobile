# Device pass — everything never exercised on hardware, Milestones 7 · 8 · 9

**Compiled:** 2026-07-29 · for a single consolidated device pass.

This repo has **zero test infrastructure and zero CI** (`package.json` has no `test`
script; no jest, no detox/maestro, no `.github/`). Everything below is
device-verify-or-nothing — `tsc`, lint and the probe suite cannot reach any of it.

Two distinct kinds of item, kept separate because they need different attention:

- **✅ CONFIRM** — changed and verified as far as it can be off-device. You are
  checking it works in the real app.
- **⚠️ CHARACTERISE** — a known-open audit finding, **not fixed**. You are
  confirming how bad it actually is on hardware, to rank it.

---

## Setup — this is the expensive part, do it once

Production has **zero caregiver members**, so most of Milestone 8 is unreachable
until you create one.

1. **Device A** — a manager account (admin) of a circle that has ≥1 medication with
   a schedule, ≥1 task, ≥1 emergency contact, ≥1 doctor.
2. **Device B** (or a second account) — accept a caregiver invite:
   Explore → دائرة الرعاية → دائرة الرعاية → + → «مقدّم رعاية».
   Then from Device A make that account **responsible for ≥1 medication** and
   **assign it ≥1 task**. Without both, her screen is empty and proves nothing.
3. **A third account** as a `family_member` who is **NOT** responsible for that
   medication — needed for the dose-photo access check and the scoping checks.
4. **A control circle with NO caregiver** — Milestone 8's first product rule is
   that such a circle is byte-for-byte unchanged.
5. **Two throwaway accounts** for deletion: one owning a circle **with** another
   active member, one owning a circle alone.
6. At least one number stored **with Arabic-Indic digits** (`٠٥٥١٢٣٤٥٦٧`) on an
   emergency contact, and be ready to type vitals on an **Arabic keyboard**.

Set the OS font scale to **130%** and **200%** for the layout-sensitive rows, and
run each screen in **light and dark**.

---

## Milestone 9 — applied today, nothing device-tested

### ✅ A1 · the EXECUTE revoke — highest priority

30 functions lost `authenticated` EXECUTE. The probes proved **no role's visible
data moved** (read matrix byte-identical) and that the cron pipeline still returns
HTTP 200. They cannot prove **no screen throws**. Exercise one full path per role:

| Role | Path |
|---|---|
| admin / primary_caregiver | Home · log a dose · Members · send an invite · revoke an invite |
| family_member | Home · log a dose on a medication they are responsible for · complete a task |
| caregiver (hired) | her Today screen · record a dose |
| remote_member | Home · Care Pulse feed |

Then **push**: confirm a medication reminder actually arrives on a device. A1
touched the notification functions more than anything else. The pipeline was
observed returning 200 post-revoke, but **no notification was seen delivered** —
nothing was due in the window.

Also worth one pass: **sign-up** (fires `handle_new_user`, whose EXECUTE was
revoked — PostgreSQL checks trigger EXECUTE at `CREATE TRIGGER` time, not fire
time, and Milestone 7 probed that empirically, but sign-up is cheap to confirm).

### ✅ B1 · dose authorship

- Record a dose → open the caregiver weekly summary → note the recorded time.
- **Correct** that dose (change the outcome) from a manager account → the
  **recorded time must NOT move**, and the summary must not re-classify it as
  «متأخّرة» because of the correction.
- Nothing in the UI surfaces `corrected_by` yet — that is expected; the columns are
  populated but not displayed.

### ✅ B2 · Arabic-Indic digits — two things that were silently dead

- **Vitals**: switch to the **Arabic keyboard**, enter blood pressure (`١٢٠/٨٠`)
  and a temperature with the Arabic decimal separator (`٣٦٫٥`). Both were
  previously impossible — `Number('١٢٠')` is `NaN`.
- **Emergency call**: on a contact whose number uses Arabic-Indic digits, tap
  call. Previously this built `tel:` with **nothing after it** and the button did
  nothing at all. Test it on the emergency card, the contacts manager, the doctors
  list, and any ContactCard — all four shared the same defect.

### ✅ B3 · schedule-time ↔ dose-log matching

1. Log a dose at 08:00.
2. From a manager account, **edit that schedule's time to 09:00**.
3. Reopen today's doses: the dose must still show as **recorded**, and there must
   be **no second, unlogged 09:00 slot**. That phantom slot was the double-dose
   risk.
4. Open the caregiver weekly summary for that week: the dose must be counted
   **once**, with no fabricated «لم تُسجَّل».
5. Also: delete a schedule that has a logged dose today — the recorded dose must
   still appear rather than vanishing.

### ✅ A3 · `ios.bundleIdentifier`

Only relevant if an iOS build is attempted. Resolves correctly via
`npx expo config --type public`; nothing to check in-app.

---

## Milestone 8 — the hired caregiver, entirely device-unverified

Per its own report, these screens were **never drawn in the Dar identity** — verify
behaviour and law compliance; treat visual polish as pending.

### Do this FIRST — the regression control

Open the circle with **no caregiver** and confirm the app is exactly as before:
Explore rows unchanged and in order (no «ملخّص مقدّم الرعاية»), Members legend
shows three rows, no «واجهة مقدّم الرعاية» chip, invite form identical for the four
family roles, appointment and visit assignee pickers do **not** offer a caregiver,
Home/tasks/medications/Pulse unchanged, tab bar still 3 tabs with Home right-most.

### The caregiver herself

- Invite flow: fifth role card «مقدّم رعاية» last; selecting it reveals three
  disclosure cards; «الموقع الجغرافي» is the **first** row of «ما لا يسجّله
  التطبيق»; gold appears exactly **once** on the screen.
- Her shell: she lands on her own Today screen, not the family tabs.
- Recording a dose from her screen; her task list.
- The family's weekly summary of her week — counts, and that it does not assert
  anything untrue about her.
- ⚠️ **CHARACTERISE — she is locked to `circles[0]`.** Her shell has no circle
  switcher and the only switcher lives on family Home, which she is bounced away
  from. An account that is a caregiver in one circle **and a family member in
  another** appears unable to reach the second at all. Confirm and rank.
- ⚠️ **CHARACTERISE — she cannot leave a circle or delete her account.** Both
  paths live behind screens her role cannot reach. This is a Play Store
  account-deletion problem, not just UX.
- ⚠️ **CHARACTERISE — a failed task action renders its alert behind the still-open
  sheet.** M8's own report flagged this as needing a device to judge.

### Dose photo — expect it to be OFF

`expo-image-picker` is deliberately **not a dependency**, so capture is inert in
every shippable build. Confirm the field shows the calm «غير متاح» note and **not**
a camera button that does nothing. This is the headline Milestone 8 feature and it
is disabled at launch — worth seeing with your own eyes.

---

## Milestone 7 — from its own device checklist, still outstanding

- **Password recovery (A1):** forgot password → 6-digit code arrives → correct code
  works → wrong code shows the distinct error → expired code shows its own error →
  resend respects the 60s countdown → new password signs in. Then the **legacy
  link** path, both **cold start** and **app already open**.
- **A3:** cold start, tab navigation, one push notification **with its action
  buttons** still rendering.
- **A4:** PDF generation on **≥2 Android devices + one iPhone**. Arabic glyphs
  join; it is Cairo not system Arabic; exactly one page; text selects out as real
  Unicode; the share sheet offers the PDF.
- **A5:** dose-photo access control — a **non-member** cannot fetch the signed URL,
  and a `family_member` who is **not responsible** for that medication cannot
  either. (Capture itself is inert; this tests the read path on existing objects.)
- **A8:** a `family_member` successfully claims a task.
- **A10 account deletion:** (a) an account owning a circle **with another active
  member** is refused and shown the transfer path; (b) after transferring
  ownership, deletion succeeds; (c) a solo account deletes and lands on sign-in;
  (d) the circle's data is actually gone.

---

## Cross-cutting — open audit findings only a device settles

All ⚠️ **CHARACTERISE**. None of these is fixed.

| Finding | What to do |
|---|---|
| **Query cache survives sign-out** (`query-provider.tsx:5`) | Sign out on Device A, sign in as a **different** account within 5 minutes, and watch the first frame of Home/medications. Looking for the previous user's circle data appearing before the refetch. Worst case: the hired caregiver signing in after a family member. |
| **Cold-start notification tap** (`notifications/hooks.ts:285`) | Force-quit the app, wait for a medication reminder, tap it. It is expected to land on the **notifications inbox** instead of the dose. Confirm, and note whether it is every time or a race. |
| **Expo-blue splash flash** (`animated-icon.tsx:60`, `app.json`) | Cold start and watch the first ~600ms. Full-screen `#208AEF` over a sand/green app. Also check the launcher icon and the Android adaptive icon — both are still the Expo chevron. |
| **First-run RTL on an LTR device** (`i18n/rtl.ts`) | Install fresh on a device whose **system language is English**. The first session is expected to render LTR; chevrons are hardcoded RTL-correct so they will point the wrong way that session only. Confirm a restart fixes it. |
| **Home asserts a quiet day while loading** (`figma-home.tsx:134`) | On a slow/throttled connection, open Home and watch whether it says «لا جرعات مجدولة اليوم» before the data lands. Also on every circle switch. |
| **Silent task failures** (`figma-tasks.tsx:172`, `task-editor.tsx:579`) | Put the device in airplane mode, then complete/cancel a task and delete a task. Expected: spinner stops, nothing said. |
| **Unassigned medications hidden from family members** (`figma-home.tsx:139`) | Create a medication with **no responsible person**, then open Home as a `family_member`. Expected: it is hidden and the empty state claims a quiet day. Managers still see it and are still notified, so this is a copy/trust issue — judge how misleading it reads. |

---

## Standing guard — run before shipping

```
grep -rnE "style=\{\(\{\s*pressed" src/
```

Must return **only** `app-tabs.web.tsx`. A function-form `Pressable` style is
dropped by the NativeWind css-interop on Android and is invisible to `tsc`, web,
and every check in this repo. It has been reintroduced twice.

---

## Not covered by any device pass

- **The A2 migration fix** (policy-count assertion) only affects a database built
  **from scratch**. It cannot be exercised on a device or on the existing project.
  Prove it with `supabase db reset` against a local stack when Docker is available.
- **`check:grants`** needs a linked project, not a device.
