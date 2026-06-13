# Visual Design Direction & Premium Redesign â€” "Warm Care OS"

**Date:** 2026-06-12
**Status:** Implemented locally. **Not committed.** No SQL, no Supabase CLI, no Edge Function deploy, no Firebase CLI, no EAS build/submit, no commit. The project owner will test on-device and commit.
**Scope:** App-wide **visual / product-design** pass for Sanad (Arabic-first family care coordination). JavaScript/TypeScript/styling + one bundled font asset only â€” **no new native module, no new npm dependency** â€” so it loads on the **existing Development Build** via a Metro reload (no rebuild required to test).

---

## 1. Executive summary

The previous slice fixed the app's *structural* failures (clipping, blank pickers, safe-area, RTL isolation, color-only status). The app worked but still read as a generic Expo template: a flat palette, the system font, emoji used as iconography, look-alike text-only cards, floating gray disclaimers, and stark white primary buttons in dark mode.

This pass gives Sanad a **product identity** without touching a single line of behavior. The direction â€” **Warm Care OS** â€” is a calm, premium, Arabic-first care interface whose identity comes from four deliberate moves, not decoration:

1. **A real typeface.** IBM Plex Sans Arabic (SIL OFL, bundled locally, loaded via `expo-font`) carries Arabic *and* Latin in one harmonious family, with a proper size/weight type scale tuned for Arabic line-heights. This single change does the most to lift the app out of "default RN."
2. **Warm-neutral canvases.** Light mode is a soft porcelain (`#F6F4EF`) with white cards and a whisper-soft shadow; dark mode is warm graphite (`#151412`) with lifted cards â€” never flat white, never pure black.
3. **One identity primitive â€” the `GlyphChip`.** A soft tinted circle holding a non-emoji glyph or an initial letter. It replaces *every* emoji icon (ðŸ’ŠðŸ©ºðŸ””ðŸ†˜â€¦) with one themable, calm visual language and anchors cards, rows, empty states and avatars.
4. **Composed, not stacked.** Cards now have a clear visual hierarchy: a leading chip, a title, quiet metadata, a warm **accent time-chip** for the day's anchor moment, and actions separated by a hairline divider. Disclaimers became contained `InfoBanner`s. Dashboard entry points became one shared `NavCard`. The four "people & settings" links collapsed into a single grouped list.

All work stayed inside `E:\Projects\sanad-mobile`. No backend, schema, RPC, query key, mutation, route, validation, permission gate, notification opt-in path, or date/time format was changed. Locale parity holds at **795 / 795**. `tsc`, `expo-doctor` (21/21), `git diff --check`, and `expo export --platform web` all pass.

---

## 2. The three proposed design directions

### Direction A â€” Warm Care OS *(selected)*
- **Visual philosophy:** A calm, domestic "operating system for a family's care." Warmth and trust over clinical precision; the UI recedes so the person's information is the focus.
- **Color:** Warm porcelain / graphite canvases; one confident brand blue (`#1B5FBE` / `#2F6FD0`); a sand **accent** (`#8A5A17` / `#DDAF63`) reserved for "today/now" anchors; soft semantic tints.
- **Typography:** IBM Plex Sans Arabic; generous Arabic line-heights; hierarchy from size **and** weight steps.
- **Surface language:** Rounded (20pt) cards, hairline border, one whisper-soft elevation step in light mode; tinted "tone" surfaces stay flat.
- **Buttons:** Filled brand primary (darkens on press); quiet warm-neutral secondary; soft error-tinted danger; text-only plain. Optional leading glyph.
- **Lists:** Chip-anchored rows with a title, quiet metadata, and a trailing chevron; actions under a divider.
- **Forms:** Labeled fields with a 2px brand focus ring; grouped sections; sticky save bars; bottom sheets with a grabber.
- **Status:** Soft pill badge â€” tone tint + bold glyph + label, never color-only.
- **Best for:** Older adults and non-technical family caregivers; long daily use; emotional warmth.
- **Risks:** Warmth can drift "soft/childish" if accent is overused â€” mitigated by reserving the accent strictly for time/now anchors.

### Direction B â€” Modern Health Companion
- **Philosophy:** Premium healthcare-SaaS: crisp, structured, data-forward.
- **Color:** Cool neutral greys + teal/indigo brand; tighter tints.
- **Typography:** A more technical grotesk; denser metadata rows.
- **Surfaces:** Flatter cards, stronger 1px borders, table-like rows; minimal elevation.
- **Buttons:** Sharper radii, higher-contrast fills.
- **Lists/forms:** Denser, label-left/value-right rows; segmented controls.
- **Status:** Tighter, more saturated chips.
- **Best for:** Clinically-literate users, dashboards, tablets.
- **Risks:** Reads cooler/more sterile; denser rows and a technical face fight readability for older adults â€” against the core audience.

### Direction C â€” Human Daily Care
- **Philosophy:** Editorial timeline; the day as a story, card-first and rhythmic.
- **Color:** Warm but more expressive per-feature accent colors.
- **Typography:** Larger editorial headings, more contrast between hero and body.
- **Surfaces:** Big, image-/illustration-friendly cards; timeline rails.
- **Buttons:** Pill-heavy, expressive.
- **Lists:** Vertical timeline with time rails and grouped "moments."
- **Status:** Inline narrative chips.
- **Best for:** Engagement, storytelling, a single primary caregiver.
- **Risks:** Per-feature accent colors fight the calm palette and the never-color-only rule; timeline rails add structure the data model (multiple independent feature lists) doesn't naturally produce; most build effort for the least readability gain.

### Why A was selected
The owner's audience is **older adults and family caregivers**, and the brief asks for *calm, trustworthy, warm, highly readable, modern-not-flashy*. Direction A maximizes readability and warmth while still feeling like a serious 2026 product. It also **builds directly on the existing primitives** (`Screen`, `Surface`, `StatusBadge`, `PickerSheet`) rather than replacing them, so it preserves every prior structural and accessibility fix. B trades warmth and readability for a cooler, denser clinical feel that works against the audience; C's expressive per-feature color and timeline rails conflict with the "calm, never color-only" constraints and cost the most for the least readability gain.

---

## 3. Design-system changes

- **Typeface system.** Bundled IBM Plex Sans Arabic (Regular/Medium/SemiBold/Bold, SIL OFL) under `assets/fonts/`, loaded once in the root layout via `expo-font`'s `useFonts`. Each weight is its own family name paired with the matching numeric `fontWeight`, so text falls back cleanly to the system font before assets load or on platforms without them. One family serves Arabic and Latin so mixed content (medication names, emails) is harmonious.
- **Identity primitive (`GlyphChip`).** A tinted circle (sm/md/lg) holding a non-emoji glyph or an initial letter. The single replacement for all emoji icons; tones map to the palette; decorative by default (a11y-hidden) with an optional standalone label.
- **Contained notice (`InfoBanner`).** Tone chip + message + optional action line. Replaces floating gray disclaimer paragraphs and the emoji "ðŸ”” reminders" hint row.
- **Navigation card (`NavCard`).** Chip + title + live subtitle + chevron. One shared implementation for every dashboard / settings entry point, so they're visually identical and RTL-safe.
- **Elevation model.** `CardShadow` token â€” a whisper-soft shadow applied to plain cards in **light** mode only; dark mode separates surfaces by lifted background + hairline border (shadows smear on dark canvases). Tinted/sunken tones stay flat to keep a single elevation step.
- **Pressable cards.** `Surface` now gives Android a native ripple (clipped to the radius) and other platforms a gentle opacity dip.
- **Status badge** retuned: bold glyph + label on a soft tint, calmer padding, brand typeface.
- **Forms:** `FormField` gained a 2px brand **focus ring**; bottom sheets (`FormModal`, `PickerSheet`, `timezone-picker`) gained a **grabber** affordance and a tokenized scrim (`overlay`); picker wheels sit in a `backgroundSunken` well.
- **Navigation chrome:** native Stack headers and the native tab bar now use the brand typeface and brand-tinted active states; the react-navigation container theme is mapped to Sanad's canvas so transitions never flash default colors.

---

## 4. Token changes (`src/constants/theme.ts`)

All prior token keys are **preserved** (every existing consumer keeps working); the rest is additive.

- **Retuned base palette** â€” warm porcelain/graphite canvases, white/graphite cards, warm hairlines (light `#F6F4EF` / `#FFFFFF` / `#E2DFD6`; dark `#151412` / `#201F1B` / `#353329`).
- **Brand** retuned to `#1B5FBE` (light) / `#2F6FD0` (dark) with `primaryPressed`, `primaryBg`, `primaryText`.
- **New tokens:** `textMuted` (quiet metadata tier below `textSecondary`), `backgroundSunken` (wells inside cards), `divider` (intra-surface separators, softer than `border`), `accentFg`/`accentBg` (warm sand "today/now" anchor), `overlay` (modal scrim).
- **New scales/objects:** `FontFamily` (4 weights), `CardShadow` (platform-aware soft elevation), `Radius.card` (20pt standard panel radius).
- Semantic Fg/Bg pairs retuned for the warm canvases; all pass contrast in both themes.

---

## 5. Component changes

**Created:** `glyph-chip.tsx`, `info-banner.tsx`, `nav-card.tsx`.

**Modified (shared):** `theme.ts` (tokens/type/elevation), `themed-text.tsx` (brand-font type scale; title 48â†’30 mobile; link/linkPrimary default to brand color), `button.tsx` (pressed states, soft danger, quiet secondary, optional glyph), `surface.tsx` (shadow + ripple + tones), `status-badge.tsx`, `contact-card.tsx` (initial-letter avatar, divider-separated actions, centered call row), `icon-button.tsx` (pill, tonal press), `form-field.tsx` (focus ring), `form-actions.tsx` (divider token), `form-modal.tsx` (grabber + scrim), `picker-sheet.tsx` (grabber, scrim, sunken wells, plain Cancel), `weekday-selector.tsx` (pill chips), `date-field.tsx` / `time-field.tsx` / `date-time-field.tsx` (tokenized trigger with trailing chevron), `timezone-picker.tsx` (grabber, scrim, tokens), `app-tabs.tsx` (brand-tinted tabs), `_layout.tsx` Ã—2 (font load + nav theme + header font).

**Modified (feature presentation only):** `reminder-notice.tsx` (â†’ `InfoBanner`), `notification-bell.tsx` (labeled pill, no emoji), `notifications-center.tsx` (glyph map, filter pills, unread treatment), `notification-settings.tsx`, `push-status-card.tsx`, `catalog.ts` (removed now-dead emoji `icon` field).

---

## 6. Screen groups improved

- **Home / dashboard** â€” brand greeting; emergency `NavCard`; six feature `NavCard`s (each chip-anchored: medications â—‰, daily-logs âœŽ, vitals â™¡, tasks âœ“, appointments â—·, visits âŒ‚); the four people/settings links collapsed into one grouped, divider-separated list.
- **Medications** â€” dose cards lead with a warm **accent time-chip**; segmented status actions with glyphs under a divider; medication rows are chip + title + chevron.
- **Tasks / Appointments / Visits** â€” disclaimers â†’ muted; add buttons get a ï¼‹ glyph; cards use the time-chip anchor + status glyphs; action rows divider-separated and wrap gracefully; dashboard cards â†’ `NavCard`; editors use a clean label/value hierarchy.
- **Daily logs / Vitals** â€” chip-anchored navigable rows; whole `YYYY-MM-DD HH:MM` kept as one LTR unit; cards â†’ `NavCard`.
- **Doctors / Emergency contacts** â€” `ContactCard` with initial-letter avatar + one-tap LTR call row; emergency card has a clear medical label/value hierarchy with dividers.
- **Members / Invitations** â€” member rows get initial-letter avatars + divider-separated actions; invitation code is a centered hero in a sunken well; role modal selection = check + bold + tint.
- **Notifications** â€” per-type `GlyphChip`; pill filter chips with âœ“; unread rows raised, read rows sunken; enable-push prompt â†’ `InfoBanner`.
- **Account / Auth** â€” account links as a grouped list; email in a sunken well; auth screens migrated to `FormField` (all input semantics preserved) with brand title hierarchy and generous rhythm.

---

## 7. Files created

| File | Purpose |
|------|---------|
| `src/components/glyph-chip.tsx` | Tinted-circle glyph/letterform anchor â€” the single emoji replacement |
| `src/components/info-banner.tsx` | Contained tinted notice row (disclaimers, reminder hints) |
| `src/components/nav-card.tsx` | Shared dashboard/navigation card (chip + title + subtitle + chevron) |
| `assets/fonts/IBMPlexSansArabic-{Regular,Medium,SemiBold,Bold}.ttf` | Brand typeface (SIL OFL) |
| `assets/fonts/OFL.txt` | Font license |
| `docs/claude-reports/2026-06-12-visual-design-direction-and-premium-redesign.md` | This report |

## 8. Files modified

70 source files (see Â§5 for the shared list; feature screens span medications, tasks, appointments, visits, daily-logs, vitals, doctors, emergency, circle-members, invitations, circle-selection, care-circle, recipient-profile, notifications, account, explore, auth). Net: **+1747 / âˆ’1110** lines.

---

## 9. Behavior explicitly preserved

- No backend calls, query keys, mutations, hooks, navigation routes, validation (zod), permission gating, date/time persistence formats (`YYYY-MM-DD`, `HH:MM`, `''`), or `t()` keys changed.
- Notification opt-in path untouched: `enable()` remains the only permission-prompting path; Android channel-before-prompt preserved; web-unsupported messaging, generic remote payload, no Edge Function/cron/server changes.
- Medical boundaries intact: record / organize / remind / share / acknowledge only â€” no diagnosis, interpretation, recommendation, normal/abnormal judgment, or emergency guarantee was added.
- All prior fixes kept: the `Screen` clipping fix, the repaired picker wheel, safe-area handling, RTL/BiDi `LtrText`/`isolateLtr` (incl. whole-string vitals/daily-logs timestamps), and never-color-only status.
- `catalog.ts`: only a now-dead presentational `icon` field was removed; `labelKey`/`fallbackRoute` and all routing logic are byte-identical (grep-confirmed no reader of `.icon`).
- App config unchanged: `owner: mrbarhum`, `android.package: com.mrbarhum.sanadcare`, `android.googleServicesFile: ./google-services.json`, `extra.eas.projectId: 64d5dd55-2fc6-4f15-805b-534a3444b410`, `expo-notifications` plugin, `expo-dev-client` dependency â€” all verified intact via `expo config --json`.

---

## 10. Validation command results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **Pass** â€” 0 errors (strict TS) |
| `npx expo-doctor` | **21/21 checks passed** |
| `git --no-pager diff --check` | **Clean** (only LFâ†’CRLF advisories; no whitespace errors) |
| `npx expo export --platform web` | **Success (exit 0)** â€” every route bundled; all 4 fonts emitted to `dist/assets`; `dist/` removed afterward |
| locale ar/en parity (node) | **795 / 795**, no missing keys either side |
| `expo config --json` (config integrity) | owner / package / googleServicesFile / eas.projectId / plugins all intact |

---

## 11. Remaining design limitations

- **On-device verification pending.** Validated by `tsc` + web export + code review; the brand font rendering, dark-mode warmth, ripple, and bottom-sheet grabbers must still be confirmed on the S24 Ultra (see Â§12). The font loads via Metro on the existing Development Build â€” no rebuild needed.
- **Custom wheel picker retained** (JS-only, no rebuild) â€” unchanged from the prior slice; the new chrome (grabber, sunken wells) is visual only.
- **Glyph iconography, not a vector icon set.** `GlyphChip` uses curated non-emoji Unicode marks. They render via the brand font/system fallback and are consistent and themable, but are simpler than a dedicated SVG icon set; adopting one later (e.g. via an icon font already shipped, no new native module) is a clean follow-up.
- **Native tab icons** still use the existing PNG template assets (the account tab still reuses the home icon, as before) â€” out of scope for this visual pass; only colors/labels were themed.
- **Free-text Arabic medical values** (allergies/conditions) remain non-LTR-isolated by design (only inherently-LTR values are isolated).
- **Light theme** retuned but, like the picker, validated by build + review rather than on-device.

---

## 12. Manual S24 Ultra QA checklist

1. S24 Ultra Development Build, reload JS (no rebuild needed); **confirm the brand font loads** (Arabic should look distinctly Plex, not the system face) and there is no font "flash" at launch.
2. Android **light** theme â€” warm porcelain canvas, white cards show a soft shadow; nothing flat-white.
3. Android **dark** theme â€” warm graphite, lifted cards with hairline borders; no pure black, no white button slabs.
4. **Increased system font size** â€” titles/cards/badges don't clip; Arabic wraps; 48dp targets hold.
5. **Arabic** (default) RTL â€” chips/avatars/chevrons sit at the correct (start/end) edges; nothing flips.
6. **English** locale â€” same layouts mirror correctly.
7. **Dashboard** â€” six feature `NavCard`s + grouped people/settings list; emergency card reads clearly; notification pill shows the unread count.
8. **Medications** â€” dose cards show the warm accent **time-chip**; status actions (given âœ“ / postponed â—· / missed âœ•) segment under a divider and wrap gracefully; status badge glyph + label.
9. **Medication schedule** weekday pills â€” opt-in rules intact; pill selection shows âœ“ + bold.
10. **Android time picker** â€” grabber visible, **wheel renders** in a sunken well, select & persist, reopen shows saved value.
11. **Task / Appointment / Visit date & time pickers** â€” visible wheels; select & persist; Clear works on optional fields.
12. **Quiet-hours** time picker (notification settings).
13. **Notification permission** state accurate; **no auto-prompt** at launch; enable prompt appears as an `InfoBanner`.
14. **Local notification test** â€” easy to find; fires.
15. **Notification center** â€” per-type glyph chips, pill filters (âœ“ on active), unread rows raised vs read sunken, timestamps LTR.
16. **Contacts/doctors** â€” initial-letter avatar; one-tap **call** works; phone renders LTR.
17. **Invitation code** â€” centered hero in a sunken well, selectable, LTR; copy/share work.
18. **Members** â€” avatars, owner/you badges, divider-separated actions; last-admin lock messaging intact.
19. **Auth** â€” email/password fields keep correct keyboards (email / secure), brand focus ring; sign-in/up still validate and route.
20. **Forms** â€” sticky save bars; keyboard doesn't cover focused fields; unsaved-changes guards still trigger.
21. **Android hardware back** â€” dismisses sheets/modals predictably; backdrop scrim tap cancels pickers.
22. **Buttons** â€” primary darkens on press; danger reads clearly destructive (soft tint + error text); Android ripple on cards.
23. **Long Arabic** titles/notes wrap cleanly; **English medication names** render LTR inside Arabic cards.
24. **Small-width web** (320â€“412) â€” no clipping; **desktop web** â€” content caps and centers; web fonts load.
25. **Circle switching** + cache isolation still correct; removed-member deep-link protection unchanged.

---

## 13. Compliance confirmation

No SQL was applied. No Supabase CLI/login/logout/link/db push, no Edge Function deploy, no cron. No EAS login/logout/init/build/submit. No Firebase CLI action. No `.env` values read or printed; no secrets printed. **No commit, reset, restore, or clean was performed.** No database types, RPC contracts, or backend schemas changed (none were needed). No new native dependency and no new npm package were added (the font is a bundled asset loaded by the already-present `expo-font`). All business rules, RLS assumptions, data contracts, notification privacy, care-circle isolation, and medical boundaries were preserved â€” this pass changed **presentation only**.
