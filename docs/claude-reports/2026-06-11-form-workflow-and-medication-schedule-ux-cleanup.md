# Form workflow & medication schedule UX cleanup

Date: 2026-06-11
Scope: client-side UX refactor only. No SQL applied, nothing deployed, nothing
committed. No database behavior changed — duplicate/overlap checks are enforced
on the client; the existing schema/RLS are untouched.

---

## 1. Summary

A system-wide pass over every create/edit form to standardize the save
workflow, plus a focused overhaul of the medication ↔ schedule UX and the
care-circle timezone selector. Three reusable building blocks were introduced
and applied consistently rather than re-implementing one-off save buttons.

Validation run at the end:

- `node` locale parse + en/ar parity: **786 = 786 keys, no orphans**
- `npx tsc --noEmit`: **exit 0**
- `npx expo export --platform web`: **exit 0 (Exported: dist)**

---

## 2. New reusable building blocks

| File | What it is |
| --- | --- |
| `src/components/form-actions.tsx` | `FormActions` (inline) and `StickyFormActions` (pinned bottom bar, safe-area aware). Primary save + optional non-destructive secondary, with inline saved/error status. Save is never mixed with destructive actions. |
| `src/hooks/use-unsaved-changes.ts` | `useUnsavedChanges(values)` → `{ dirty, markSaved, reset }`. JSON-snapshot diff against a baseline; `markSaved()` rebaselines after a successful save. |
| `src/hooks/use-navigation-guard.ts` | `useNavigationGuard(enabled, copy)` — intercepts the navigator `beforeRemove` event and prompts; `window.confirm` on web, `Alert` on native. |
| `src/components/unsaved-changes-guard.tsx` | `<UnsavedChangesGuard when={dirty} />` — drop-in wrapper over the hook with centralized `common.*` copy. |
| `src/utils/confirm.ts` | `confirmDiscard(copy, onConfirm)` — cross-platform discard confirmation used by the in-screen modals (which the navigation guard cannot intercept). |
| `src/constants/timezones.ts` | Curated IANA timezone list with localized city/country labels (MENA-weighted + common world zones) and `findTimezoneOption()`. |
| `src/components/timezone-picker.tsx` | Searchable, touch-friendly timezone selector modal. |
| `src/features/medications/schedule-validation.ts` | `duplicateTimesInDraft()` and `findScheduleConflicts()` — client duplicate/overlap detection. |
| `src/features/medications/schedule-summary.tsx` | Compact weekly summary + expandable per-day dose breakdown. |

`FormModal` gained a `submitDisabled` prop so modal submits can be disabled when
there are no changes or validation fails.

---

## 3. Save-workflow standardization

Rule applied:

- **Create** screens use a specific creation label (`<feature>.add` →
  "Add medication" / "إضافة دواء", "Add task" / "إضافة مهمة", etc.).
- **Edit** screens use the "Save changes" equivalent (`common.saveChanges` →
  Arabic **"حفظ التغييرات"**, English **"Save changes"**).
- Save sits at the logical end of the form; **long create forms use a sticky
  bottom action bar**.
- Save is **disabled when the form is pristine (no changes) or validation fails**,
  and shows a **loading spinner** while saving.
- **Dirty forms warn before leaving** (back gesture / header back / hardware
  back); modals confirm on close.
- After a successful create, navigation happens from an effect once the guard has
  released, so a successful save never trips the "unsaved changes" prompt.

### Forms audited & changed

| Area | File | Create label | Edit label | Sticky | Dirty-disable | Unsaved guard |
| --- | --- | --- | --- | --- | --- | --- |
| Recipient profile | `recipient-profile/profile-form.tsx` | — | `recipientProfile.save` ("Save changes") | inline | ✔ | ✔ |
| Emergency contacts | `emergency/contacts-manager.tsx` | `emergencyContacts.add` | `common.saveChanges` | modal | ✔ | confirm-on-close |
| Doctors | `doctors/doctors-manager.tsx` | `doctors.add` | `common.saveChanges` | modal | ✔ | confirm-on-close |
| Medication (info) | `medications/medication-editor.tsx` | — | `common.saveChanges` | inline | ✔ | ✔ |
| Medication (create) | `medications/medication-form.tsx` | `medications.add` | — | **sticky** | ✔ | ✔ |
| Dose schedule | `medications/schedule-modal-host.tsx` | `medications.addScheduleSubmit` | `medications.saveScheduleChanges` | modal | ✔ | confirm-on-close |
| Tasks | `tasks/task-form.tsx`, `tasks/task-editor.tsx` | `tasks.add` | `common.saveChanges` | sticky / inline | ✔ | ✔ |
| Appointments | `appointments/appointment-form.tsx`, `…-editor.tsx` | `appointments.add` | `common.saveChanges` | sticky / inline | ✔ | ✔ |
| Visits | `visits/visit-form.tsx`, `visit-editor.tsx` | `visits.add` | `common.saveChanges` | sticky / inline | ✔ | ✔ |
| Daily logs | `daily-logs/log-form.tsx`, `log-editor.tsx` | `dailyLogs.add` | `common.saveChanges` | sticky / inline | ✔ | ✔ |
| Vitals | `vitals/vital-form.tsx`, `vital-editor.tsx` | `vitals.add` | `common.saveChanges` | sticky / inline | ✔ | ✔ |

The previous per-feature save keys (`saveMedication`, `saveTask`,
`saveAppointment`, `saveVisit`, `saveLog`, `saveReading`) are no longer used as
primary buttons (kept in the locale files to avoid churn; verified zero code
references).

**Deliberately left as-is** (already specific, not entity create/edit):

- Notification settings → "Save settings" / "حفظ الإعدادات" (it already tracks a
  saved/loading state; "Save settings" is clearer than a generic "Save changes"
  on a preferences surface).
- Care-circle onboarding → "Create care circle"; invitations → "Create
  invitation"; join circle → "Join circle"; member role modal → "Save role
  change". These are already specific, appropriate labels.

---

## 4. Medication ↔ schedule boundaries

`medication-editor.tsx` is now two clearly separated sections:

- **A. Medication information** (`medications.medicationInfoTitle`) — name,
  dosage, form, instructions, with-food; its own edit form ending in **"حفظ
  التغييرات"**.
- **B. Dose schedules** (`medications.dosesSectionTitle`) — the weekly summary,
  the schedule cards, and a medication-level **"إضافة جدول جرعات جديد"**
  (`addScheduleAtMed`).

Label fixes (the ambiguous "إضافة موعد" is gone for schedules):

- Add-schedule modal title: **"إضافة جدول جرعات"** (was "إضافة موعد").
- Edit-schedule modal title: **"تعديل جدول الجرعات"**.
- Add-schedule submit: **"إضافة جدول جرعات"**; edit submit: **"حفظ تغييرات جدول
  الجرعات"** (`saveScheduleChanges`).
- Within a schedule, the add-time button is now **"إضافة وقت آخر لهذا الجدول"**
  (`addTimeToSchedule`, was "إضافة وقت").

Helper copy added:

- Schedule section intro explaining multiple groups (`scheduleGroupsHelp`): a
  medication can have every-day-at-08:00 **plus** Sun/Tue/Thu-at-23:00.
- Inside a schedule: "Add another time when the days are the same"
  (`helpSameDays`).
- At medication level: "Create a new schedule when the days are different"
  (`helpDifferentDays`).

Each schedule card now shows: **schedule number** ("الجدول ١"), selected **days**,
all **times** (sorted), **start/end** range, and an explicit **active / stopped**
state badge (`scheduleActiveLabel` / `scheduleStoppedLabel`).

---

## 5. Duplicate & overlap validation (client only)

`schedule-validation.ts`:

- **Duplicate time within a schedule** — flagged inline under the times list and
  blocks submit (`errors.duplicateTime`).
- **Same weekday + time in another active schedule** — blocks submit with a
  specific message naming the day and time (`errors.conflict`), checked against
  all the medication's schedules, excluding the one being edited, ignoring
  stopped schedules.
- No day / no time / end-before-start were already enforced by `scheduleSchema`
  and remain.

Legitimate combinations are **not** rejected: every-day-at-08:00 together with
Sun/Tue/Thu-at-23:00 is fine. Schedules overlapping on days but at different
times are valid — only an exact weekday+time collision is blocked. No DB changes
were needed for this.

---

## 6. Schedule summary

`schedule-summary.tsx`, shown at the top of the Dose schedules section:

- **Compact weekly view** — one line per distinct day-set with its times, e.g.
  "كل يوم: 08:00" and "الأحد، الثلاثاء، الخميس: 23:00" (times unioned across
  schedules that share a day-set).
- **Expandable per-day view** — Sunday → 08:00, 23:00 / Monday → 08:00 … so it's
  immediately obvious how many doses fall on each day. Stopped schedules are
  excluded.

---

## 7. Timezone selector

`circle-timezone-card.tsx` no longer uses a raw IANA text field. A manager taps
**"تغيير المنطقة الزمنية"** to open `TimezonePicker`:

- Searchable by city or country in **either language** or by raw IANA id.
- Each row shows a localized **city, country** label with the **IANA id** as a
  secondary line.
- A **"use this device's timezone"** shortcut is pinned at the top.
- Selecting a zone shows a **confirmation** with the from→to change **and a
  reminder-impact line** ("ستصل تذكيرات الأدوية والمهام بالتوقيت المحلي في …").
- **Only the IANA identifier is stored**; the existing `set_circle_timezone` RPC
  still validates server-side and remains authoritative. The card also shows a
  friendly label for the current zone when it's in the curated list.

---

## 8. Files

New: `form-actions.tsx`, `unsaved-changes-guard.tsx`, `timezone-picker.tsx`,
`use-unsaved-changes.ts`, `use-navigation-guard.ts`, `utils/confirm.ts`,
`constants/timezones.ts`, `medications/schedule-validation.ts`,
`medications/schedule-summary.tsx`.

Modified (this task): `form-modal.tsx`, both `locales/*.json`, the medication
trio (`medication-form`, `medication-editor`, `schedule-fields`,
`schedule-modal-host`), `circle-timezone-card.tsx`, and every create/edit form
listed in §3.

> Note: several other files appear in `git status` (notifications, collaboration,
> `supabase.ts`, `config.toml`, layout/account screens). Those were already
> uncommitted before this task and were **not** touched here.

Nothing was committed, deployed, or applied to the database, per instructions.
