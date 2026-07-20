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
