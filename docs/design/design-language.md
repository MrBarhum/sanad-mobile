# Handoff: Sanad (سند) — Arabic-first RTL care-coordination app UI

> ملاحظة للمالك: هذا الملف مكتوب بالإنجليزية لأنه موجّه إلى Claude Code. اقرأ "كيف أستخدم الحزمة" في المحادثة.

## Overview
Sanad is a mobile app where an adult family shares responsibility for an elderly parent (users 30-55, coordinating from different cities). This package contains the complete, final visual design for the app: one chosen art direction ("Dar / Green & Sand" — دار · الأخضر والرمل) applied to every screen family, each in BOTH light and dark themes.

Emotional target: warm family support — calm, trustworthy, dignified. NOT clinical, NOT a dashboard, NOT gamified. The person opening the app is often tired or worried; the UI should feel like relief.

## About the design files
The files under design/ are **design references created in HTML** — they show the intended look precisely, but they are not production code. Your task is to **recreate these designs in the target codebase**: a **React Native** app (Expo or bare). Use the codebase's established patterns and libraries. If the project is empty, set up a standard React Native + TypeScript structure and implement the design system first (tokens.ts here is ready to copy).

Open design/Sanad Home Directions.dc.html in a browser to view every screen (it is a pan/zoom canvas; frames are grouped in numbered sections). It must stay next to design/support.js. The inline styles in that file are the **pixel source of truth** — when this README and the HTML disagree, the HTML wins.

## Fidelity
**High-fidelity.** Colors, spacing, borders, typography, radii, and copy are final. Recreate pixel-perfectly (adapted to RN primitives). The reports/ folder contains the full product specs (behavior, data, copy) — the designs implement those specs; read the relevant report before building each domain.

## The design language ("Dar")
A "family house" feel: sturdy, grounded, everything in its place.
- Flat solid blocks. **2px solid borders on almost everything** (border color = line token). No gradients, no glassmorphism, almost no shadows (flat elevation; sheets/overlays use a scrim instead).
- Warm sand background (bg), cream cards (card), deep green header band (band) with cream text (bandInk).
- Corner radii: cards/buttons/inputs 8 · small icon squares & inner controls 6 · tiny badges 4 · pills/avatars/checkbox-circles 999 · bottom-sheet top corners 16.
- Typography: **Cairo** only (weights 400/600/700/800/900). Numerals are Western digits (0-9); numeric strings (times, dates, values, phone numbers, codes) are embedded LTR inside RTL text.
- Section headers: a 10x10 solid btn-colored square + 16px/800 title (+ optional underlined acc link on the end side).
- Gold (goldFill/goldInk) is reserved for exactly two things: the "available to claim" surfaces and one-time/irreversible warnings (e.g. invite code shown once).
- Statuses are NEVER color-only: always icon + text label (e.g. check + "أُعطيت", clock + "مؤجَّلة"). Status pill = 1.5px stroke border, radius 4-6 or 999, tint fill, 14px/700 label.
- Emergency red (err) is restrained: bordered tints and small filled call buttons — never full red screens, never alarm styling.

## Hard product rules (non-negotiable)
1. Arabic RTL layout everywhere (I18nManager RTL). Text alignment right; "forward" chevrons point LEFT; back button chevron points RIGHT.
2. Running/body text minimum 16px (older readers). 14-15px only for short meta labels, always >=600 weight.
3. WCAG AA contrast. The token pairings in tokens.ts are verified — keep pairings exactly as specified, in both themes.
4. No gamification: no streaks, points, scores, confetti. Progress language is "3 of 5 doses today", never achievement language.
5. Status never color-only: icon + text, both themes.
6. Both themes are first-class. Every screen exists in light and dark; only token values change, never layout.
7. Vitals, daily logs, and the emergency card are **non-diagnostic**: keep the disclaimer banners exactly as designed («للحفظ والمتابعة فقط، ليست تشخيصًا»).

## App shell
3-tab bottom bar, RTL order with الرئيسية (Home) as the FIRST tab from the right: الرئيسية · استكشاف · الحساب. Active tab = solid btn fill with btnInk icon+label (800); inactive = mut on card; 2px top border; 2px dividers between tabs. Header band variants:
- Tab screen: band with 24px/800 title (+ optional 16px subtitle at 85% opacity).
- Sub-screen: 44x44 bordered back square (start side), centered 20px/800 title, 44x44 filled action square (end side, e.g. +) or empty 44px spacer.
- Form screen: back square + title 20px/800 + 14px subtitle.

## Core components (specs)
- **Card**: card bg, 2px line border, radius 8, padding 12-14. Grouped lists: one card, rows separated by 2px line dividers, row padding 11-12 x 14.
- **List row**: 40x40 (or 44) icon square (2px border, radius 6, tint fill + matching stroke icon) · title 16/800 + meta 14/600 mut · left-pointing chevron.
- **Letter avatar**: 44px circle, 2px border, tint fill, single letter 18/900 in stroke color.
- **Primary button**: btn fill, btnInk text 17/800, 2px line border, radius 8, padding 13-14 vertical. **Secondary**: card fill, 2px line border, ink text 16/800. **Danger**: card fill, 2px err border, err text. **Text link**: acc, underlined, 15/700-800.
- **Segmented tabs**: one bordered container (radius 8), equal flex cells, 2px dividers; active cell = btn fill + btnInk 16/800; inactive = mut 16/700 on card.
- **Scope pills** (مهامي / كل المهام): bordered pills radius 999; active = btn fill.
- **Choice chips** (forms): bordered radius 8, padding 7-8 x 13-14, 15px; selected = btn fill + btnInk/800.
- **Inputs**: sunken fill, 2px line border, radius 8, padding 11-12 x 14, value 16/700-800; focused = acc border; placeholder = mut/600. Big numeric inputs: value 26/900 centered, LTR.
- **Bottom sheet**: full-screen scrim rgba(8,18,14,.55) light / rgba(0,0,0,.6) dark; sheet = card bg, 2px top border, top radius 16, 48x8 sunken grab handle; centered 18/800 title; content; stacked primary then secondary full-width buttons.
- **Banners**: info = tacc fill + acc icon + 14-15/700 ink text; gold = goldFill + goldInk; emergency = terr fill + 2px err border. All radius 8, padding 11-12 x 14, icon top-aligned.
- **Stat tile**: bordered card, tint fill variant, label row (icon + 15/800), number 38/900, caption 15/600 mut.
- **Dose bead strip** (home): per dose a 40px-high bordered cell radius 6 — done = btn fill + btnInk check; postponed = twarn fill + warn clock; upcoming = card fill + mut clock; time 14/600 below, LTR.
- **Checkbox circle** (tasks): 28px circle 2px border; done = ok border, tok fill, ok check. "Could not complete" square: 34px bordered square with err X.
- **Claim pill** («أنا متكفّل»): btn fill, btnInk 15/800, radius 6, handshake-style icon.
- **Notification badge**: min 21px circle/rounded square, err fill (light) / gold on band, bg-colored 13/700-800 count, 2px bg ring when floating on circles.
- **Toggle/switch** (not drawn; compose from tokens): track 2px line border radius 999, off = sunken fill, on = btn fill; thumb = card-colored circle with 2px line border; label 16/700 plus a state word (مفعّل / متوقف) so state is never color-only.
- **Quiet/empty state**: centered tinted circle icon (tok + ok check for "all done"), 18/800 title, 15-16/600 mut reassuring line. Calm, never an error.
- **Skeleton**: sunken blocks radius 6-8, subtle pulse; **Error state**: bordered card, warn/err icon square, 16/800 title, 15/600 mut line, bordered retry button («إعادة المحاولة»).

## Interactions & motion
Dignified and minimal. Press feedback = slight darken/opacity (RN Pressable). Sheets slide up 200-250ms ease-out with scrim fade. Tab switches instant. No confetti, no bouncy springs, no pull-to-refresh spinners beyond platform default. Skeleton pulse subtle (opacity 0.6-1.0, ~1.2s).

## RTL implementation notes (React Native)
- I18nManager.allowRTL(true) + forceRTL(true) (set once; restart app). Use start/end style props (marginStart, paddingEnd, textAlign 'left'/'right' avoided in favor of 'auto'/start-end) so layout mirrors automatically.
- Wrap numeric strings (times "6:00 م" uses Arabic meridiem but Western digits, dates 2026-07-19, values 128/82, phones +966..., codes SND-7K4M) in LTR isolation: unicode LRI/PDI (\u2066...\u2069) or a Text with writingDirection 'ltr'. In the HTML these are dir="ltr" spans — replicate each one.
- Icons: use an RTL-aware icon set or flip chevrons manually: forward = chevron pointing left, back = pointing right.
- Font: @expo-google-fonts/cairo (Cairo_400Regular ... Cairo_900Black) or bundle TTFs.

## Screens
See SCREENS.md for the full inventory (every frame in the HTML, keyed by its section badge, with the report that specifies it). Coverage: reports 01-14 all have designed reference screens; 15-18 are system references (design system, forms, copy, data model) that this package implements/uses.

Some secondary screens are intentionally not drawn; compose them from the archetypes (SCREENS.md lists them with their recipes): onboarding/create-circle wizard, appointments list, medication detail, task detail/edit, doctors list, recipient profile, manage-invitations list, join-circle form, notification settings.

## State management & data
See reports/18-data-model.md for entities and reports/13, 11, 10 for the pulse/claiming/roles logic. UI state needed per screen is listed in each report ("States" sections). Persist theme choice (light/dark/system) in the account settings.

## Design tokens
tokens.ts in this folder is ready to copy into the codebase. All values were extracted from the final design. Do not add colors; derive nothing.

## Copy & voice
reports/17-copy-and-voice.md governs all strings. The designs use its voice: masdar-style verbs in the activity feed, «أنا متكفّل» for claiming, «تعذّر الإنجاز» not "فشل", non-diagnostic disclaimers, dual-calendar-free Western digits. Keep all Arabic copy exactly as in the HTML unless a report supersedes it.

## Assets
No raster assets. All icons are inline stroke SVGs (24x24 viewBox, stroke-width 2-2.8, round caps/joins) — lucide-style. In RN use lucide-react-native (or react-native-svg copies of the exact paths in the HTML). Logo: 64px rounded square band-colored tile with a hands/heart mark (see 7a) — placeholder until brand asset exists.

## Files
- design/Sanad Home Directions.dc.html (+ support.js) — the visual truth, all frames light+dark
- tokens.ts — color/type/spacing/radius tokens, both themes
- SCREENS.md — frame-by-frame inventory mapped to reports
- PROMPT_FOR_CLAUDE_CODE.md — suggested prompts to drive implementation
- SUGGESTED_CLAUDE_MD.md — drop into the repo root as CLAUDE.md
- reports/ — the 18 product reports (specs for behavior, copy, data)
