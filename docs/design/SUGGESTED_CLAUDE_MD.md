# CLAUDE.md (drop this file in the repo root — rename to CLAUDE.md)

## Project
Sanad (سند) — Arabic-first RTL React Native app for families coordinating care of an elderly parent. Calm, dignified, warm; never clinical, never gamified.

## Design source of truth
- design_handoff_sanad/design/Sanad Home Directions.dc.html — pixel reference (canonical = "Dar / Green & Sand", section 5a + sections 6-9)
- design_handoff_sanad/tokens.ts — the ONLY colors/sizes/radii allowed (light + dark)
- design_handoff_sanad/SCREENS.md — frame inventory; reports/ — behavior specs

## Hard rules (reject code that violates them)
1. RTL always (I18nManager). Forward chevrons point left; back points right.
2. Running text >= 16px; 14-15px only for short bold meta labels.
3. WCAG AA: use token pairings exactly (btn+btnInk, band+bandInk, goldFill+goldInk, tint fills with their stroke colors).
4. No gamification: no streaks/points/scores/confetti.
5. Status is never color-only: icon + Arabic label, both themes.
6. Numeric strings (times/dates/values/phones/codes) render LTR inside RTL text.
7. Every screen ships in light AND dark; layout identical, tokens swap.
8. Vitals / daily logs / emergency card keep their non-diagnostic disclaimers.
9. 2px borders (line token), radii 8/6/4/999/16-sheet, Cairo font only.
10. Copy comes from the designs + reports/17-copy-and-voice.md — do not paraphrase.
