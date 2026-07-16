@AGENTS.md

# Standing decisions (Milestone 4 — "The Pulse")

These are settled product/engineering conventions for Sanad. Follow them by default; call out any deliberate departure in your session report.

## Visibility posture — transparent circle (A1)
Every **active** member may **see** all of a circle's operational data (tasks, doses, appointments, visits, logs, vitals) — this mirrors the server `can_view_all_operational` posture. The UI never hides other members' work from a non-manager. Instead, lists offer an explicit **«مهامي / كل المهام»** (mine / all) scope toggle, defaulting collaborators to "mine" and managers to "all". Unassigned open work shows an inline **«أنا متكفّل»** claim for any claim-capable member. Who can *mutate* is still gated by role + RLS (unchanged); only *visibility* is transparent.

## Canonical feature order (A7)
Order features the same way everywhere (Home quick-actions, Explore, in-list grouping):

**medications → tasks → appointments → vitals → visits → daily logs → doctors → members**

Within a list, surface what needs attention first, then fall back to chronological: tasks = overdue → priority (urgent→low) → due date/time; doses = unlogged first (stable, time order preserved within each group).

## Canonical terminology (A8)
One term per concept, in **every** namespace including `figma.*`:
- Task "open" status → **«مفتوحة»** (not «معلقة»).
- Medication / schedule "active" → **«فعّال»** ; inactive → **«غير فعّال»** (not «نشط» / «موقوف»).
- "No assignee" in pickers → the shared `assignment.none` copy (don't reintroduce per-feature variants).
- Member display name always comes from `memberDisplayName()` (full name → email local-part → neutral fallback); never a bare «عضو» when any identity exists, never a raw email inline.
All user-facing strings live in i18n (`ar.json` + `en.json`, kept at **exact key parity**). No hardcoded Arabic in components/handlers — including notification action labels and confirmations. `__DEV__`-only QA strings are the sole exception.

## Confirmation patterns
A one-tap action that mutates data or ends a session must be guarded by exactly one of these three sanctioned patterns — never fire silently:
1. **`confirmAction()`** (`src/utils/confirm.ts`) — the lightweight cross-platform prompt (sign-out, claim, medication/schedule activate·deactivate).
2. **Inline two-step confirm** — the delete rows (`ItemActions` / body confirm).
3. **Bottom-sheet confirm** — task complete/cancel and dose-status correction.

Every mutation must also **surface its failure** (an `accessibilityRole="alert"` message), never revert silently.

## Zero new native dependencies (this phase)
Do not add packages that require a native rebuild / EAS build. Use only what's already installed (Expo SDK 56 set). New capability must be composed from existing native modules (`expo-linking`, `expo-notifications`, `expo-secure-store`, …) or deferred. Pure-JS dependencies are acceptable only with strong justification.

## Backend changes are hand-applied
Migrations and edge functions are **written** in-repo but **never** auto-applied/deployed. Each backend-touching change ships with an ordered runbook step the maintainer runs (migrations → deploy functions → `cron.schedule` → Auth redirect URLs). Never run `supabase db push` / `functions deploy` / SQL mutations / cron changes without explicit approval of the exact command. Never print secrets or raw push tokens.
