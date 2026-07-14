# Sanad — Phases 1–5 Implementation & QA Record

**Date:** 2026-07-14
**Branch:** `worktree-phases-1-to-5` (off `master` @ `ced8554`)
**Scope:** Executes the "Suggested next phases" (§M) of the product-map report
(`2026-07-14-product-map-workflows-and-ui-inventory.md`), **Phases 1–5**.
**Phase 6 (2F-11D data-only / Android background action-button push) is
intentionally NOT done** — it is the deferred item with a documented product
decision ("Option A for MVP", delivery > lock-screen-button convenience; see
`2026-07-13-phase-2f-11c-closeout-and-2f-11d-decision.md` and §H.1).
**Method:** code changes only. No Supabase/SQL/deploy/cron/secret action. RLS
claims below are read from the migration SQL, not executed.

---

## A. What shipped (code)

All committed to `worktree-phases-1-to-5`. `tsc --noEmit`, `check:mojibake`,
`git diff --check`, and ar/en key parity (1002/1002) are green after every
commit.

### Phase 1 — MVP reachability (the P0/P1 cluster)
| Item | Change | Files |
|---|---|---|
| **P0-1** Member management reachable | New Figma `MemberActionsSheet` grafts change-role, reactivate, leave circle, transfer ownership (all previously only in the unrouted legacy `MembersManager`) into the live roster; a "Manage invitations" link and a removed-members section were added. Reuses the authoritative membership hooks/RPCs + permission gates. | `circle-members/figma-member-actions.tsx` (new), `figma-members.tsx`, `ar/en.json` |
| **P0-2** Remove-member confirmation | Removing a member is now a two-step confirm (was a single tap). | same |
| **P1-1** Recipient profile / emergency contacts reachable | Explore gains a "care recipient profile" row (read-only for non-managers); the emergency card gains manager-only Edit shortcuts on its Medical and Contacts sections → the recipient-profile and emergency-contacts editors. | `explore.tsx`, `emergency-card.tsx`, `emergency/figma-emergency-card.tsx`, locales |
| **P1-3** Circle timezone reachable | `CircleTimezoneCard` (previously imported by nothing) mounted on notification-settings, where it governs when reminders fire. | `notifications/notification-settings.tsx` |
| **P1-2** Doctor edit/delete | Manager-only Edit + Delete (two-step confirm) footer on each Figma doctor card; reuses the existing `DoctorFormModal` in edit mode; surfaces delete errors. | `doctors/figma-doctors.tsx` |
| **P1-7** Appointment outcome for assignees | **Verified already correct** — the route wires `canCollaborate`, the list scopes assignees to their appointments and opens the detail, and `AppointmentViewScreen` shows outcome buttons via `canMarkOutcome`. No change needed. | — |

### Phase 2 — Safety & correctness polish
| Item | Change | Files |
|---|---|---|
| **P1-5** Confirm detail complete/cancel | Task/appointment/visit detail outcome mutations now use a two-step confirm with a plain-language prompt (matches the list). Failures surface inline. | `tasks/task-editor.tsx`, `appointments/appointment-editor.tsx`, `visits/visit-editor.tsx`, locales |
| **P1-6** Task reopen | Managers can reopen a completed/cancelled task (was terminal). Clears `completed_at/completed_by/cancelled_at` to satisfy the `*_at_consistent` / `completed_by_consistent` CHECK constraints; RLS keeps it managers-only (the collaborator-scope trigger lets managers "change anything"). | `tasks/api.ts`, `tasks/hooks.ts`, `task-editor.tsx`, locales |
| **P1-4** Completed appointments history | New `fetchCompletedAppointments` (all dates, newest first) backs the "Completed" tab; the future-only upcoming query made it structurally empty. Lazily fetched on tab open. | `appointments/api.ts`, `hooks.ts`, `figma-appointments.tsx` |
| **P1-10** Home per-section errors | One retryable banner when any of today's sub-queries (doses/tasks/appointments) fails, so a failed fetch can't look like an empty day. | `care-circle/figma-home.tsx`, `tasks/hooks.ts`, locales |
| **P2-5** Silent mutation failures | Failed dose logs (Home + medications list), doctor deletes, and detail outcome mutations now show an inline error instead of silently reverting. | `figma-home.tsx`, `figma-medications.tsx`, editors, locales |
| **P1-8** Type scale (partial) | Shared Figma primitives raised toward the 14sp elder floor: list-row subtitles 12→14, status pills 11→14, section eyebrows 12→13, bottom-tab labels 11→13. `FigmaFontSize` token now documents the floor policy. A full per-screen sweep + device verification at 130%/200% remains the design+QA portion. | `components/figma/*` |

### Phase 5 — Cleanup
| Item | Change |
|---|---|
| **P2-1** Dead code | Deleted 11 verified-dead files (zero `src/` importers): legacy `members-manager` + `role-modal` (superseded), `circle-dashboard` + its `circle-switcher` + `notification-bell`, the five `*Center` screens, and the legacy `emergency-card`. tsc green. |
| **P3-1** Version from config | Account version reads `Constants.expoConfig?.version` (expo-constants) instead of hardcoded `'1.0.0'`. |
| **P2-8** (listed under Phase 4) Unsaved settings guard | notification-settings warns before leaving with unsaved edits. |

**Deliberately NOT deleted:** `doctors/doctors-manager.tsx` stays — its
`DoctorFormModal` is live (reused by `figma-doctors`); only the unused
`DoctorsManager` component inside it is dead. Broader P2 cleanup left for a
device-verified pass: two token systems (P2-2), `figma.*` label drift +
hardcoded Arabic notification strings (P2-10), remaining sub-14 inline text
(P1-8 sweep), and misc orphaned primitives (`NavCard`/`HintRow`/`Collapsible`
etc.) now that their only consumer (`circle-dashboard`) is gone.

---

## B. Phase 3 — Role gate vs RLS verification (code-read) + device QA

### B.1 Server-rule verification (read from `supabase/migrations/`, not executed)
| § | Question | Answer | Evidence |
|---|---|---|---|
| Q1 | Does `remote_member` read ALL operational data? | **Yes.** `can_view_all_operational` includes `remote_member`, so remote read == manager read on tasks/appointments/visits/dose-logs; medications/daily-logs/vitals gate on `is_circle_member` (any active member, incl. remote). This is the deliberate "single switch point" to tighten later. | `20260626161000_...rls.sql:24,55,89,150,165` |
| Q2 | Assignee appointment outcome supported server-side? | **Yes** — non-managers pass only if `assigned_to = auth.uid()`. Now surfaced in-app (P1-7). | `20260626162000_...claim_flow.sql:382` |
| Q3 | Non-responsible family_member blocked from dose-log / task complete? | **Yes.** `medication_logs` INSERT requires manager OR `is_responsible_for_medication`; task complete requires `assigned_to = auth.uid()` + status-only trigger. | `20260626161000_...rls.sql:102,37,74` |
| Q4 | `set_circle_timezone` manager-only? | **Yes** — rejects non-`admin`/`primary_caregiver` with 42501. | `20260611120200_...timezone.sql:48` |
| Q5 | `caregiver`/`elder` server-rejected? | **Yes** — `update_circle_member_role` + `create_circle_invitation` reject `caregiver`/`elder`; claim RPCs reject `remote_member`/`elder`. | `20260610130100_...rpcs.sql:93,476`; `20260626162000_...claim_flow.sql:118` |

**Posture notes to re-verify on the live DB** (the Phase 2D/2E policies were
hand-applied then back-filled into repo files — confirm live == repo):
- `remote_member` is **full-read, not summary-only**. If product wants
  summary-only, the `can_view_all_operational` array is the one place to change.
- **Read asymmetry:** a plain `family_member` sees ALL medications/vitals/daily-logs
  but only their OWN tasks/appointments/visits/dose-logs — confirm intended.
- `caregiver` is **dormant, not removed** (RLS still lists it as capable, but no
  member can be assigned it). If any future path assigns `caregiver`, it gains
  write/claim rights immediately.
- Negative test: a raw PostgREST UPDATE reassigning `assigned_to`/`visitor_user_id`
  must still fail (claim trigger bypass is tx-local GUC only).

### B.2 Per-role device QA checklist (run on device with a real account per role)
For each of **admin, primary_caregiver, family_member, remote_member**:
```
[ ] Sees the three tabs; CircleGate resolves; no crash on cold start
[ ] Members roster: correct role labels; MORE affordance appears ONLY on rows
    the actor can act on; opening the sheet shows only permitted actions
[ ] Remove member → 2-step confirm; owner/last-admin blocked with the note
[ ] Change role → picker shows only assignable roles; effect note correct;
    save persists; RLS rejects an illegal change (surfaced as an error)
[ ] Leave circle (self, non-owner, non-last-admin) → confirm → routed home
[ ] Transfer ownership (owner only) → confirm → ownership moves
[ ] Add/edit/delete med, task, appointment → allowed for managers only;
    family_member/remote get managersOnly / no add button
[ ] Log a dose: manager any; family_member ONLY when responsible; remote never
[ ] Complete/cancel a task/appointment/visit from the DETAIL screen →
    2-step confirm appears; assignee (family_member) can act on their own item;
    reopen offered to managers only
[ ] Recipient profile & emergency contacts: editable for managers, read-only
    banner for others; reachable from Explore / emergency-card Edit links
[ ] Circle timezone card on notification-settings: managers can change, others
    see the managerOnly note
[ ] remote_member: confirm the intended read posture (currently full-read)
```

---

## C. Phase 4 — Notification QA

### C.1 Code change done
- **P2-8** notification-settings now has an unsaved-changes guard
  (`UnsavedChangesGuard` + baseline snapshot) — warns before leaving with
  unsaved toggle/quiet-hours edits.

### C.2 Device QA matrix (needs hardware — cannot be run from here)
Device × app state, on **Samsung S24 (primary)** + one other Android:
```
                foreground   background   killed
detailed remote text  [ ]        [ ]        [ ]   (title/body arrives, Arabic)
tap-to-open deep link [ ]        [ ]        [ ]
in-app complete/snooze[ ]        [ ]        [ ]
local/foreground btns [ ]        —          —     (action buttons render)
quiet hours respected [ ]        [ ]        [ ]
per-scope preferences [ ]        [ ]        [ ]
Doze / battery-opt    [ ]        [ ]        [ ]   (delivery still lands)
```
Expected per the settled decision (§H.1): backgrounded/killed remote pushes
render **no** action buttons on Android (accepted MVP limitation); detailed
text + tap-to-open + in-app complete/snooze all work.

### C.3 P1-9 — `check-missed-doses` cron — FLAG (needs your action)
The report notes `check-missed-doses` is deployed but **not** among the 3 active
cron jobs, so tier-2 missed-dose escalation may never fire. **This is a
cron/Supabase change requiring your explicit approval** (project ref
`qccgshanmoeybagxwvcs`); it was NOT touched here. Decide whether to schedule it
or confirm it's intentionally off.

---

## D. Validation results (this session)
- `npx tsc --noEmit` → **0 errors** (after every commit).
- `npm run check:mojibake` → clean (no source touched introduced mojibake).
- `git diff --check` → clean.
- ar/en locale parity → **1002 / 1002**.
- `npx expo-doctor` → **1 check failed: 8 packages behind their SDK-56 patch
  versions** (`expo`, `expo-router`, `expo-notifications`, `expo-constants`,
  `expo-dev-client`, `expo-linking`, `expo-splash-screen`, `@expo/ui`). This is
  **pre-existing** — no dependencies were added or changed this session. Resolve
  with `npx expo install --check` when you're ready (not run here: it mutates
  deps and may trigger a native rebuild — your call).

## E. Deferred / follow-up (not done, by design or by constraint)
- **Phase 6 / 2F-11D** — deferred with a documented product decision. Untouched.
- **Device QA (Phases 3 & 4 execution)** — needs real hardware + real accounts.
- **P1-9 cron** — needs Supabase approval.
- **EAS build / expo patch updates** — needs your go-ahead (deps/native).
- **P2-2 / P2-10 / full P1-8 sweep** — larger design-system consolidation, best
  done as a device-verified pass.
