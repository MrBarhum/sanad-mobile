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



