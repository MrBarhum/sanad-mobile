# Milestone 6 "Dar" — visual QA checklist

Living doc. One row group per rebuilt screen; verify each on a device/simulator.
Matrix: **light / dark** × **font scale 100 / 130 / 200 %** × **RTL** (the app is
force-RTL, so RTL is the default — also sanity-check numeric LTR isolation). Mark
each cell ✅ / ⚠️ / ❌ during review.

Static checks already green for every commit: `tsc --noEmit`, `check:mojibake`,
`git diff --check`, ar/en locale parity.

---

## Home — الرئيسية (frame 5a)  ·  commit: home rebuild

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Green header band runs under the status bar (no sand gap at top) | | | | | | band owns `insets.top` |
| Date · circle name (24/800) · chevron · recipient subtitle legible on band | | | | | | bandInk on band, AA 8.7–10.0 |
| Bell + gold unread badge; badge sits top-start (−8) | | | | | | badge = goldFill/goldInk |
| Emergency square (filled cream, green phone) | | | | | | |
| Tapping the circle name opens the switcher dropdown below the band | | | | | | 2px dividers |
| Count tile «3/5» right-aligned, LTR, 46/900; sub «أُعطيت حتى الآن» | | | | | | numerals LTR-isolated |
| Next-dose tile: name 17/800 + «time · instruction» acc | | | | | | all-given → tok+ok check |
| Dose bead strip: 5 cells, correct per-status fill, time below LTR | | | | | | screen reader = ONE summary |
| Stat tiles: tasks (tok+ok) / appointments (tacc+acc), 38/900 value | | | | | | |
| Next-appointment card: 44 icon square, forward chevron points LEFT | | | | | | |
| Quick grid: 4×2, tiles wrap, labels 2-line, no truncation | | | | | | check 200% wrap |
| Claim banner: solid gold, goldInk text, forward chevron | | | | | | claim-capable only |
| Dose rows: 40 status square, status pill (icon+text), log/edit button | | | | | | tray + correction confirm |
| Pulse strip: 34 icon squares, desc 2-line, time LTR | | | | | | quiet when no events |
| Emergency banner: terr fill + 2px err border, «عرض» button | | | | | | calm danger, not alarm-red |
| Bottom tab bar: active = solid green block, 2px dividers, Home right-most | | | | | | |
| Every time/date/count/value renders LTR inside the RTL layout | | | | | | |
| Both themes: layout identical, only tokens change | | | | | | |

**States to exercise:** quiet day (total=0 → «لا جرعات مجدولة اليوم», no strip/list);
all doses given; a postponed + a missed dose; today-load error banner (retry);
dose-log failure banner; read-only member (no log buttons, no claim card); no next
appointment; unread badge 0 / 5 / 9+.

---

## Medications list — الأدوية (frame 6a)  ·  commit: list rebuild

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Green sub-screen band = only top chrome (no native header above it) | | | | | | native header hidden on index |
| Back square (bordered) + centered «الأدوية» + filled add (managers only) | | | | | | |
| Summary pill: pill square + given/total (or «لا جرعات مجدولة اليوم») + active count | | | | | | |
| Segmented control: active = solid green, 2px divider between the two | | | | | | |
| Today doses grouped in one 2px card, rows split by 2px dividers | | | | | | |
| Status square + status pill (icon+text) per state (given/postponed/missed/unlogged) | | | | | | |
| Log → tray (3 chips) → immediate; edit → correction confirm | | | | | | |
| All tab: med cards, Pill square, schedule chips (LTR times), active/stopped badge | | | | | | |
| Empty (today): tok circle + check, reassuring line, gold-diamond divider, browse button | | | | | | |
| Empty (all): «لا أدوية بعد» (+ subtitle for managers) | | | | | | |
| Loading skeleton; load-error card + retry; dose-log-failure banner | | | | | | |
| Read-only member: no log buttons; family member: only own doses | | | | | | |
| RTL: forward chevrons left, times/counts LTR; both themes swap tokens only | | | | | | |

---

## Add-medication form — إضافة دواء (frame 6b)  ·  commit: form rebuild

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Green form band (back + title + subtitle), only top chrome | | | | | | new route hides native header |
| Gold non-diagnostic banner (goldFill + goldInk + info icon) | | | | | | |
| Section cards with the 10x10-square section header | | | | | | |
| Text fields: 2px border, sunken fill, acc focus ring, ghost placeholder | | | | | | bare «ميتفورمين» etc. |
| Validation error: terr fill + err border + icon + message; «(مطلوب)» on name | | | | | | tap Save empty to trigger |
| With-food toggle (48x28), on/off states, thumb visible | | | | | | |
| Responsible chips: unselected card / selected green + check; «غير محدد»/«أنا»/names | | | | | | neutral names |
| Day chips (7): selected green+800 / idle card+700; «كل الأيام» toggle | | | | | | |
| Dose-time rows: wheel picker opens; add (dashed) / delete (terr square) | | | | | | picker row is pre-Dar (reused) |
| Duplicate-time highlight + message; date period start/end | | | | | | |
| Save = full-width green; invalid press shows inline errors (not disabled) | | | | | | keyboard-avoid on iOS |
| RTL + LTR times/dates; both themes; managers-only gate (non-manager → empty) | | | | | | |

---

## Tasks list + confirm sheet — المهام (frame 8c)  ·  commit: tasks rebuild

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Green band (back + المهام + add), only top chrome | | | | | | native header hidden |
| Status tabs (اليوم/مفتوحة/مكتملة): active green block, 2px dividers | | | | | | |
| Scope pills (مهامي/كل المهام): shown to assignable members; default per role | | | | | | manager=all, collaborator=mine |
| Task rows grouped in one 2px card, split by 2px dividers | | | | | | |
| Checkbox states: open outline / done ok+tok+check / cancelled err+terr+X | | | | | | actionable only when canAct |
| Open row: title 800, due (clock+LTR) + assignee acc; note if present | | | | | | |
| Unassigned open row: «أنا متكفّل» claim pill → confirm → assign | | | | | | claiming spinner |
| Could-not-complete: 34px err X square (canAct) → cancel confirm sheet | | | | | | |
| Done/cancelled row: strikethrough title + «منجزة»/«ملغاة» pill + assignee | | | | | | cancelled row dimmed |
| Complete tap → bottom sheet (title/body/task-chip/تم الإنجاز/إلغاء) | | | | | | danger CTA for could-not-complete |
| Empty (per scope): tok circle + check + reassuring title | | | | | | mine vs all copy |
| Loading skeleton; load-error card + retry | | | | | | |
| RTL + LTR due; both themes; sheet scrim + slide | | | | | | |




---
---

# Milestone 8 — the hired-caregiver role (appended 2026-07-26)

**These screens have NOT been drawn in the Dar identity.** They were built to the existing
Dar language without a spec; every size, tone and arrangement is an engineering judgement
awaiting the reskin. Verify behaviour and law compliance here; treat visual polish as pending.

**Setup this section needs, and it is not trivial:** production has zero caregiver members.
To exercise any of it you must invite one (Explore → دائرة الرعاية → دائرة الرعاية → + →
pick «مقدّم رعاية»), accept the code on a second device or account, then make that account
responsible for at least one medication and assign it at least one task.

**Before anything else — the regression check that matters most:** open a circle with NO
caregiver and confirm the app is exactly as it was. That is Milestone 8's first product rule
and the most likely thing to have broken.

## Regression — a circle with NO caregiver (do this FIRST)

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Explore: «دائرة الرعاية» group has its ORIGINAL rows, in the original order | | | | | | no «ملخّص مقدّم الرعاية» row |
| Members: role legend shows exactly THREE rows (مسؤول / محرر / مشاهد) | | | | | | 4th row is caregiver-only |
| Members: no «واجهة مقدّم الرعاية» chip on any row | | | | | | |
| Members: every existing row's glyph/tone unchanged (Crown / Edit3 / Eye) | | | | | | family_member still amber Edit3 |
| Invite form with each of the four family roles selected: identical to before | | | | | | no disclosure cards |
| Role-change sheet: direction note only, no second amber callout | | | | | | |
| Home / tasks / medications / appointments / visits / Pulse: unchanged | | | | | | no copy change anywhere |
| Bottom tab bar still 3 tabs, Home right-most | | | | | | FigmaTabBar untouched |
| Assignee pickers on APPOINTMENT and VISIT forms unchanged | | | | | | caregiver must NOT appear |

## Invite a caregiver (manager only)

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Role picker shows a FIFTH card «مقدّم رعاية», last | | | | | | description is the rewritten one |
| Selecting it reveals three disclosure cards; deselecting hides them | | | | | | pure toggle, no layout jump |
| «ما سيراه» rows: green Check 16 / 2.2, four rows, wrap not truncate | | | | | | successFg |
| «ما لن يراه» rows: X in `textSecondary` — **not** errorFg | | | | | | scope statement, not warning |
| «ما لا يسجّله التطبيق»: shield glyphs; **الموقع الجغرافي is the FIRST row** | | | | | | the absence is the deliverable |
| Mutual-visibility note renders under the three cards, not buried | | | | | | |
| Gold appears ONCE only (the existing shown-once disclaimer) | | | | | | no other gold on screen |
| Code reveal adds the «يفتح واجهة مقدّم الرعاية» row — caregiver invites only | | | | | | not for family roles |
| Create a family invitation: reveal card has NO extra row | | | | | | |

## Roster with a caregiver

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Caregiver row: HandHelping glyph, accent tone, distinguishable at 12px | | | | | | vs Crown / Edit3 / Eye |
| «واجهة مقدّم الرعاية» chip at the END of the meta row, wraps cleanly | | | | | | «أنت» badge style, never gold |
| Chip absent on a REMOVED caregiver row | | | | | | |
| Legend gains a fourth row, tone-matched | | | | | | |
| Role change into/out of caregiver → second amber callout appears | | | | | | warningFg on warningBg |
| That callout is announced by the screen reader | | | | | | role="alert", polite |
| Change between two family roles → callout absent | | | | | | |

## Her «اليوم» screen — the caregiver shell

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Signing in as a caregiver lands on `/caregiver`, NOT the family tabs | | | | | | check a COLD start too |
| No bottom tab bar, no circle switcher, no bell, no gold badge | | | | | | worker band only |
| Band: recipient name 24/800 + today's date LTR-isolated at 85% | | | | | | bandInk on band |
| Dose rows in time order; large targets; one tap to record | | | | | | ≥ TouchTarget |
| Logged dose shows a StatusBadge (icon + text), never colour-only | | | | | | medications.status.* |
| Task row: large checkbox + «تعذّر الإنجاز» square on the END | | | | | | end = LEFT in RTL |
| Both task actions go through the bottom-sheet confirm | | | | | | sanctioned pattern 3 |
| Emergency row opens the real `/emergency-card` and it renders fully | | | | | | contacts + doctors + medical |
| Daily-note and vital entries open and SAVE | | | | | | her own rows only |
| Sign-out present and guarded by `confirmAction` | | | | | | she has no Account tab |
| Empty day → «لا شيء مجدول اليوم»; all done → «اكتمل كل شيء لليوم» | | | | | | green, never gold |
| **No streak, score, badge, confetti or congratulation anywhere** | | | | | | care is not a game |
| Load error → bordered card + retry; a failed save surfaces an alert row | | | | | | never a silent revert |
| Every time renders LTR inside the RTL layout | | | | | | |
| **Hardware back never strands her on a screen with no way out** | | | | | | there is no tab bar to escape to |

## Dose photo proof — gated on the EAS rebuild

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| **Before the rebuild:** photo block shows the calm «غير متاحة بعد» note | | | | | | not an error, not a crash |
| **Before the rebuild:** the dose still records normally | | | | | | capture is optional, always |
| *After the rebuild:* «إضافة صورة» opens the OS picker; nothing auto-uploads | | | | | | no silent capture |
| *After the rebuild:* the «سجلّك أنت …» framing line is present and unaltered | | | | | | load-bearing copy |
| *After the rebuild:* photo sent only on save; upload state is an inline alert row | | | | | | no toast, no progress bar |
| **Upload fails → the DOSE IS STILL SAVED and the copy says so** | | | | | | else she will re-dose |
| Family can open the dose and see the photo | | | | | | signed URL, private bucket |
| Family sees the ownership note and NO delete/replace affordance | | | | | | absence is the design |

## Weekly summary — the family side

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| Explore row appears only with a caregiver AND only for a manager | | | | | | |
| Header title = the caregiver's display name; no action square | | | | | | 44dp spacer |
| Week stepper: ChevronRight = PREVIOUS, ChevronLeft = NEXT (RTL) | | | | | | next disabled on the current week |
| Range string LTR-isolated and fits between the two 44dp squares | | | | | | check 360dp width at 200% |
| Counts: on time / late / not recorded + tasks — numerals LTR | | | | | | |
| Postponed and missed shown as their OWN facts | | | | | | not folded into "not recorded" |
| **No percentage, score, grade, rank, trend, chart or progress bar** | | | | | | the anti-surveillance rule |
| The late threshold is stated to the reader via the grace note | | | | | | never an unexplained accusation |
| Mirror note «هذه سجلّات وأرقام فقط، دون تقييم» closes the page | | | | | | must be drawn, not implied |
| Day breakdown: DoseBeadStrip, ONE spoken summary per strip row | | | | | | ≤5 beads per row |
| Empty week → «أسبوع هادئ», green not gold | | | | | | |
| A `family_member` opening the route sees the managers-only notice | | | | | | not a fabricated empty week |

## Cross-cutting — both themes, RTL, and the standing laws

| Check | Light | Dark | 100% | 130% | 200% | Notes |
|---|---|---|---|---|---|---|
| **Every new bordered control actually renders its box on Android** | | | | | | the function-form Pressable bug is DEVICE-ONLY |
| Press feedback is `android_ripple` everywhere, never a `pressed` callback | | | | | | |
| Nothing below 14px; body ≥16; 14–15 only at ≥600 weight | | | | | | |
| Radii only 8 / 6 / 4 / 999 / 16; borders 2px (1.5px small pills); flat | | | | | | no shadows |
| Gold appears ONLY on the invite shown-once disclaimer | | | | | | nowhere else in Milestone 8 |
| Every screen exists in light AND dark, identical layout | | | | | | |
