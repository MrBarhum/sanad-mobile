# VPA-2 — Add/Edit/Detail Form Screens (Figma MCP parity)

**Date:** 2026-06-19
**Phase:** VPA-2 (add/edit/detail form screens + their form-specific field layouts only).
**Mode:** Edit. Visual-only. **No commit. No stage.** No EAS / prebuild / Supabase / backend / schema / auth / SQL / edge-function / env / dependency / Expo-config / navigation / data-fetching changes.
**Baseline:** branch `master`, working tree **clean** at start, HEAD `799d0d6 style(ui): align shared primitives with Figma MCP` (VPA-1a, pushed).

## Headline outcome
**No in-scope source edits were required.** Every add-form in scope is already a faithful layout/visual match to its canonical Figma design (the porting was completed by the earlier `feat(ui): apply Figma form parity` / `rebuild medication and vital forms from Figma` commits and finished off by VPA-1a's shared-primitive geometry pass). Every *remaining* mismatch falls squarely on a VPA-2 guardrail — a broad refactor, a shared primitive, a locale file outside the allowed set, or a data-model difference — i.e. exactly the cases the task says to **report as a blocker rather than edit**. They are inventoried in §4 with a recommended VPA-3 scope.

This was verified two ways: a 7-agent MCP compare (one per entity, live Figma vs current app files), then an independent hand-check of the three richest cases (Tasks, Visits, DailyLogs) against the live Figma source.

---

## 1. Figma Make source used

| Field | Value |
|---|---|
| **Canonical link (this task)** | `https://www.figma.com/make/nIeplIvufiFjoJBZxC7zbX/Mobile-app-design-upload?t=Au75XfxmDZu83NM2-6` |
| **Form designs read from** | `MpgXzFWQpGYbO7x4S7HCgd` (the `--Copy-` sibling) |
| **MCP read?** | **Yes — live this session** (`get_design_context` 0:1 + `ReadMcpResourceTool`). |

> **Why two files.** The canonical `nIeplIvufiFjoJBZxC7zbX` contains only the center/list screens — it has **no `Add*` form screens** (confirmed again this session and in the VPA-1a report). The actual form designs exist only in the `--Copy-` file `MpgXzFWQpGYbO7x4S7HCgd`, which the required audit inspected. Per the task ("don't rely only on old reports if MCP can inspect the source"), the `--Copy-` `Add*` screens were read **live via MCP** and used as the **layout/structure/copy** reference, while the canonical teal+Cairo+warm design system (already applied in-app) governs palette/type. The `--Copy-` screens hard-code blue `#2F6FD0` + IBM Plex; those are intentionally overridden in-app and are **not** treated as deltas.

### Figma MCP resources/screens inspected
- Form designs (`file://figma/make/source/MpgXzFWQpGYbO7x4S7HCgd/src/app/components/`): `AddTaskScreen.tsx`, `AddMedicationScreen.tsx`, `AddAppointmentScreen.tsx`, `AddVisitScreen.tsx`, `AddVitalScreen.tsx`, `AddDailyLogScreen.tsx`, `InviteMemberScreen.tsx` (read in full; `AddTask`/`AddVisit`/`AddDailyLog` hand-verified by the orchestrator).
- Design system context carried from VPA-1a: `theme.css` tokens, `ui/button|card|input` (radius 12 buttons, cards 16, 20px gutter, sunken inputs).
- Required reports read & used: `docs/claude-reports/2026-06-19-figma-mcp-full-visual-parity-audit.md`, `docs/claude-reports/2026-06-19-vpa-1a-shared-primitives-mcp.md`.

### App files inspected (all 16 allowed, + context)
`tasks/{task-form,task-editor}`, `medications/{medication-form,medication-editor}`, `appointments/{appointment-form,appointment-editor,figma-appointment-fields}`, `visits/{visit-form,visit-editor,figma-visit-fields}`, `vitals/{vital-form,vital-editor}`, `daily-logs/{log-form,log-editor,figma-daily-log-fields}`, `invitations/invite-form`; context: `figma-form-screen.tsx`, `figma-schedule-fields.tsx`, `figma-vital-fields.tsx`, the `new.tsx` routes, schemas, locales.

---

## 2. Files changed

**None.** `git diff --stat` is empty; `git status --short` shows only this untracked report. No source, schema, route, locale, or config file was modified or staged.

---

## 3. Per-screen parity summary (what was compared, what matches, what's blocked)

| Entity | Add form | Edit screen | In-scope visual mismatch? |
|---|---|---|---|
| **Tasks** | `task-form.tsx` — **faithful** ✅ (Main-info card Title→Description→Priority, `الموعد النهائي` date(2):time(1) card, assignee card; +Category & Notes = intentional Sanad enrichments) | `task-editor.tsx` — **legacy** `Screen`+`FormActions`+`OptionSelect`+RN `Switch` | **None fixable in scope.** Editor port = broad refactor; priority chip *shape* = shared `FigmaChipSelect`; title placeholder copy = locale. |
| **Medications** | `medication-form.tsx` — **faithful** ✅ (info card name/dosage/form/instructions + with-food toggle → schedule card → notes card; schedule body lives in out-of-scope `figma-schedule-fields.tsx`, already matches) | `medication-editor.tsx` — **legacy** `Screen`+`Section`+`Surface`+per-section `FormActions` | **None fixable in scope.** Editor port = broad refactor **with no Figma edit design to port toward**; label/placeholder copy = *shared* locale keys reused by out-of-scope files. |
| **Appointments** | `appointment-form.tsx` + `figma-appointment-fields.tsx` — **faithful** ✅ (title+type card, `التاريخ والوقت` date+start/end row, location+doctor card, notes card) | `appointment-editor.tsx` — **legacy** `Screen`+`FormActions`+old `AppointmentFieldset` | **None fixable in scope.** Editor port = broad refactor; CTA/label copy = locale; type taxonomy = real schema (canonical, keep). |
| **Visits** | `visit-form.tsx` + `figma-visit-fields.tsx` — **faithful** ✅ (single card: visitor→date→time→notes→link toggle w/ divider) | `visit-editor.tsx` — **legacy** `Screen`+`FormActions`+old `VisitFieldset` | **None fixable in scope.** Design's single date(2)+time(1) row can't be matched without dropping the app's two **optional** start/end times (data model); editor port = broad refactor; placeholder copy = locale. |
| **Vitals** | `vital-form.tsx` — **faithful** ✅ | `vital-editor.tsx` — **ported** ✅ (`FigmaFormScreen`, shares `FigmaVitalFields`, body CTA) | **None fixable in scope.** Residual date/time card label sits in out-of-scope `figma-vital-fields.tsx`; add-title copy routes through a shared route-layout i18n key. |
| **DailyLogs** | `log-form.tsx` — **faithful** ✅ | `log-editor.tsx` — **ported** ✅ (`FigmaFormScreen`, edit + read-only views, body CTA) | Pain card title `مستوى الألم` vs Figma `مستوى الألم الملاحَظ` — the prop swap is in-scope (`figma-daily-log-fields.tsx`) but the string needs a **new locale key** (out of allowed files). |
| **Invite** | `invite-form.tsx` — **faithful** ✅ (gold banner → role `FigmaCardSelect` card → optional reference-name card → body CTA; no `*-editor`) | n/a | **None fixable in scope.** Reference-name helper line + role/label copy all need locale keys (the `hint` prop already exists on `FigmaFormField`). |

**Net:** 5 of 7 entities are fully parity-complete in scope (Tasks/Medications/Appointments/Vitals/DailyLogs add-forms + Invite + the Vitals/DailyLogs editors). The only structural gaps are the 4 legacy editors and copy/locale text — all out of VPA-2 scope.

---

## 4. VPA-2 blockers (report-only, per task instruction)

**A. Legacy editor re-platforms — BROAD REFACTOR (explicitly excluded by VPA-2).**
`task-editor.tsx`, `medication-editor.tsx`, `appointment-editor.tsx`, `visit-editor.tsx` still render the legacy `Screen` + `FormActions` shell (FormField/OptionSelect/Switch/fieldsets) instead of the ported `FigmaFormScreen` + `FigmaFormCard` + `FigmaChipSelect` + body `FigmaFooterPrimaryButton`. Bringing each to add-form parity is a whole-screen re-platform that also touches status sections + two-step delete confirmations + validation wiring (must stay unchanged). `medication-editor.tsx` additionally has **no canonical Figma edit-screen design** to port toward. (Vitals & DailyLogs editors are already ported — use them as the template.)

**B. Copy / label / placeholder alignment — needs LOCALE files (`src/locales/ar.json`, `en.json`), not in the allowed-file whitelist.** Several keys are *shared* with out-of-scope screens, so editing them would change copy outside VPA-2's surface:
- Tasks: title placeholder `tasks.placeholders.title` (`مثال: شراء الدواء` → `…من الصيدلية`).
- DailyLogs: pain card title → `مستوى الألم الملاحَظ` ("observed") — **highest value** (strengthens the non-diagnostic/medical-safety framing); needs a new key (e.g. `dailyLogs.painCardTitle`) then `label={t(...)}` in `figma-daily-log-fields.tsx`.
- Medications: notes/instructions/dose-times labels (`scheduleNotes`/`instructions`/`times`) — keys reused by out-of-scope `figma-schedule-fields.tsx` + `medication-editor.tsx`.
- Appointments: CTA `إضافة موعد` vs `إضافة الموعد`; start-time `وقت البدء` vs `وقت البداية`.
- Visits: placeholders `visitor-name` (`مثال: أحمد` vs `من سيزور؟`), `notes` (`ملاحظات إضافية` vs `تفاصيل الزيارة…`).
- Invite: reference-name helper line (`فقط لتذكيرك — لن يراه المدعو`, via the existing `hint` prop), role section-label, reference-name field-label.
- Vitals: add-title `إضافة قياس` vs `تسجيل قياس حيوي` (key shared with the route `_layout`).

**C. Shared-primitive change — report-only (task rule: don't edit shared primitives).** Figma's Task priority chips are fixed-width `flex:1` rectangles (radius 10); the app renders them via the shared `FigmaChipSelect` (rounded pills, wrapping) used for **every** chip group app-wide. Matching the design would require editing the shared `FigmaChipSelect` (out of scope) or diverging Task priority from the app's consistent chip system (would clash with the adjacent category/assignee pills).

**D. Data-model differences — out of layout scope (keep app behavior).**
- Visits: design has a single required Date+Time row; the app keeps **optional** `startTime`+`endTime` (a real feature) — the single-time 2:1 row can't be reached without a data/validation change.
- Appointments: design chips are 7 generic labels; the app renders its **real** `APPOINTMENT_TYPES` schema set — the app types are canonical; not a visual defect.

**E. Out-of-scope field helper.** Vitals' date/time card label (`وقت القياس` vs Figma `التاريخ والوقت`) lives in `figma-vital-fields.tsx`, which is **not** in the VPA-2 allowed list.

### Recommended VPA-3 scope to close these
1. **Editor parity pass** (own phase): port `task/medication/appointment/visit` editors onto `FigmaFormScreen` using the already-ported `vital-editor.tsx`/`log-editor.tsx` as the template, keeping all data flow / validation / delete-confirm intact; treat the add-form as the design source where Figma has no edit screen.
2. **Copy pass** with `src/locales/*.json` explicitly in scope (add `dailyLogs.painCardTitle`; reconcile the medication/appointment/visit/invite/vitals strings; mind shared keys).
3. **Chip-shape decision** on `FigmaChipSelect` (add an optional fixed-width/`equal`+`radius` variant) if rectangle priority chips are wanted — a VPA-1-style shared-primitive change.

---

## 5. CTA confirmation

Re-verified across every in-scope file that has a CTA: the save/create CTA is **body-rendered** (the final block inside the `FigmaFormScreen` `ScrollView`, after the last card — never the `FigmaFormScreen` `footer` prop, never pinned/KAV), it is `FigmaFooterPrimaryButton` (plain `Pressable`, filled `theme.primary` teal, full-width, radius 12 / minHeight 56 from VPA-1a), and it is **loading-gated only** (`loading={submitting}` blocks double-submit) with **no faint/grey validation-disabled state** — an invalid press runs validation and surfaces inline errors. Confirmed in: `task-form`, `medication-form`, `appointment-form`, `visit-form`, `vital-form` + `vital-editor`, `log-form` + `log-editor`, `invite-form`. Read-only detail views (vital/daily-log "view") correctly have no CTA. (The 4 legacy editors use the legacy `FormActions` save bar — unchanged, and out of scope as a broad refactor; not regressed by this pass.) No CTA was moved, no sticky/KAV footer reintroduced, no faint state introduced.

## 6. No backend / infra changes

Trivially true — **zero files changed**. No Supabase, backend, schema, auth, SQL, edge-function, hook, data-fetching, navigation, validation-schema, dependency, Expo-config, `.env`, EAS, prebuild, or shared-primitive changes. Nothing staged; nothing committed.

## 7. Validation results

| Check | Result |
|---|---|
| `npm run check:mojibake` | **clean** — 260 active files, no signatures |
| `git -c core.autocrlf=false diff --check` | **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| `npx expo-doctor` | **21/21 checks passed** |

(No adversarial diff-review workflow was run because there is no diff to verify.)

## 8. Recommended Android QA checklist (baseline / per affected form)

These confirm the **current** in-scope parity state (no behavior changed this pass), in dark + light, RTL/Arabic:
1. **Add Task** (`tasks/new`): Main-info card shows Title→Description→Category chips→Priority chips; `الموعد النهائي` card has date(wide)+time; assignee chips list real members; Notes card; teal CTA after the final card; invalid submit shows inline errors (CTA never greys).
2. **Add Medication** (`medications/new`): info card (name/dosage/form/instructions + with-food pill toggle) → schedule card (day chips, dose-time rows, period range) → notes card → teal CTA; gold non-diagnostic banner present.
3. **Add Appointment** (`appointments/new`): title+type chips → `التاريخ والوقت` date+start/end → location+doctor → notes → teal CTA.
4. **Add Visit** (`visits/new`): one card visitor→date→start/end times→notes→link-to-account toggle (manager only, with divider) → teal CTA.
5. **Add Vital** (`vitals/new`) & **edit** (`vitals/[id]`): type → value(+unit / BP split) → date/time → notes → teal CTA; add and edit look identical; read-only view has no CTA.
6. **Add Daily Log** (`daily-logs/new`) & **edit**: date → observations (mood/sleep/appetite/hydration/mobility, hairline dividers) → pain stepper + 0–10 chips → notes → teal CTA; two-step delete still confirms on edit.
7. **Invite member** (`circle-members/invite`): gold banner → role `FigmaCardSelect` cards → optional reference-name field → teal CTA.
8. **Known legacy (unchanged) — flag for VPA-3:** Task/Medication/Appointment/Visit **edit** screens still use the legacy system-nav `Screen` + in-scroll `FormActions` save bar (not the body teal CTA) — visible add-vs-edit inconsistency, deferred as a broad refactor.

**Stopping here per instructions: no commit, no stage.**
