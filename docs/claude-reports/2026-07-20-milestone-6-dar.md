# Milestone 6 — "Dar / Green & Sand" visual identity

**Branch:** `milestone-6-dar` (off `master` @ 5d1eb24) · **Status:** in progress — living document.

Visual-identity-only milestone: re-skin the app to the **«دار · الأخضر والرمل»**
direction (frame 5a + sections 6–9 of `docs/design/design/Sanad Home
Directions.dc.html`, the pixel source of truth). No behaviour / routing / data /
permission / query changes. This report carries the token mapping, the component
mapping, the per-screen delta tables, the contrast audit, invented values, and
deferrals — kept current so the work resumes from "continue".

## Progress log
- ✅ **Phase 0** (commit `843b17f`) — reconciled `CLAUDE.md` with the Dar laws.
- ✅ **Phase 1** (commit `1fd3d0c`) — tokens re-pointed + Cairo typeface.
- 🔶 **Phase 2** (commits `b3cca74`, `f015e59`) — restyled the shared shell/card
  primitives + built the new home components. **Sequenced per-screen** (see note).
- 🔶 **Phase 3** — Home (5a) rebuilt; **STOP here for the user's checkpoint review**
  before any further screen.

### Sequencing note (deliberate, documented)
Rather than restyle every component up front, Phase 2 is done **per screen** so that
**everything restyled is validated by the screen it lands on**. This directly honours
the user's checkpoint rule ("finish the first screen, then stop for me to verify"):
no broad component interpretation is baked in before the Home review. Done so far
(all exercised by Home): Surface, FigmaScreen (+band slot), FigmaTabBar, and the two
new components. Deferred to their first-use screens: Button, GlyphChip/IconChip,
StatusBadge/FigmaStatusPill, FigmaListRow, OptionSelect, FormField, the sheets
(FormModal/PickerSheet/FigmaBottomSheet), FigmaSegmentedTabs + scope pills,
FigmaHeader/FigmaFormScreen, InfoBanner, WeekdaySelector, EmptyState/error/skeleton,
FigmaSwitch, and the LetterAvatar (built with the members screen 9a). The Home rebuild
uses lucide-react-native directly (figma-home's established pattern) with all icon
containers built inline for pixel fidelity, so it depends on none of the deferred set.

---

## Phase 0 — Law reconciliation (commit 843b17f)
Merged `docs/design/SUGGESTED_CLAUDE_MD.md` into `CLAUDE.md` (then deleted it).
Added the Dar laws (2px solid borders, flat elevation, radius 8/6/4/999/16, gold =
exactly two uses, body ≥16, AA pairings only). **Superseded** two M5 clauses, noted
in-file: (a) the card ruling (Surface + hairline + whisper shadow) → the flat
2px-border no-shadow card; (b) the typeface (IBM Plex Sans Arabic → Cairo). Every
other law kept: the 14 floor, calm danger, no-gamification, one-component-per-job,
one-sheet-chrome, the copy voice.

---

## Phase 1 — Tokens + Cairo (commit 1fd3d0c)

### Typeface
- **IBM Plex Sans Arabic → Cairo**, the single family. Declared
  `@expo-google-fonts/cairo@^0.4.2`; the root layout loads weights
  400/600/700/800/900 through the existing `FontFamily` keys; the four bundled
  IBM Plex TTFs + their `OFL.txt` were deleted; every `IBM Plex` reference scrubbed.
- `FontFamily` key → Cairo weight: `regular`→400 · `medium`→600 · `semibold`→700 ·
  `bold`→800 · `black`→900 (new key). Repo key names kept so all 57 `FontFamily.*`
  consumers keep working.

### Color token mapping (handoff token → repo key; VALUES changed, key names kept)
The whole app reads the palette via `useTheme()` → `Colors[scheme]`, so re-pointing
values re-skins every consumer. Fixed AA pairings from `tokens.reference.ts` were
preserved exactly.

| Dar handoff | Repo key(s) | light | dark | Notes |
|---|---|---|---|---|
| `bg` | `background` | #EFE8D6 | #0A1B17 | warm sand canvas |
| `card` | `backgroundElement`, `backgroundRaised` | #FAF6EA | #122B24 | cream card; no 2nd elevation (flat) |
| `ink` | `text` | #14312A | #EEE7D4 | primary text |
| `mut` | `textSecondary`, `textMuted` | #47594F | #A9BCAD | one muted tone in Dar |
| `line` | `border`, `divider` | #14312A | #6B8074 | the 2px solid edge (= ink in light; lightens in dark) |
| `sunken` | `backgroundSunken`, `backgroundSelected` | #E4DBC4 | #0E211C | input wells, pressed, grab handle |
| `btn` | `primary` | #0E4A40 | #7FC7B4 | button/active fill |
| `btnInk` | `onPrimary` | #F4EEDC | #06231C | text on btn |
| `acc` | `primaryText`, `infoFg` | #0E4A40 | #8FCBB8 | accent text/links/icons |
| `tacc` | `primaryBg`, `infoBg` | #D9E4DE | #1D3B33 | accent/info tint fill |
| `goldFill` | `accentBg`, `accentSolid`, **`goldFill`** (new) | #E3C36A | #C8A33B | gold surface |
| `goldInk` | `accentFg`, `onAccent`, **`goldInk`** (new) | #2A2408 | #1A1408 | text on gold |
| `band` | **`band`** (new) | #0E4A40 | #123B32 | header band fill |
| `bandInk` | **`bandInk`** (new) | #F4EEDC | #EEE7D4 | text on band |
| `ok` | `successFg` | #2E6A4E | #93C9A6 | success stroke/text |
| `tok` | `successBg` | #DAE8DC | #1E3D2C | success tint |
| `warn` | `warningFg`, `accentText` | #7F5A08 | #DDB65E | amber caution (never gold) |
| `twarn` | `warningBg` | #EEE2C1 | #41351A | caution tint |
| `err` | `errorFg`, `dangerSolid` | #9C4034 | #E2907F | restrained danger stroke/fill |
| `terr` | `errorBg` | #F1DED6 | #46271F | danger tint |
| (bg-on-err) | `onError` | #EFE8D6 | #0A1B17 | Dar: err fill → bg-colored text |
| (derived) | `primaryPressed` | #0A3A32 | #6BB3A0 | darker btn press |
| (scrim) | `overlay` | rgba(8,18,14,.55) | rgba(0,0,0,.6) | sheet/modal scrim |
| `acc` | `categoryBlue/Purple/Green/Gold/Teal` | #0E4A40 | #8FCBB8 | **ramp collapsed to green** — feature identity now comes from the glyph, matching the HTML's monochrome-green icons |

**Notes / decisions:**
- Dar `sunken` maps onto the existing `backgroundSunken` (and `backgroundSelected`) —
  no redundant new `sunken` key added (one-term-per-concept).
- `accentFg/accentBg` become the **gold** pairing (was the M5 sand accent). The old
  "gold = celebratory/empty-state" is retargeted: empty/celebration is now a calm
  green `tok`+`ok` check; gold is reserved for claim + one-time warnings (+ the gold
  form disclaimer banner, which the design draws in gold).
- `onSuccess`/`onWarning`/`accentSolid`/`accentText`/`backgroundRaised` were UNUSED
  (type-symmetry only) — set to sensible Dar values.
- `ringTrack` kept (care-loop ring retired in Phase 2; the key stays for symmetry).

### Radius / border / elevation
- `Radius`: the panel keys `sm/md/lg/card/xl` all resolve to **8** (Dar card/button/
  input radius, the dominant value, so every consumer lands correctly); added
  `control=6` (icon squares, dose beads), `tiny=4` (status pills/badges), `sheet=16`
  (bottom-sheet top corners); `pill=999` kept.
- `BorderWidth` (new): `standard=2`, `thin=1.5`.
- `CardShadow` → **flat no-op `{}`** — the 2px border defines the card in both themes.

### WCAG AA contrast audit (recomputed on the Dar palette)
All 25 checked pairings pass in **both** themes — **0 failures**. Ranges: text ≥ 4.5
(lowest 4.83 light «warn on twarn», 5.43 dark «err on terr»); UI/borders ≥ 3.0
(lowest 3.55 dark «line on card»). The handoff's AA claim is confirmed. (Script:
`scratchpad/contrast-audit.js`, values from `tokens.reference.ts`.)

### RTL
Unchanged and intact: `applyRTL()` (I18nManager forceRTL, one-shot) + the
`LtrText`/`isolateLtr` LTR-isolation helpers are reused — no second mechanism added.

---

## Phase 2 — Component mapping (done so far)

| Spec component | Repo component | Change | Status |
|---|---|---|---|
| Card | `Surface` (`surface.tsx`) | flat: 2px `line` border both themes, radius 8, no shadow (CardShadow retired), default padding 14 | ✅ `b3cca74` |
| Screen shell / band | `FigmaScreen` (`figma-screen.tsx`) | added full-bleed `band` slot (runs under status bar) + `contentGutter`; no-band path unchanged | ✅ `b3cca74` |
| Bottom tab bar | `FigmaTabBar` (`figma-tab-bar.tsx`) | Dar bar: card bg, 2px top border, active tab = solid `btn` block (btnInk + 800), idle `mut` + 2px start-dividers, icon 22, label 15 | ✅ `b3cca74` |
| **Dose bead strip** (NEW — replaces ring) | `dose-bead-strip.tsx` | 40px 2px-bordered r6 cells; given=btn+btnInk / postponed=twarn+warn / missed=terr+err / upcoming=card+mut; one spoken a11y summary, beads hidden | ✅ `f015e59` |
| **Section header** (NEW) | `section-header.tsx` | 10×10 solid `btn` square + 16/800 title + optional underlined `acc` link / custom trailing | ✅ `f015e59` |
| CareLoopRing (retired) | — | deleted once unreferenced (replaced by the bead strip + count tile) | ✅ Home commit |

Deferred component restyles are listed in the sequencing note above.

## Phase 3 — Home (frame 5a) delta table

Legend: ✅ matches HTML · 🔸 deliberate deviation (reasoned).

| Block | HTML / spec | Implemented | Match |
|---|---|---|---|
| Header band | band bg, pad 22/18/18 + top inset, cream ink | `styles.band` bg `band`, pad 18h/18b + `insets.top+22` | ✅ |
| — date | 14/600, opacity .8 | 14 medium(600), opacity .8, bandInk | ✅ |
| — circle name + chevron | 24/800, chevron 17/2.4 opacity .8 | 24 bold(800) + ChevronDown 17/2.4 opacity .8 | ✅ |
| — recipient subtitle | 16, opacity .85 | 16, opacity .85, bandInk | ✅ |
| — bell | 44×44, 2px bandInk border, bell 20; gold badge 21 r6 13/800 | same; badge `goldFill`/`goldInk` 21 r6 13/800 at inset-start −8 | ✅ |
| — emergency | 44×44 filled bandInk, phone 19/2.2 band-colored | same | ✅ |
| Med-loop header | 10×10 btn square + «دورة الدواء · اليوم» 16/800 + «عرض الكل» link | `SectionHeader` | ✅ |
| Count tile | flex 1.05, 2px, r8, card, pad 12/14; label 14/700; 46/900 + /total 22/700; sub 15/600 | same; `dosesGivenSoFar` sub | ✅ |
| Next-dose tile | flex 1, sunken; label 14/700; name 17/800; «time · instr» 16/800 acc | same (dosage = instruction) | ✅ |
| — all-given state | (HTML draws only the pending case) | tok+ok «جميع الجرعات أُعطيت» in the tile | 🔸 Dar calm-empty adaptation |
| Dose bead strip | 5× 40px r6 2px cells, time 14/600 below | `DoseBeadStrip` | ✅ |
| Stat tiles | tok / tacc bg, 2px r8; icon 16; label 15/800; 38/900; sub 15/600 | `StatTile` ×2 (tasks=tok+ok, appts=tacc+acc) | ✅ |
| Next-appt card | card, 44 r8 tacc icon square, when 14/700, title 16/800, loc 14/600, chevron-left 18 | same (Calendar in the square) | ✅ |
| Quick grid | 4-col, card tiles 2px r8, pad 10/4, icon 20 acc, label 14/700 | same | ✅ |
| — glyphs | HTML inline lucide-style SVGs | lucide-react-native (Pill/SquareCheck/Calendar/Heart/DoorOpen/ClipboardList/Stethoscope/Users) | 🔸 doctors: HTML draws a plus-in-circle; used **Stethoscope** for clarity |
| Claim banner | goldFill bg, goldInk text, 2px border, title 16/800, sub 14/600, chevron-left 17 | same | ✅ |
| — glyph | HTML draws a truck/package | kept **HandHelping** (the app's established, semantically-correct claim icon) | 🔸 |
| Dose list | group card 2px r8, rows 2px divider; 40 r6 status square; name 16/800; dosage 14/600; time 14/700; status pill 1.5px r4 icon+text; responsible person+name | same (all states + inline log/edit + correction tray) | ✅ |
| — log button | «تسجيل» btn/btnInk r6 16/800 · «تعديل الحالة» 2px line r6 15/800 | 15/800 for both | 🔸 «تسجيل» is 15 not 16 (1px) |
| Pulse strip | header + share + link; group card; 34 r6 tint square; desc 15/600; time 14/600 | same (dose/task=tok+ok, cancelled=twarn+warn, rest=tacc+acc) | ✅ |
| Emergency banner | terr bg, 2px err border, alert 24; title 16/800 err; sub 14/600 ink; «عرض» err-fill/bg-text r6 16/800 | same | ✅ |
| Tab bar | card bg, 2px top, active btn block, idle mut + dividers | `FigmaTabBar` | ✅ |

### Checkpoint-1 fixes (post-review, user feedback)
1. **Dose bead strip glued to the tiles** → added a 12dp `marginTop` (a `style` prop
   on `DoseBeadStrip`) so the strip detaches from the count/next-dose tiles.
2. **Pulse rows** → raised the row padding to 12/16 so the icon square sits clearly
   off the card edge; the text stays beside the icon (horizontal row, unchanged).
3. **Next-dose name truncated** → removed `numberOfLines` on the next-dose name so a
   long medication name wraps and shows in full (never cut).
4. **Tab bar too large** → shrank it: icon 22→20, label 15→14, padding 12/14 → 9/9.

### Home self-check
- ✅ No new token file; no parallel component (reused Surface/FigmaScreen; added the 2 sanctioned new components).
- ✅ No Arabic hardcoded outside i18next (one new key `dosesGivenSoFar`, ar+en at parity).
- ✅ Body text ≥16 (card titles 16/800, next-dose name 17); meta 14–15 at ≥600 weight only.
- ✅ Every status is icon + text (dose pills carry the icon; bead strip; stat tiles).
- ✅ RTL intact (start/end layout, `isolateLtr` on every time/count/number; forward chevrons point left).
- ✅ Both themes (only token values swap; no hardcoded hex in the screen).
- ✅ Ring a11y preserved: one spoken summary on the bead strip (loopA11y/None), count tile hidden from the reader; individual beads hidden.
- ✅ All behaviour/data/routing/permission logic preserved verbatim (scopeToMine, setStatus, retryToday, subtitle/emergency computation, quick-action routes, pulse scope).
- ✅ Quartet green after the commit.

## Phase 3 — Medications list (frame 6a) — delta

Rollout decision: **screen-by-screen** (user's choice). The list is built with inline
Dar styling scoped to `figma-medications.tsx` + its route — no shared component
(FigmaHeader, FigmaSegmentedTabs, StatusBadge, EmptyState) is restyled, so no other
screen changes. The form (6b) + those shared restyles come next.

| Block | HTML / spec | Implemented | Match |
|---|---|---|---|
| Sub-screen band | band bg + top inset, pad 18/16; 44 bordered back (ChevronRight), centered «الأدوية» 20/800, 44 filled add (managers) | inline band via FigmaScreen `band` slot; native stack header hidden | ✅ |
| Summary pill | card 2px r8; 44 r8 tok square + ok pill; title 16/800 (or «لا جرعات مجدولة اليوم» when 0), sub 14/600 | same (`summaryEmpty` key added) | ✅ |
| Segmented tabs | container 2px r8; active btn+btnInk 16/800; idle mut 16/700 + 2px start divider | inline (not the shared FigmaSegmentedTabs) | ✅ |
| Today doses | grouped 2px-r8 card, rows 2px divider; 40 r6 status square (sunken/twarn/terr/tok); name 16/800; dosage 14/600; time 14/700; status pill 1.5px r4 icon+text; responsible; تسجيل/تعديل الحالة | same (+ log/edit/correction tray preserved) | ✅ |
| Status square (list) | HTML shows a **status** square, not a med-identity pill | status square (given/postponed/missed/unlogged) — matches HTML (the old build showed a Pill chip; corrected) | ✅ |
| Responsible line | HTML: gendered «المسؤول: خالد» / «المسؤولة: سارة» | neutral `responsibleLabel` (person icon + «المسؤول: {name}», never «المسؤولة») — correction #1 | 🔸 keeps the app's fixed neutral role label |
| All-medications | (not drawn) med cards: Pill r6 tacc square + name 16/800 + dosage + active/stopped badge (1.5px pill) + schedule chips + responsible → detail | composed from archetype | ✅ |
| Empty (today) | card; 68px tok circle + ok check 28; «لا جرعات اليوم» 20/800; reassuring 16/600; gold-diamond divider; «استعراض كل الأدوية» bordered button | inline `MedEmpty` (`browseAll` key added → switches to all tab) | ✅ |
| Loading / error | skeleton list / bordered card + retry | `SkeletonList` (kept) / inline error card | ✅ |

**Self-check:** no new token file; no shared component restyled (screen-scoped); no
Arabic hardcoded (2 new keys at ar/en parity); body ≥16; every status icon+text; RTL +
LTR-isolated times; both themes; all behaviour/data/routing/permissions/logging
preserved (scopeToMine, setStatus, tabs, orderedDoses, schedule chips). Quartet green.

## Phase 3 — Add-medication form (frame 6b) — delta

Built inline-Dar, scoped to Medications: a per-screen green **form** band header (not
FigmaFormScreen), inline text fields / chips / toggle / save, and the Dar-restyled
`figma-schedule-fields` (medications-only). The shared **wheel pickers**
(`TimeField`/`DateField`) are reused as-is (behaviour-critical + shared) — their row
gets a Dar polish in the later forms pass. A new additive `useMemberOptions` hook
exposes the responsible-chip options (MemberSelect now consumes it — no behaviour change).

| Block | HTML / spec | Implemented | Match |
|---|---|---|---|
| Form band header | band + top inset; 44 bordered back, title 20/800 + subtitle 14/600 @85%, 44 spacer | inline | ✅ |
| Gold disclaimer | goldFill + goldInk, 2px border, info icon + 15/700 | inline (`medications.disclaimer`) | ✅ |
| Section cards | Surface + section header (10×10 square + 16/800) | Surface + SectionHeader | ✅ |
| Text fields | 2px border, sunken fill, value 16/600, ghost placeholder mut; **error = terr fill + err border + icon + 15/700 message**; label 15/700 + «(مطلوب)» in err | inline `MedField` | ✅ |
| Placeholders | bare example (ghost) | «ميتفورمين» etc. — «مثال:» stripped (correction #2, ar+en) | ✅ |
| Dosage / unit | HTML: value input + unit chips (ملغ/مل/حبة) | rendered the app's free-text `dosage` + `form` fields | 🔸 the value+unit split isn't in the data model (no data change) |
| Extra fields | (HTML shows a subset) | kept the app's full field set (form, with-food, notes, period) — no feature change | 🔸 |
| With-food toggle | 48×28 pill, 2px border, sunken off / btn on, card thumb | inline `DarSwitch` | ✅ |
| Responsible chips | 2px border r8, card / btn(selected)+check, 15/700–800 | inline (via `useMemberOptions`); neutral names | ✅ |
| Days | 7 chips 2px r6, btn+btnInk 14/800 on / card+mut 14/700 off; «كل الأيام» link | `figma-schedule-fields` (Dar) | ✅ |
| Dose times | sunken rows + clock + time 17/800 + chevron; delete = terr+err square; dashed add row 16/800; help + errors | reused TimeField row (as-is) + Dar delete/add/help/errors | 🔸 TimeField/DateField rows reuse the shared picker (Dar polish deferred) |
| Period | start/end DateFields | reused DateField (as-is) | 🔸 |
| Save | btn fill + 2px border r8, 17/800, full-width | inline | ✅ |

**Self-check:** no new token file; only `figma-schedule-fields` (medications-only) +
one additive hook touched — no other screen changes; 3 new copy keys
(`figma.medications.summaryEmpty/browseAll`, `common.required`) + placeholder edits
at ar/en parity; body ≥16; RTL + LTR times; both themes; all validation/submit/guard
behaviour preserved verbatim. Quartet green.

## Invented values (neither spec nor HTML covered)
- `primaryPressed` (darker `btn`): light #0A3A32, dark #6BB3A0.
- `ringTrack` (decorative, ring retired): rgba ink/bandInk @ .12.
- Home copy `careCircle.dashboard.today.dosesGivenSoFar` = «أُعطيت حتى الآن» / "Given so far" (the count-tile sub-label; the HTML shows this line but no repo key existed).
- Next-dose tile "all-given" treatment (tok+ok check) — the HTML only draws the pending-next case.

## Deviations from the mockup (for the checkpoint decision)
1. **Doctors quick-action glyph** — HTML draws a plus-in-circle; I used lucide `Stethoscope` (clearer for «الأطباء»). Say the word to switch to the exact plus-in-circle.
2. **Claim glyph** — HTML draws a truck/package; I kept `HandHelping` (the app's established claim icon, and a better fit for «متاح للتكفّل»). Switchable on request.
3. **«تسجيل» button font** — 15px vs the HTML's 16px (shared style with «تعديل الحالة» at 15). Trivially separable if you want the exact 16.

## Deferrals
- The remaining Phase-2 component restyles (see the sequencing note) land with their
  first screen in Phase 3.
- **Medication detail / editor** (`medication-editor.tsx`, route `/medications/[id]`)
  — the read/edit/activate/delete + schedule-manager + schedule-modal screen. It is a
  *detail* archetype (SCREENS.md maps it to the 7b pattern), not the 6a/6b frames, so
  it will be rebuilt with the detail screens. Its Dar text inputs / chips / pickers /
  sheet chrome ride on the shared-primitive restyle done at that point.
- The wheel `TimeField`/`DateField` **row** display + `PickerSheet`/`FormModal` sheet
  chrome get their Dar polish in the dedicated forms/sheets pass.
- Runtime/visual verification is deferred to the user's device review at each
  checkpoint — the static quartet is green after every commit.
