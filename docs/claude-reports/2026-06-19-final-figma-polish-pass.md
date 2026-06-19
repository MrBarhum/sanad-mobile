# Final Figma Polish Pass — Sanad Mobile

**Date:** 2026-06-19
**Goal:** Final broad copy/visual polish before the design phase is considered mostly complete. Apply the Figma-backed copy/locale alignments that earlier passes deferred (locale files were out of scope until now), and any residual visual nits — using the Figma source literally (blue→teal the only intentional deviation).
**Mode:** Edit. **No commit. No stage.** No Supabase / backend / SQL / edge-function / env / dependency / Expo-config / route-path / EAS / prebuild changes.
**Baseline:** branch `master`, working tree **clean** at start, HEAD `5529d45 style(ui): repair legacy screens to exact Figma parity` (VPA-3R). Gate `git status --short` → clean.

## Headline
The prior passes (VPA-1a / 2 / 2b / 3R) brought the app to high visual parity. This final pass is almost entirely **copy/locale parity**: **28 Figma-verbatim label/placeholder/helper/title alignments** across `ar.json` + `en.json`, a new helper key, and one Figma helper-note threaded into the invite form. Every change was first extracted by a 7-agent **live** Figma comparison, then verified by a 2-agent adversarial review (both **severity none**). Six pure-synonym/example nits and two CTA-verb variants were deliberately deferred (documented in §4). Validation is fully green.

---

## 1. Figma Make source used

| Field | Value |
|---|---|
| **Canonical link** | `https://www.figma.com/make/nIeplIvufiFjoJBZxC7zbX/Mobile-app-design-upload?t=Au75XfxmDZu83NM2-6` |
| **Form/auth screens from** | `--Copy-` file `MpgXzFWQpGYbO7x4S7HCgd` (the only Make file containing the Add*/Invite screens) |
| **MCP read?** | **Yes — live this session**, treated as the mandatory spec (not relying only on reports). |

### Exact Figma MCP resources inspected (live, `…/src/app/components/`)
`AddTaskScreen.tsx`, `AddMedicationScreen.tsx`, `AddAppointmentScreen.tsx`, `AddVisitScreen.tsx`, `AddVitalScreen.tsx`, `AddDailyLogScreen.tsx`, `InviteMemberScreen.tsx` — each read in full and compared field-by-field against the app's form/field files + locale strings (and re-spot-checked during review).
Reports read & used: the full-parity audit + the VPA-1a / VPA-2 / VPA-2b / VPA-3R reports.

---

## 2. Files changed (3)

`git diff --stat` → **3 files changed, +62 / −55**:
```
 src/features/invitations/invite-form.tsx |  1 +
 src/locales/ar.json                      | 59 +++++++++++++++-------------
 src/locales/en.json                      | 57 +++++++++++++++-------------
```
Only locale value edits (both languages), one additive key (`invitations.helpers.invitedName`), and one added `hint` prop in `invite-form.tsx`. No component logic, schema, route, dependency, or config changes.

---

## 3. Per-area summary of final fixes (all Figma-verbatim Arabic; English mirrored)

**Tasks** — `tasks.placeholders.title`: `مثال: شراء الدواء` → `مثال: شراء الدواء من الصيدلية`.

**Medications** — `fields.instructions` `تعليمات`→`تعليمات الاستخدام`; `placeholders.instructions` `مثال: بعد الأكل`→`مثال: تناوَل مع الماء`; `fields.times` `أوقات الجرعات`→`مواعيد الجرعات`; `addTime` `إضافة وقت`→`إضافة موعد جرعة`; Notes card paired — `fields.scheduleNotes` `ملاحظات الموعد`→`ملاحظات إضافية` + `placeholders.scheduleNotes` `ملاحظات إضافية`→`أي تعليمات خاصة...`.

**Appointments** — `fields.type` `النوع`→`نوع الموعد`; `placeholders.notes` `ملاحظات إضافية`→`تعليمات أو معلومات إضافية...`.

**Visits** — `addTitle` `إضافة زيارة`→`تسجيل زيارة` (screen title; CTA unchanged); `placeholders.visitorName` `مثال: أحمد`→`من سيزور؟`; `placeholders.notes` `ملاحظات إضافية`→`تفاصيل الزيارة...`; `fields.linkToMe` `ربط الزيارة بحسابي`→`ربط بحسابي`; `ownVisitNote` `ستُسجَّل الزيارة باسم حسابك`→`ستظهر هذه الزيارة في سجل حسابك`.

**Vitals** — `fields.type` `النوع`→`نوع القياس`; `fields.readingAt` `وقت القياس`→`التاريخ والوقت` (the card holds both date + time); `addTitle` `إضافة قياس`→`تسجيل قياس حيوي` (title; CTA unchanged); `placeholders.value` `مثال: 37.5`→`أدخل القيمة`; `placeholders.notes` `ملاحظات إضافية`→`مثال: بعد الطعام، في حالة الراحة...`. (BP systolic/diastolic `مثال:` placeholders kept — older-adult enrichment.)

**Daily logs** — `fields.mood` `المزاج`→`المزاج العام`; `sleepQuality` `جودة النوم`→`نوعية النوم` (AR; EN kept "Sleep quality"); `hydration` `الترطيب`→`ترطيب الجسم`; `mobility` `الحركة`→`الحركة والقدرة الجسدية`; **`painLevel` `مستوى الألم`→`مستوى الألم الملاحَظ`** (the VPA-2-deferred item — *strengthens* the observational/non-diagnostic framing).

**Invite member** — `inviteTitle` `دعوة عضو`→`دعوة عضو جديد`; `createdTitle` `الدعوة جاهزة`→`رمز الدعوة`; `fields.role` `الدور`→`الدور في الدائرة`; `fields.invitedName` `اسم الشخص (اختياري)`→`اسم مرجعي (اختياري)`; `placeholders.invitedName` `مثال: سارة — للتذكير فقط`→`مثال: ابنتي نورة`; **NEW** `helpers.invitedName` = `فقط لتذكيرك — لن يراه المدعو`, threaded into the reference-name field via `FigmaFormField`'s existing `hint` prop (one line in `invite-form.tsx`, no component change). This restores the Figma muted helper note and lets the placeholder match Figma exactly.

Already-touched screens from VPA-3R (auth sign-in/sign-up, create-circle, join-circle, recipient-profile) were re-checked and found faithful — **no further changes needed**. Home/centers/cards are the faithful `figma-*` mounts — unchanged.

---

## 4. Remaining blockers / deliberate deferrals

**Deliberately deferred (documented, not silent) — zero-UX-difference Figma synonyms/examples:** `tasks.fields.dueDate`/`dueTime` (`تاريخ الاستحقاق`/`وقت الاستحقاق` kept — clearer standalone for older adults; Figma's bare `التاريخ`/`الوقت` rely on the card header); `tasks.placeholders.description` trailing ellipsis; `medications.fields.startDate` (`تاريخ البدء`↔`تاريخ البداية` synonym); `appointments.fields.startTime` (`وقت البدء`↔`وقت البداية` synonym); `appointments.placeholders.location` example hospital name; — kept to avoid churn with no parity/UX benefit.

**CTA-verb variants — deferred for app consistency:** Figma uses mixed save-button verbs (add / record / save). The app keeps a single consistent filled-teal **"إضافة X"** across all add CTAs because the `*.add` keys are **shared** with each list's FAB + accessibility label, where "Add X" is the correct reading; swapping only vitals/daily-logs/visits to "save/record" would break those usages and split the CTA verb. The Figma "record/save" framing was instead applied to the screen **titles** (`visits.addTitle`, `vitals.addTitle`). Closing this fully would need dedicated per-form CTA keys (a small follow-up).

**Known blockers (unchanged, require out-of-scope changes):**
- **Splash** — warm-dark background + teal brand mark require `app.json` (`expo-splash-screen`) + a new splash asset (Expo config + native handoff). Not editable safely without a config/asset change → blocker.
- **Forgot-password link** (Figma sign-in) — needs a new route + auth flow. No route exists → blocker.
- **Sign-up two-step check-email screen** — would change the real Supabase signup flow; the inline check-email notice is kept instead → blocker.
- **Recipient-profile edit/view toggle** — behavioral; the app uses the `canManage` permission model → blocker.

---

## 5. No backend / infra changes

Only `src/locales/ar.json`, `src/locales/en.json`, and `src/features/invitations/invite-form.tsx` changed. **No** Supabase / backend / auth-logic / SQL / edge-function / hook / mutation / data-fetching / schema / route-path / navigation / dependency / `package.json` / Expo-config / `app.json` / `.env` / EAS / prebuild changes. Confirmed by the scope auditor (only the 3 tracked files changed; no `*.add`/`saveChanges` CTA keys touched).

## 6. Primary CTAs remain filled teal and visible

Confirmed: every add/edit form save CTA is still the body-rendered **`FigmaFooterPrimaryButton`** — full-width, 56dp, radius 12, `theme.primary` teal fill, loading-gated only (no faint/disabled state) — with its unchanged shared `*.add` / `common.saveChanges` / `invitations.create` label. The auth screens' filled-teal CTAs (from VPA-3R) are likewise untouched. No CTA component, color, label key, or placement was modified in this pass.

## 7. Validation results

| Check | Result |
|---|---|
| `node` JSON.parse (ar + en) | **OK** — both locale files parse |
| `npm run check:mojibake` | **clean** — 260 active files, no signatures (incl. the new Arabic strings + diacritics) |
| `git -c core.autocrlf=false diff --check` | **exit 0** |
| `npx tsc --noEmit` | **exit 0** (new key + invite hint typecheck cleanly) |
| `npx expo-doctor` | **21/21 checks passed** |

**Understand workflow (7 agents):** live per-entity Figma↔app comparison → 35 candidate copy deltas + 2 visual + 1 blocker. **Review workflow (2 agents): 2/2 severity `none`** — `cleanArabic`, `figmaFaithful`, `safetyPreserved`, `sharedKeysOk`, `scopeOk` all true; Arabic verbatim incl. diacritics; no safety weakening; shared keys correct in every consumer; CTAs untouched.

## 8. Android QA checklist

Test in **dark + light**, RTL/Arabic. The changes are copy-only (plus one invite helper line), so QA is reading-focused:

1. **Add Task** — title placeholder now reads "…شراء الدواء من الصيدلية"; teal "إضافة مهمة" CTA still filled/visible.
2. **Add Medication** — instructions label "تعليمات الاستخدام" + placeholder "مثال: تناوَل مع الماء"; dose-times label "مواعيد الجرعات"; add-time button "إضافة موعد جرعة"; Notes card label "ملاحظات إضافية" with placeholder "أي تعليمات خاصة..."; CTA unchanged.
3. **Add Appointment** — type label "نوع الموعد"; notes placeholder "تعليمات أو معلومات إضافية…"; CTA unchanged.
4. **Add Visit** — header "تسجيل زيارة"; visitor placeholder "من سيزور؟"; notes "تفاصيل الزيارة…"; manager link row "ربط بحسابي" + hint "ستظهر هذه الزيارة في سجل حسابك".
5. **Add Vital** — type "نوع القياس"; date/time card header "التاريخ والوقت"; header "تسجيل قياس حيوي"; value placeholder "أدخل القيمة"; notes example placeholder; BP fields unchanged.
6. **Add Daily Log** — field labels "المزاج العام / نوعية النوم / ترطيب الجسم / الحركة والقدرة الجسدية"; **pain card header "مستوى الألم الملاحَظ"**; safety banner unchanged; detail view rows still read correctly (e.g. "المزاج العام: جيد").
7. **Invite member** — title "دعوة عضو جديد"; role label "الدور في الدائرة"; reference-name label "اسم مرجعي (اختياري)" with a muted helper line "فقط لتذكيرك — لن يراه المدعو" under the input; placeholder "مثال: ابنتي نورة"; code step title "رمز الدعوة"; teal "إنشاء دعوة" CTA unchanged.
8. **Editors / detail views** — confirm the shared-key labels read correctly where reused (medication editor + detail; daily-log detail rows; visit toggle hint).
9. **Cross-cutting** — no English/Arabic mojibake; all primary CTAs filled teal; RTL intact; Western digits / LTR isolation unaffected.

**Stopping here per instructions: no commit, no stage.**
