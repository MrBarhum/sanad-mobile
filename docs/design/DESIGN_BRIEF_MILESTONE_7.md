# Design brief — Milestone 7 (Tracks B and C)

**For:** a designer who has never seen this codebase.
**Date:** 2026-07-26 · **Governing plan:** `docs/claude-reports/2026-07-26-milestone-7-plan.md`
**Visual constitution:** `docs/design/design-language.md` ("Dar / دار · الأخضر والرمل"). Where this brief and that document disagree, that document wins. Where either disagrees with `docs/design/design/Sanad Home Directions.dc.html`, **the HTML wins** — it is the pixel source of truth.

This brief covers only work that needs **new frames**:

| Track | Feature | Status |
|---|---|---|
| B1 | Document vault | design now, build after |
| B2 | Ramadan and prayer-time mode | design now, build after |
| B3 | Arabic AI narrator | design now, build after |
| C1 | Hired-caregiver supervision + worker companion | design now, **build nothing** — pending customer validation |

**Track A is not here.** Password recovery, the doctor-summary PDF, dose photos, dependency work, and the rename audit either reuse existing chrome or are already built; they are recorded in the plan.

---

## How to read a frame spec

Every screen below follows the same structure. Nothing is left to interpretation:

- **Governing report** — which of the 18 domain reports in `docs/product-report-2026-07-18/` specifies the behaviour, or "new".
- **Purpose** — one line.
- **Entry point** — the exact existing screen, the exact row or button, and any role gate.
- **Header chrome** — which of the three bands.
- **Content blocks, in order** — what data, from which column, with the proposed i18n key for every label.
- **States to draw** — default · empty · loading · error · validation error · read-only/permission-denied · confirm sheet. A row reading "n/a" means that state genuinely cannot occur on that frame, and why.
- **Reuse these existing components** — exact exported names and file paths. If something is *local to one screen file and not importable*, it says so, and you should expect it to be re-implemented.
- **GENUINELY NEW — no component exists** — the most valuable part of the brief. Read these first.
- **Light / dark + RTL / LTR notes** — which tokens invert, and which values are LTR-isolated.
- **Copy notes** — proposed i18n keys with both Arabic and English values.

---

## Invariants — true of every frame, never restated per screen

1. **Arabic RTL always.** Text aligns to the start. **Forward chevrons point LEFT; back chevrons point RIGHT.** Layout mirrors automatically from start/end properties.
2. **Both themes are first-class.** Every frame exists in light and dark, with **identical layout** — only token values swap. There is no light-only or dark-only screen.
3. **Numeric strings render LTR inside RTL text** — times, dates, values, phone numbers, codes, file sizes, counts. Each is called out per frame.
4. **Body text ≥ 16px.** 14–15px only for short meta labels, and only at ≥ 600 weight. **14 is an absolute floor** — nothing renders below it.
5. **Flat and bordered.** 2px solid borders on almost everything; 1.5px on small status pills and tiny badges. No gradients, no shadows. Radius scale is **8 / 6 / 4 / 999 / 16 only** — do not invent one.
6. **Status is never colour-only.** Always an icon plus an Arabic text label.
7. **Gold (`goldFill`/`goldInk`) is reserved for exactly two things:** an available-to-claim surface, and a one-time or irreversible warning. Nowhere else. Caution is amber `warn`/`twarn`; success is green `ok`/`tok`; accent and info are green `acc`/`tacc`.
8. **Danger is restrained.** Bordered tints and small filled call buttons — never a full-red screen, never alarm styling.
9. **No gamification.** No streaks, points, scores, or badges-as-rewards. Progress reads "3 of 5 doses today", never as an achievement.
10. **Copy voice — calm family warmth.** Simple Modern Standard Arabic, no dialect, short sentences, **gender-neutral** (masdar and impersonal forms — never a masculine imperative, never «المسؤول/المسؤولة»). Never guilt or alarm. Errors say what happened *and* what to do, using «تعذّر …» — never «فشل» or «خطأ». **No exclamation marks, no emojis**, in either locale.
11. **The care recipient is «الشخص الذي تعتني به»** — never a clinical or cold label.
12. **The app stores no gender.** Any "responsible person" affordance is a neutral person icon plus a name.
13. **Motion is subtle and short**, and respects the OS reduced-motion setting.

### One typeface
**Cairo**, weights 400/600/700/800/900, for Arabic *and* Latin. There is no second family. This matters for C1 — see its blockers section.

---

## The components you are extending

The full inventory — every component, prop, default, and token value — is in `src/components/`, `src/components/figma/`, and `src/constants/theme.ts`. The four rules that catch designers out:

- **`GlyphChip`, `FigmaListRow`, `EmptyState`, `StatusBadge` and `Button` take a semantic `IconName`** from a fixed 52-entry registry (`src/constants/icons.ts`) — **never** an arbitrary lucide icon. Where a frame needs a glyph the registry does not have, this brief either proposes a new registry entry or states that the element is **hand-composed** and is not that component.
- **`Surface` is the one card primitive.** There is no second card, no `FigmaCard`, no elevated variant.
- **There are three sheet chromes, and they are deliberately not merged**: `FormModal` (explicit close, keyboard-avoiding, submit/cancel footer), `PickerSheet` (backdrop-cancel, Done/Clear/Cancel), `FigmaBottomSheet` (backdrop-dismiss action sheet). They share chrome; they encode different behaviour contracts.
- **There are three header bands**: `FigmaTabBand` (tab screen), `FigmaHeader` (sub-screen, back square + centered title + action square), and the band inside `FigmaFormScreen` (form screen).

### Things that do not exist yet, anywhere in the app

Every frame that needs one of these calls it out. Collected here so you know the shape of the gap before you start:

| Job | Exists? |
|---|---|
| Image / thumbnail component | **No** — `expo-image` appears only in the unused splash overlay |
| File or attachment row | **No** |
| Document card | **No** |
| PDF or document preview | **No** |
| Search field | **No** — the only search input is a bare `TextInput` inside the timezone picker |
| Progress bar | **No** — the nearest thing is the discrete `DoseBeadStrip` |
| Chart or sparkline | **No**, deliberately — vitals render value + unit as text, because the app is non-diagnostic |
| Language picker | **No** — no `changeLanguage` call exists anywhere |
| Camera / photo capture UI | **No** |
| Toast / snackbar | **No** — feedback is an inline `accessibilityRole="alert"` line or a bottom sheet |
| Calendar month view | **No** — `DateField` is a three-column scroll wheel |
| Numeric stepper | **No** shared one — hand-rolled twice |
| Filter / scope pills | **No** shared one — inline in the tasks screen only |
| Photo avatar | **No** — avatars are letterforms; there is no image-backed avatar |
| Tooltip, accordion, divider, badge primitives | **No** |

---

## What governs the medical boundary

Three of the four features touch health data, and each has a hard line the design must hold:

- **B1 stores files and never reads inside them.** No OCR, no parsing, no extraction, no detected-value chip, no expiry badge. This is what keeps the app out of medical-device classification.
- **B2 surfaces prayer-time anchors and never reschedules a dose.** Moving a dose to Iftar is a clinical decision. The app shows the fasting window, shows which doses fall inside it, and routes to the doctor. It proposes nothing. Ramadan dates are *predictive* and vary ±1 day by moon sighting — never state the start as certain, never hard-gate behaviour on the boundary.
- **B3 restates what was recorded and never interprets it.** It may count and quote; it may never say a value is normal, high, low, improving, or concerning, and may never suggest an action. The non-diagnostic disclaimer is rendered by the UI and pinned below the narration — the model never emits it.

The existing non-diagnostic disclaimers are **verbatim-locked**. Do not reword them.

---


---

## B1 · Document vault (خزانة المستندات)

**Governing report:** new — Milestone 7 (`docs/claude-reports/2026-07-26-milestone-7-plan.md` §5 B1). Entry-point modification touches `docs/product-report-2026-07-18/03-explore-and-account.md`. Nothing in `docs/design/SCREENS.md` covers this feature — every frame below is drawn from scratch.

---

### The one constraint that governs every frame

The vault is **storage only**. It stores a title the user typed, a category the user picked, an optional note the user typed, and a file. **Nothing in the app reads inside the file.** No OCR, no parsing, no extraction, no field detection, no "your last reading was", no auto-titling from the image, no auto-categorising, no expiry detection on an insurance card, no trend, no chart. This is what keeps Sanad out of medical-device classification.

**For the designer, concretely — do not draw any of these, even as a "nice to have":**
- A detected-text overlay, highlight box, or scan frame with corner guides that implies recognition.
- An auto-filled title, date, or category field.
- A "document type detected" chip, an "expires in 30 days" badge, or a "3 results found" summary.
- Any numeric value lifted out of a document and shown as data.

The title is always what the user typed. If the user types nothing, the frame shows a validation error — never a machine-supplied fallback title.

**Both themes, every frame.** Every B1 surface exists in light and dark with identical layout — only token values swap. Draw the image thumbnail, the preview box, and the `FileText` tinted square in both, since the thumbnail border is the only thing separating a loaded image from the `card` fill in dark.

**A note on the error tail, so nobody "fixes" it.** Every failure string below ends «تحقّق من الاتصال وحاول مجددًا.» — that exact tail is the house-canonical error shape prescribed in CLAUDE.md («تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.») and already shipped across the app. It is kept **verbatim** for consistency with the shipped copy, not re-worded. Everywhere B1 mints a *new* sentence — validation, hints, permissions, disclaimers, empties — the wording is masdar / neutral impersonal («يمكن اختيار», «اختيار التصنيف مطلوب», «الاطلاع … متاح»), never a gendered imperative and never the word «المسؤول/المسؤولة».

---

### Category taxonomy (proposed — five values, closed enum)

Stored as a Postgres enum on `care_documents.category`. Five values, no free-text category, no user-created categories (a free-text category would drift and become a de-facto clinical label).

| Enum value | i18n key | Arabic | English |
|---|---|---|---|
| `insurance` | `documents.categories.insurance` | بطاقات التأمين | Insurance cards |
| `lab` | `documents.categories.lab` | نتائج التحاليل | Lab results |
| `prescription` | `documents.categories.prescription` | الوصفات الطبية | Prescriptions |
| `report` | `documents.categories.report` | التقارير الطبية | Medical reports |
| `other` | `documents.categories.other` | أخرى | Other |

Fixed display order everywhere (filter row, list groups, form chips): **insurance → lab → prescription → report → other**. This is the taxonomy's own canonical order and it must be identical in all three places, the same way the A7 feature order is identical everywhere. `other` is always last.

Filter row adds a sixth, non-stored pseudo-value: `documents.filterAll` = «الكل» / "All", always first.

> **Flag for the maintainer, not the designer:** `imaging` (الأشعة) and `discharge` (تقارير الخروج) were considered and left out — the plan's §5 B1 scope names exactly four document kinds. Adding a value later is a migration; the designer should draw the filter row so a sixth or seventh pill scrolls in without relayout.

---

### Data model the frames read from (`care_documents`)

Per the plan §5 B1. Every label on every frame maps to one of these, and nothing else exists to show:

| Field | Type | Used on which frame |
|---|---|---|
| `id` | uuid | routing only |
| `circle_id` | uuid | never displayed |
| `category` | enum (above) | list group header, list row meta, detail meta, form chips |
| `title` | text, user-typed, required | list row title, detail title |
| `note` | text, user-typed, nullable | detail note well, form field |
| `object_path` | text (storage path, never a URL) | never displayed |
| `mime_type` | text | decides image-preview vs no-preview frame; renders as the type label |
| `size_bytes` | bigint | detail meta line |
| `uploaded_by` | uuid → member | detail meta line via `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`) |
| `created_at` | timestamptz | list row meta, detail meta |

**Sort:** documents have no attention state (nothing is overdue, nothing needs claiming), so the A7 rule falls straight through to chronological — **`created_at` descending, newest first**, within each category group and within the unfiltered list.

**Storage:** private bucket `care-documents`, object path `<circle_id>/<document_id>.<ext>`. Unlike A5's dose photos, there is no per-item responsibility narrowing, so the read predicate is plain circle membership — which is why **every active member can view every document** (the A1 transparent-circle posture) while mutation stays role-gated.

---

### Entry point — the Explore row (modification to frame 8a)

`src/app/(app)/(tabs)/explore.tsx` holds three grouped section cards. Add **one `FigmaListRow` as the fifth and last row of the second section, «الصحة والمتابعة» (`healthFollowup`)** — after «بطاقة الطوارئ». The four existing rows keep their exact order and tones; nothing above it moves.

The row needs exactly the `ExploreItem` shape already defined at `explore.tsx:14-21`:

| Field | Value |
|---|---|
| `id` | `'documents'` |
| `route` | `'/documents'` |
| `titleKey` | `'documents.title'` |
| `subtitleKey` | `'figma.explore.items.documents'` |
| `tone` | `'primary'` (`GlyphChipTone`) |
| `iconName` | `'document'` — **this name does not exist in the 52-entry registry** at `src/constants/icons.ts`. See GENUINELY NEW below. |

Visually the row is identical to the four above it: 40dp tinted icon square, 16/800 title, 14/600 subtitle, 2px top divider, left-pointing chevron. `topDivider={i > 0}` is already handled by the map. **There is nothing new to draw for Explore** — the designer only needs to supply the icon glyph.

Routes to add (mirroring `src/app/(app)/vitals/`): `src/app/(app)/documents/index.tsx`, `documents/new.tsx`, `documents/[id].tsx`, each wrapped in `CircleGate` exactly as `src/app/(app)/doctors.tsx:6-10` does.

---

### B1-1 · خزانة المستندات / Document vault — list
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** One place to find every stored care document, grouped by category.
**Entry point:** Explore tab → «الصحة والمتابعة» section → the new «المستندات» row (see above). No role gate on entry — every active circle member reaches this screen; the **add** affordance is what's gated.
**Header chrome:** `FigmaHeader` (sub-screen band, `src/components/figma/figma-header.tsx:30`) — 44×44 bordered back square at start (`ChevronRight`, RTL back), centered 20/800 title `documents.title`, and at the end either the 44×44 filled add square (`Plus`) when the member may upload, or `FigmaHeader`'s built-in empty 44dp spacer when they may not. Same three-state end slot as `FigmaVitals` (`figma-vitals.tsx:70-75`).

**Content blocks, in order:**
1. **Storage-only note** — a tint well, identical construction to the vitals disclaimer block (`figma-vitals.tsx:79-84`): `primaryBg` fill, 2px `border`, lucide `Info` at 18/2.2 in `primaryText`, 14/700 line in `text`, radius 8, padding 11v/14h. Copy = `documents.disclaimer`. **Do NOT use `FigmaFormScreen`'s gold `disclaimer` prop or any gold fill here** — see the gold note under B1-3.
2. **Category filter row** — a horizontally scrolling row of 6 bordered pills (radius 999, 2px border; active = `primary` fill + `onPrimary` 15/800; inactive = `backgroundElement` + `textSecondary` 15/700), order: الكل · بطاقات التأمين · نتائج التحاليل · الوصفات الطبية · التقارير الطبية · أخرى. Data = client-side filter over the loaded rows; no server round-trip. **This is not `FigmaSegmentedTabs`** — six equal cells at 390px would be ~62px each and 16px Arabic labels do not fit. See GENUINELY NEW.
3. **Category groups**, in taxonomy order, each = a `SectionHeader` (`src/components/section-header.tsx:23` — 10×10 solid `primary` square + 16/800 title) with the category label, plus the group's item count passed through `SectionHeader`'s `trailing` prop as a **bare LTR-isolated numeral** (not a pluralised noun — see Copy notes). Under each header, one `Surface tone="card" padded={0}` holding that group's rows separated by 2px dividers (the `explore.tsx:158-170` grouped-card idiom).
   - When a single category filter is active, only that one group renders and its `SectionHeader` is omitted (the filter pill already names it).
4. **Document row** — a `FigmaListRow`-shaped row, but it needs a thumbnail where `FigmaListRow` draws an icon square, so it is a **new local row component**, not `FigmaListRow` itself. Composition, start→end: a 44×44 bordered square (radius 6 = `Radius.control`) that holds **either** the image thumbnail (`expo-image`, `contentFit="cover"`) for `image/*` **or** a tinted square (`primaryBg` fill, 2px `border`) holding lucide `FileText` at 20/2.2 in `primaryText` for every non-image type; then the title (16/800, `numberOfLines={1}`, from `title`); then a 14/600 `textSecondary` meta line composing `«{category} · {YYYY-MM-DD}»` with the same inline `'  ·  '` join `figma-doctors.tsx:147` uses; then a left-pointing `ChevronLeft`. minHeight 64.
   - **Both leading squares are hand-composed — neither is `GlyphChip`.** `GlyphChip`'s diameters are fixed at 28 / 34 / 40 / 64 (`glyph-chip.tsx:41`) and none of them is 44, and it takes a semantic `IconName` from the registry, never a lucide component. The 44×44 square is drawn locally so the image variant and the icon variant share one geometry.
5. Tap a row → B1-4 (image) or B1-5 (non-previewable), route `/documents/<id>`.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | Note well + filter row (الكل active) + all five category groups present, each with 1–3 rows. Draw at least one image-thumbnail row and one `FileText` row so both row variants are specified. |
| empty | Note well + filter row (الكل active) + `EmptyState` (`src/components/states.tsx:52`) with `iconName="document"`, title `documents.emptyTitle`, and subtitle `documents.emptySubtitle` **only when the member may upload** — omit the subtitle for read-only, exactly as `figma-vitals.tsx:125` and `figma-doctors.tsx:86` do. |
| empty — filtered | A category pill is active and that category has nothing: note well + filter row + `EmptyState` with `iconName="document"` and title `documents.emptyCategoryTitle`, **no subtitle** (the fix is to change the filter, not to add a document). |
| loading | Note well renders immediately, then `SkeletonList` (`src/components/skeleton.tsx:69`, `count={4}`) in place of the groups. Filter row is hidden while loading — filtering nothing is meaningless. |
| error | Note well + the bespoke bordered error card the Dar list screens all re-code inline (`figma-doctors.tsx:73-81`): `backgroundElement` fill, 2px `border`, radius 8, padding 20, a centered 16/700 `errorFg` line = `documents.loadError`, and a centered filled retry pill (`primary` fill, `onPrimary` 15/800, radius 8, 2px border, minHeight 44) reading the root `retry` key («إعادة المحاولة»). |
| validation error | n/a — no input on this screen. |
| read-only / permission-denied | See B1-9. The only differences on this frame: the header's end slot is the empty 44dp spacer, the `EmptyState` subtitle is omitted, and a neutral `InfoBanner` sits under the note well. |
| confirm sheet | n/a on the list itself. **Do not draw an inline delete two-step on the list row.** Delete lives only on the detail screen (B1-6), so a mis-tap on a crowded list cannot destroy a file. |

**Reuse these existing components:**
- `FigmaScreen` — `src/components/figma/figma-screen.tsx:31`
- `FigmaHeader` — `src/components/figma/figma-header.tsx:30`
- `SectionHeader` (with `trailing`) — `src/components/section-header.tsx:23`
- `Surface` (`tone="card"`, `padded={0}`, `radius={Radius.card}`) — `src/components/surface.tsx:72`
- `EmptyState` (`iconName="document"`, which renders its own circle `GlyphChip` internally), `SkeletonList` — `src/components/states.tsx:52`, `src/components/skeleton.tsx:69`
- `InfoBanner` (read-only note) — `src/components/info-banner.tsx:33`
- `isolateLtr` — `src/components/ltr-text.tsx:29`
- lucide `Info`, `FileText`, `ChevronLeft`, `Plus` — all four already imported elsewhere in the app. They are used **only** inside hand-composed views on this screen; none of them is ever passed to a component whose prop is `iconName?: IconName`.
- **Not `GlyphChip`.** The list row's 44×44 leading square is hand-composed (see block 4). `GlyphChip` appears on this screen only *inside* `EmptyState`, which resolves it from the semantic `iconName`.

**GENUINELY NEW — no component exists:**
1. **Image thumbnail.** There is no product image component anywhere in `src/features/`. `expo-image` is a dependency but is used only in the unused splash leftover (`src/components/animated-icon.tsx`). No aspect-ratio box, no placeholder, no failed-load fallback, no remote-image handling exists. The 44×44 bordered thumbnail square (fill, radius 6, 2px `border`) and its three states (loading / loaded / failed) must be drawn from scratch. Note for build: it needs `cachePolicy="memory-disk"` plus a stable `recyclingKey`/`cacheKey` of the object path, because Supabase signed-URL tokens rotate on every `createSignedUrl` and would otherwise miss cache on every render.
2. **Document / file row.** No attachment row, no file row, no document card exists anywhere in `src/`. `FigmaListRow` cannot be reused as-is because its leading slot takes an `iconName`/`avatarText`, not an image.
3. **Filter-pill row.** No shared filter-pill component. The only precedent is inline in `src/features/tasks/figma-tasks.tsx:243-268` (style at `:647`) and it is a fixed 2-pill row, not scrollable. A horizontally scrolling pill rail with a scroll-edge affordance is new.
4. **Count badge.** No badge/count primitive; the one count badge in the app is hand-built inline at `figma-home.tsx:297`.
5. **Divider.** No divider primitive — every screen writes `{height: 2, backgroundColor: border}` by hand.
6. **`document` semantic icon.** None of the 52 names in `src/constants/icons.ts` covers a document, file, or folder. A new registry entry is required (proposed: `document` → ionicons `document-text-outline`, non-directional) because the **Explore `FigmaListRow`** and the **vault `EmptyState`** both take a semantic `IconName`, not a lucide component. (It is also what B1-3 and B1-5 feed to `GlyphChip`.)
7. **Pull-to-refresh.** Not wired anywhere in the app; `Screen` accepts a `refreshControl` prop that no screen passes. If the vault should refresh on pull, that is a first.

**Light / dark + RTL / LTR notes:** the whole screen is drawn twice — light and dark, identical layout, only token values swap. In dark the thumbnail's 2px `border` is the only thing separating a loaded photo from the `card` fill, so draw the loaded, loading and failed thumbnail states in dark as well as light. The row meta date (`YYYY-MM-DD`) is LTR-isolated with `isolateLtr()`. The group count numeral is LTR-isolated. The category label and the title are Arabic and follow the RTL flow. The row chevron points **left** (forward); the header back chevron points **right**. Layout uses start/end props throughout so the thumbnail sits on the right in RTL.

**Copy notes:**
```
documents.title                      ar «المستندات»                      en "Documents"
figma.explore.items.documents        ar «التأمين والتحاليل والوصفات والتقارير»
                                     en "Insurance, lab results, prescriptions and reports"
documents.add                        ar «إضافة مستند»                    en "Add document"
documents.disclaimer                 ar «مساحة لحفظ صور ومستندات الرعاية. لا يقرأ التطبيق محتوى الملف ولا يفسّر أي قيمة فيه.»
                                     en "A place to keep care images and documents. The app does not read the file's contents or interpret any value in it."
documents.filterAll                  ar «الكل»                           en "All"
documents.categories.insurance       ar «بطاقات التأمين»                 en "Insurance cards"
documents.categories.lab             ar «نتائج التحاليل»                 en "Lab results"
documents.categories.prescription    ar «الوصفات الطبية»                 en "Prescriptions"
documents.categories.report          ar «التقارير الطبية»                en "Medical reports"
documents.categories.other           ar «أخرى»                           en "Other"
documents.emptyTitle                 ar «لا مستندات بعد»                 en "No documents yet"
documents.emptySubtitle              ar «يمكن إضافة صورة بطاقة التأمين أو نتيجة تحليل لتكون في متناول اليد عند الحاجة.»
                                     en "Add a photo of an insurance card or a lab result to keep it close at hand when it's needed."
documents.emptyCategoryTitle         ar «لا مستندات في هذا التصنيف»      en "Nothing in this category"
documents.loadError                  ar «تعذّر تحميل المستندات. تحقّق من الاتصال وحاول مجددًا.»
                                     en "Couldn't load the documents. Check your connection and try again."
```
Namespace decision: **one new top-level `documents` namespace — do NOT create a `figma.documents` sub-tree.** `figma.*` is a Milestone-6 restyle artifact for screens that already had strings; B1 is a new feature with no pre-Dar twin, so it follows the `doctors` / `visits` / `vitals` pattern of a single feature namespace. The one exception is the Explore row subtitle, which must live at `figma.explore.items.documents` to match the existing `explore.tsx` `subtitleKey` convention.

Reuse (do not duplicate): root `retry` («إعادة المحاولة» / "Retry"), root `loading`, `common.cancel`, `common.close`, `common.delete`, `common.confirmDelete`, `common.edit`, `common.saveChanges`, `common.unsavedTitle`, `common.unsavedMessage`, `common.discardChanges`, `common.keepEditing`, `validation.tooLong`.

**Count strings — deliberately avoided.** The i18n audit found that **zero** keys in `ar.json` carry an i18next plural suffix while six call sites pass `{count}`, so `«1 أدوية نشطة»` renders today where `«دواء واحد نشط»` belongs. Rather than add an eleventh broken count key, the group header count renders as a **bare LTR-isolated numeral** in `SectionHeader`'s `trailing` slot, with no noun attached. If the maintainer later fixes Arabic plurals properly (`_zero/_one/_two/_few/_many/_other`), a `documents.count` key can replace it.

---

### B1-2 · مصدر المستند / Add document — source choice
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** Choose where the file comes from before any metadata is entered.
**Entry point:** B1-1 header's filled `Plus` square. Role-gated — the square is absent (replaced by `FigmaHeader`'s 44dp spacer) for a member who may not upload.
**Header chrome:** none — this is a bottom sheet, not a screen. `FigmaBottomSheet` (`src/components/figma/figma-bottom-sheet.tsx:29`): backdrop-dismiss action sheet, `theme.overlay` scrim, `backgroundElement` card capped at `MaxFormWidth` 480, `Radius.sheet` (16) top corners, 2px border, 48×8 `backgroundSelected` grab handle, centered **18/800** title, `maxHeight: '85%'`.

**Content blocks, in order:**
1. Sheet title = `documents.source.title`.
2. **Action row — camera.** Full-width bordered row (2px `border`, radius 8, minHeight 52): a 40×40 tinted square (radius 6) with lucide `Camera` + a 16/800 label `documents.source.camera` + an optional 14/600 `textSecondary` hint `documents.source.cameraHint`. Opens `expo-image-picker`'s `launchCameraAsync`.
3. **Action row — photo library.** Same shape, lucide `Image` icon, label `documents.source.library`. Opens `launchImageLibraryAsync`.
4. **Action row — file from device.** Same shape, lucide `FolderOpen` icon, label `documents.source.file`. **BLOCKED — see the note below.**
5. **Cancel row** — a `secondary` `Button` (`src/components/button.tsx:43`, `variant="secondary"`, full width) reading `common.cancel`. The backdrop also dismisses.

> **The leading 40×40 square on rows 2–4 is hand-composed, not `GlyphChip`.** Draw it as a bordered tinted tile — `primaryBg` fill, 2px `border`, `Radius.control` (6) — holding the lucide glyph at 20/2.2 in `primaryText`. `GlyphChip` cannot be used here: its `iconName` prop takes a semantic name from `src/constants/icons.ts`, and the registry has **no** camera, image, or folder entry. Do not add three registry entries for glyphs that appear on exactly one sheet.

> **Draw two versions of this sheet.** The plan's §3 dependency ledger lists `expo-image-picker`, `expo-image-manipulator`, `expo-sharing`, `expo-print`, `expo-file-system` — it does **not** list `expo-document-picker`. Without it, the OS photo picker returns images and videos only, so **a PDF cannot be selected from the device at all**. Version A = three rows (requires adding `expo-document-picker` to the ledger and to the single EAS rebuild). Version B = two rows, camera and library only, no third row and no empty slot. The maintainer must pick before build; both must be drawn. Everything else in B1-5 (a stored PDF that cannot be previewed) still applies either way, because a PDF can arrive in the vault through a future import path or a server-side seed.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | The sheet with all rows enabled (Version A: three; Version B: two). |
| empty | n/a. |
| loading | The brief window between tapping a row and the OS picker appearing needs **no** app-side state — the OS UI takes over. Do not draw a spinner here. |
| error | **Permission denied** — the sheet stays open, the tapped row's hint line is replaced by a 14/700 `errorFg` line with `accessibilityRole="alert"` reading `documents.permission.camera` or `documents.permission.library`. Never a blocking dialog, never an alarm colour block. |
| validation error | **Unsupported type / too large** — after the OS picker returns but before the form opens: the sheet stays open and shows the same inline `errorFg` alert line with `documents.errors.unsupportedType` or `documents.errors.tooLarge` (interpolating the limit). |
| read-only / permission-denied | n/a — the sheet is unreachable; the `Plus` square is absent. |
| confirm sheet | This *is* the sheet. |

**Reuse these existing components:** `FigmaBottomSheet` (`src/components/figma/figma-bottom-sheet.tsx:29`); `Button variant="secondary"` (`src/components/button.tsx:43`). **`GlyphChip` is not used on this sheet** — see the hand-composed note above.

**GENUINELY NEW — no component exists:**
1. **Sheet action row.** There is **no exported sheet-action-row primitive.** It is hand-rolled locally in three places — `SheetButton` at `src/features/tasks/figma-tasks.tsx:366` (tones `primary|danger|secondary`, no icon slot), and inline in `src/app/(app)/(tabs)/account.tsx:263` and `src/features/circle-members/figma-member-actions.tsx:201`. **All three are local to their file, not exports.** The icon+label+hint row above matches none of them exactly and will be a fourth local implementation. Draw it once, precisely.
2. **Camera / photo-library UI.** None exists and none should be built — `expo-image-picker` hands off to the OS. **Do not draw a capture viewfinder, a shutter button, a crop handle, or a gallery grid.** The app owns only the sheet, the permission-denied line, and everything after the picker returns.
3. **lucide glyphs not yet imported anywhere in the repo:** `Camera`, `Image`, `FolderOpen`. (`FileText`, `Share2`, `Trash2`, `Plus`, `X`, `Check`, `AlertCircle`, `Eye`, `Pencil`, `Info`, `ChevronLeft`, `ChevronRight` are already in the in-use set.)

**Light / dark + RTL / LTR notes:** draw the sheet in both themes — the scrim (`theme.overlay`) and the card border are what separate the sheet from the screen behind it, and in dark the border does most of that work. The icon square sits at the start (right in RTL); the label reads start-aligned. Numerics and Latin script on this frame: the size limit interpolated into `documents.errors.tooLarge` is LTR-isolated, and the literal **«PDF»** inside `documents.errors.unsupportedType` is a Latin run inside an Arabic sentence — isolate it with `isolateLtr()` at the call site rather than embedding it bare in the translation value.

**Copy notes:**
```
documents.source.title        ar «إضافة مستند»                     en "Add document"
documents.source.camera       ar «التقاط صورة»                     en "Take a photo"
documents.source.cameraHint   ar «صورة لبطاقة أو ورقة»             en "A photo of a card or a page"
documents.source.library      ar «اختيار من صور الجهاز»            en "Choose from your photos"
documents.source.file         ar «اختيار ملف من الجهاز»            en "Choose a file from this device"
documents.permission.camera   ar «يحتاج التطبيق إذن الكاميرا لالتقاط صورة. يمكن تفعيله من إعدادات الجهاز.»
                              en "The app needs camera access to take a photo. You can turn it on in your device settings."
documents.permission.library  ar «يحتاج التطبيق إذن الوصول إلى الصور. يمكن تفعيله من إعدادات الجهاز.»
                              en "The app needs access to your photos. You can turn it on in your device settings."
documents.errors.unsupportedType ar «نوع الملف غير مدعوم. الأنواع المتاحة: الصور وملفات PDF.»
                                 en "This file type isn't supported. Supported types: images and PDF files."
documents.errors.tooLarge     ar «حجم الملف أكبر من الحد المسموح ({{limit}}). يمكن اختيار صورة أصغر.»
                              en "This file is larger than the allowed limit ({{limit}}). You can choose a smaller image."
```
All in masdar/neutral form (التقاط، اختيار، يمكن …) — no gendered imperative. «تعذّر» is not used here because these are not failures of an operation, they are constraints stated plainly.

---

### B1-3 · إضافة مستند / Add document — metadata form
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** Attach a user-typed title, a category, and an optional note to the picked file, then upload.
**Entry point:** returns from the OS picker in B1-2 with a file in hand. Route `/documents/new`. Same role gate as B1-2.
**Header chrome:** `FigmaFormScreen` (`src/components/figma/figma-form-screen.tsx:25`) — form-screen band: 44dp bordered back square + stacked 20/800 title + 14/600 subtitle at 85%, `insets.top + 16`, plus its KeyboardAvoidingView, scrolling card stack, and in-flow footer.
- `title` = `documents.add`
- `subtitle` = `documents.formSubtitle`
- `onBack` — required; wired through `UnsavedChangesGuard` (`src/components/unsaved-changes-guard.tsx:12`) so a dirty form prompts with `common.unsavedTitle` / `common.unsavedMessage` / `common.discardChanges` / `common.keepEditing`.
- **`disclaimer` prop: leave undefined.** See the gold note below.

**Content blocks, in order:**
1. **Picked-file card** — a `Surface tone="card" padded={14} gap={12}`. For an image: a bordered preview box (radius 8, 2px `border`, `contentFit="contain"`, capped at ~180dp tall) showing the picked image. For a non-image: a `GlyphChip size="lg" tone="primary" iconName="document"` — which resolves to exactly the intended square: **64×64, `Radius.control` (6), 2px `border`, `primaryBg` fill, `primaryText` glyph at 28** (`glyph-chip.tsx:41,76,80`) — plus a type/size meta line. (This is the one place `GlyphChip` is genuinely reusable in B1, and it works only because `document` is being added to the semantic registry; `GlyphChip` never takes a lucide component.) Below either: a `plain`-variant `Button` («تغيير الملف» / `documents.changeFile`) that reopens B1-2. **No crop tool, no rotate, no filter, no markup** — none exists and none is in scope.
2. **Storage-only note** — the same `primaryBg` tint well as B1-1 block 1, copy `documents.disclaimer`.
3. **Title field** — `FormField` (`src/components/form-field.tsx:36`), `label` = `documents.fields.title`, `required` → renders « (مطلوب)» in `errorFg`, `placeholder` = `documents.placeholders.title`. **The placeholder is a bare ghost example, not a «مثال: …» prefix** — this is the standing Milestone-6 design correction #2.
4. **Category selector** — `OptionSelect` (`src/components/option-select.tsx:43`), `variant="chip"` (default), `label` = `documents.fields.category`, five options in taxonomy order. Chips are 2px-bordered radius-8, minHeight 48; selected = `primary` fill + `onPrimary` + a leading `Check`. **No default selection** — the user must choose, because a defaulted category is the app making a filing judgement.
5. **Note field** — `FormField`, `multiline` (minHeight 84, top-aligned), `label` = `documents.fields.note`, `placeholder` = `documents.placeholders.note`, optional (no `required`).
6. **Footer** — `FigmaFooterPrimaryButton` (`src/components/figma/figma-footer-primary-button.tsx:35`) passed to `FigmaFormScreen`'s `footer` slot. Label = `documents.add`. It has `loading` and deliberately has **no** `disabled` and no `variant` — the form-screen law is that the save button is always tappable and validation is what stops the submit. Do not draw a greyed-out save.

> **Gold trap — read this.** `FigmaFormScreen` has a `disclaimer` prop that renders a **gold** (`goldFill`/`goldInk`) banner as the first card, and the vitals *form* uses it for the verbatim-locked non-diagnostic medical disclaimer. **Do not reach for it here.** The M6 law reserves gold for exactly two things — available-to-claim surfaces and one-time/irreversible warnings — and a storage-only note is neither. Render `documents.disclaimer` as the `primaryBg` (tacc) info well instead. Nothing in the entire B1 feature uses gold.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | All five blocks, image preview populated, no category selected, footer idle. |
| empty | n/a — the form is never reached without a picked file. |
| loading | n/a on entry (no data is fetched). See "upload in progress" in B1-8. |
| error | Submit failed — see B1-8. |
| validation error | Two independent field errors, drawn on one frame: (a) **title empty** — `FormField`'s error row: `terr` fill, 2px `err` border on the input, lucide `AlertCircle`, 14/700 `errorFg` message = `documents.errors.title`; (b) **no category chosen** — `OptionSelect` has no built-in error slot, so a matching 14/700 `errorFg` line with `AlertCircle` renders directly beneath the chip row = `documents.errors.category`. Both carry `accessibilityRole="alert"`. The save button stays enabled (Dar law, frame 6b). |
| read-only / permission-denied | n/a — unreachable for a read-only member. |
| confirm sheet | **Discard-changes prompt** on back with a dirty form. This is the `confirmAction()` path (`src/utils/confirm.ts:16`) — a platform `Alert`, **not** a drawn sheet. Nothing to design; note it in the flow only. |

**Reuse these existing components:** `FigmaFormScreen`, `FigmaFieldLabel`, `FigmaSectionLabel` (all `src/components/figma/figma-form-screen.tsx`); `FormField` (`src/components/form-field.tsx:36`); `OptionSelect` (`src/components/option-select.tsx:43`); `Surface` (`src/components/surface.tsx:72`); `FigmaFooterPrimaryButton` (`src/components/figma/figma-footer-primary-button.tsx:35`); `Button variant="plain"` (`src/components/button.tsx:43`); `UnsavedChangesGuard` (`src/components/unsaved-changes-guard.tsx:12`); `GlyphChip` (`src/components/glyph-chip.tsx:65`) — with `iconName="document"`, the semantic registry name, never a lucide component; lucide `Info`, `AlertCircle`, `Check` (all three live inside hand-composed views, never in an `iconName` slot).

**GENUINELY NEW — no component exists:**
1. **Image preview box** (the ~180dp bordered contain-fit box) — again, no image component exists.
2. **Picked-file card** — no file/attachment card exists. (Its 64×64 chip is `GlyphChip size="lg"`; the card around it is new.)
3. **Image editing of any kind** — no crop, no rotate, no markup, no redaction. Not in scope, nothing to draw. (Note for build: `expo-image-manipulator` will resize and compress silently — proposed **2000px long edge at quality 0.8**, deliberately higher than A5's 1280/0.7 dose thumbnail because small print on an insurance card must stay legible. This is a legibility-vs-storage call the maintainer should confirm; the Free plan caps total storage at 1 GB.)
4. **A field-level error slot on `OptionSelect`** — `WeekdaySelector` has an `error` prop but `OptionSelect` does not; the error line must be composed alongside it.

**Light / dark + RTL / LTR notes:** draw every block in both themes; in dark the ~180dp preview box's 2px `border` is the only edge between the image and the `card` fill, and the selected `primary`+`onPrimary` chip inverts, so both chip states need a dark frame. The file-size meta on the picked-file card is `LTR numeral + Arabic unit word` — isolate only the numeral. The type label («PDF») is LTR-isolated. Labels, placeholders, chips, and the note field are Arabic RTL, start-aligned. `OptionSelect` chips wrap right-to-left.

**Copy notes:**
```
documents.formSubtitle       ar «عنوان وتصنيف يساعدان على إيجاده لاحقًا»
                             en "A title and a category that help you find it later"
documents.changeFile         ar «تغيير الملف»                     en "Change file"
documents.fields.title       ar «عنوان المستند»                   en "Document title"
documents.fields.category    ar «التصنيف»                         en "Category"
documents.fields.note        ar «ملاحظة»                          en "Note"
documents.placeholders.title ar «تحليل دم — مستشفى الملك فهد»     en "Blood test — King Fahd Hospital"
documents.placeholders.note  ar «تفاصيل تساعد على تمييزه لاحقًا»  en "Details that help you recognise it later"
documents.errors.title       ar «عنوان المستند مطلوب»             en "A document title is required"
documents.errors.category    ar «اختيار التصنيف مطلوب»            en "Choosing a category is required"
documents.units.kb           ar «كيلوبايت»                        en "KB"
documents.units.mb           ar «ميغابايت»                        en "MB"
documents.fileType.pdf       ar «PDF»                             en "PDF"
documents.fileType.image     ar «صورة»                            en "Image"
```
Validation copy is a neutral noun phrase («عنوان المستند مطلوب»), not a masculine imperative — the newer exemplar voice (`doctors.emptySubtitle` «يمكن إضافة طبيب…») over the older imperative (`figma.doctors.emptySubtitle` «أضف طبيبًا…»). Units are full words, not abbreviations, for older readers.

---

### B1-4 · تفاصيل المستند / Document detail — image
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** View one stored image document at readable size, and act on it.
**Entry point:** tap any row on B1-1 whose `mime_type` starts with `image/`. Route `/documents/<id>`. No role gate on viewing — every active member reaches it.
**Header chrome:** `FigmaHeader` — back square at start, centered 20/800 title = the document's own `title` (truncated to one line), and at the end a 44×44 **bordered** square holding lucide `Share2` passed through `FigmaHeader`'s `trailing` prop. `FigmaHeader` has exactly one end slot, so **delete does not live in the header** — it lives in the card footer. The square's exact treatment is specified in B1-7 block 1 (`band` fill, `bandInk` border and glyph — never a `backgroundElement` fill on the band).

**Content blocks, in order:**
1. **Preview** — a bordered container (2px `border`, radius 8, `backgroundSunken` fill behind the image), the image at `contentFit="contain"`, width = content width, height capped ~420dp. Tapping it opens the full-screen viewer (B1-4a below).
2. **Meta card** — a `Surface tone="card" padded={14} gap={10}` with three rows, each a 14/600 `textSecondary` label and a 16/700 `text` value:
   - Category → `documents.categories.*`
   - Added → `«{YYYY-MM-DD} · {أُضيف بواسطة NAME}»`, from `created_at` and `uploaded_by` → `memberDisplayName()`
   - File → `«{type} · {size}»`, from `mime_type` and `size_bytes`
3. **Note well** — only when `note` is non-empty: a `backgroundSunken` well, 2px `border`, radius 8, 14/600 `textSecondary` text at line-height ≥1.5×, exactly the `contacts-manager.tsx:198-201` notes-well shape.
4. **Actions** — a 2px `backgroundSunken` divider, then the card-footer action pair from `figma-doctors.tsx:198-228`: an outline «تعديل» pill (lucide `Pencil`) opening B1-10, and an outline danger «حذف» pill (lucide `Trash2`) that swaps in place into the two-step confirm (B1-6). Both ≥48dp, radius 8, 2px border, 15/700 label. Rendered **only** for a member who may mutate. Both pills are the local `ActionButton` idiom (see the reuse list) — the lucide glyphs live inside that hand-composed pill, never in a `Button`'s `iconName` slot.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | Preview loaded, meta card with all three rows, note well present, both action pills. |
| empty | n/a — a detail screen always has a document; a missing id is the error state. |
| loading | Header + a `Skeleton` block (`src/components/skeleton.tsx:36`) at the preview's exact dimensions, `radius={Radius.card}`, plus `SkeletonList count={1}` for the meta card. The image has its **own** second-stage loading — the row/document metadata arrives from Postgres before the signed URL resolves, so draw a frame where the meta card is populated and the preview is still a pulsing `Skeleton`. |
| error — record | The bespoke bordered error card (as B1-1) with `documents.loadError` + retry. For a deleted/missing id, the same card with `documents.notFound` and **no** retry pill (retrying will not bring it back) — instead a `secondary` `Button` back to the vault. |
| error — image | Record loaded, image failed: the preview box keeps its border and shows a centered `GlyphChip tone="warning" iconName="warning" size="lg"` (the registry's `warning` → ionicons `warning`, the same glyph `ErrorState` uses at `states.tsx:41` — **not** a lucide `AlertCircle`, which `GlyphChip` cannot take), a 15/700 `errorFg` line = `documents.previewLoadFailed`, and a small bordered retry pill. Meta card and actions still render — a broken preview must not block share or delete. |
| validation error | n/a — no input on this screen. |
| read-only / permission-denied | Preview, meta card, and note well identical; the divider and both action pills are **absent**; the header's `Share2` square **remains** (sharing is a read operation). See B1-9. |
| confirm sheet | The inline two-step delete — see B1-6. |

**Reuse these existing components:** `FigmaScreen`; `FigmaHeader` (with `trailing`); `Surface`; `Skeleton` / `SkeletonList`; `GlyphChip` (`src/components/glyph-chip.tsx:65`, always with a semantic `iconName`); `isolateLtr`; `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`); the `figma-doctors.tsx:236-287` local `ActionButton` idiom (tones `muted` / `danger`, `filled` for the confirm step) — note this is a **local** component in that file, not an export, so it will be re-implemented.

**GENUINELY NEW — no component exists:**
1. **Full-bleed image viewer / preview box** — no image component, no aspect-ratio container, no `contentFit` handling anywhere in `src/features/`.
2. **B1-4a · full-screen image viewer (a separate frame to draw).** Tapping the preview opens a full-screen modal: `theme.overlay` scrim, the image at `contentFit="contain"` filling the safe area, and a single 44×44 bordered close square with lucide `X` pinned to the **start** side of the top safe area (RTL-start = right). **There is no lightbox, no pinch-zoom, no double-tap-to-zoom, and no pan anywhere in the app.** `react-native-gesture-handler` and `react-native-reanimated` are both already dependencies so this needs no new native module, but every gesture and every transition is new work. **Draw the frame exactly as specified above — scrim, contain-fit image, one close square, nothing else.** Whether pinch-zoom is in scope is a **maintainer** scope decision to be recorded on the frame as an annotation, not an alternative for the designer to choose between; it matters because an insurance card's small print is the whole reason a viewer exists.
3. **`documents.notFound` dead-end card** — the "it may have been removed" variant with a back button instead of retry is a shape no existing error card has.
4. **lucide `X`** is already in use; **no new glyphs** beyond B1-2's three.

**Light / dark + RTL / LTR notes:** both themes, identical layout; in dark the preview container's `backgroundSunken` fill plus its 2px `border` are what frame a contain-fit image that does not fill the box, so draw the letterboxed case in dark too. `YYYY-MM-DD`, the size numeral, and the type label are each LTR-isolated with `isolateLtr()` — the Arabic unit word («ميغابايت») stays outside the isolate. **`{{name}}` in `documents.addedByValue` comes from `memberDisplayName()`, which may return an email local-part — treat it as untrusted direction and isolate it at the call site, as C1-9 specifies.** The «·» separator is the hardcoded U+060C-adjacent middot the app already uses inline (`figma-doctors.tsx:147`). The header title is Arabic; back chevron points right; the full-screen viewer's close square sits at the RTL start (right).

**Copy notes:**
```
documents.notFound            ar «تعذّر العثور على هذا المستند. ربما حُذف.»
                              en "Couldn't find this document. It may have been removed."
documents.previewLoadFailed   ar «تعذّر عرض الصورة. تحقّق من الاتصال وحاول مجددًا.»
                              en "Couldn't display the image. Check your connection and try again."
documents.meta.category       ar «التصنيف»                          en "Category"
documents.meta.added          ar «الإضافة»                          en "Added"
documents.meta.file           ar «الملف»                            en "File"
documents.addedByValue        ar «أُضيف بواسطة {{name}}»            en "Added by {{name}}"
documents.backToVault         ar «العودة إلى المستندات»             en "Back to documents"
documents.openFullScreen      ar «عرض بملء الشاشة»                  en "View full screen"   (accessibilityLabel)
```
`documents.notFound` deliberately mirrors the exemplar `medications.notFound` word for word in shape — «تعذّر …» plus a reassuring probable cause («ربما»). `documents.meta.added` is a masdar noun, not a verb, so it is gender-neutral.

---

### B1-5 · تفاصيل المستند — ملف لا يمكن عرضه / Document detail — non-previewable file
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** Show everything the app knows about a stored PDF (or any non-image), and hand it off — **there is no in-app viewer.**
**Entry point:** tap any row on B1-1 whose `mime_type` is not `image/*`. Same route `/documents/<id>`, same absence of a view gate.
**Header chrome:** identical to B1-4 — `FigmaHeader` with back square, the document title, and the bordered `Share2` square in the `trailing` slot (treatment per B1-7 block 1).

**Content blocks, in order:**
1. **File card** (replaces B1-4's preview) — a `Surface tone="card" padded={14} gap={12}`, centered content: a `GlyphChip size="lg" tone="primary" iconName="document"` — **64×64, `Radius.control` (6), 2px `border`, `primaryBg` fill, `primaryText` glyph at 28** (`glyph-chip.tsx:41,76,80`), identical to B1-3 block 1's non-image chip; then the document `title` at 18/800 centered, then a 14/600 `textSecondary` centered meta line `«PDF · 1.4 ميغابايت»` with the numeral and the type label LTR-isolated.
2. **No-preview notice** — an `InfoBanner tone="info"` (`src/components/info-banner.tsx:33`) with `text` = `documents.noPreviewTitle`, followed by a `FigmaMutedNote` (`src/components/figma/figma-form-screen.tsx:152`) carrying `documents.noPreviewBody` beneath it. (`InfoBanner`'s props are `text`, `actionText`, `tone`, `onPress`, `accessibilityLabel` — one message line plus an optional action line, so the explanatory second line cannot live inside it.) Tint fill, `Info` icon, 14–15/700 ink text, radius 8. **Not an error tone, not a warning tone, not gold** — this is a plain statement of what the app can and cannot do, and it must read as calm.
3. **Open externally** — a full-width `Button variant="secondary"` (card fill, 2px `line` border, ink 16/800, radius 8) labelled `documents.openExternally`. **GENUINELY NEW:** the button needs a new `src/constants/icons.ts` entry (proposed `openExternal` → ionicons `open-outline`), because `Button.iconName` takes an `IconName`, not a lucide component — the registry's 52 names have nothing for "open externally". Hands the downloaded file to the OS via `expo-sharing`.
4. **Meta card** — identical to B1-4 block 2 (category / added / file).
5. **Note well** — identical to B1-4 block 3, when `note` is non-empty.
6. **Actions** — identical to B1-4 block 4 (edit + delete two-step), mutation-gated. Note that **edit** here edits only the title/category/note — never the file.

> **Say this on the frame, in a designer annotation:** *"There is no PDF renderer in this app and none is planned for Milestone 7. Do not draw a page thumbnail, a first-page render, a page-count indicator, a blurred document preview, or a 'page 1 of 4' control. Nothing in the codebase can produce any of them."*

**States to draw:**

| State | What the designer draws |
|---|---|
| default | File card + info banner + open button + meta card + note well + actions. |
| empty | n/a. |
| loading | Header + `Skeleton` at the file card's dimensions + `SkeletonList count={1}`. No second-stage image load — there is no image. |
| loading — preparing to open | The «فتح بتطبيق آخر» button in its `loading` state (`Button` has a `loading` prop → `ActivityIndicator` in place of the label) plus a 14/700 `textSecondary` status line under it reading `documents.preparing`. **Indeterminate — no percentage, no bar.** The file must be downloaded from the signed URL to a local `file://` before the OS will accept it, and that download reports no progress. |
| error — record | Same as B1-4 (`documents.loadError` + retry; `documents.notFound` + back). |
| error — open failed | A 14/700 `errorFg` line with `accessibilityRole="alert"` directly beneath the open button: `documents.openFailed` when no installed app claims the type, `documents.downloadFailed` when the fetch failed. The button returns to idle so a retry is one tap. |
| validation error | n/a — no input on this screen. |
| read-only / permission-denied | File card, info banner, open button, meta card, note well all identical; divider + edit/delete pills absent; `Share2` header square remains. |
| confirm sheet | The inline two-step delete — B1-6. |

**Reuse these existing components:** `FigmaScreen`; `FigmaHeader`; `Surface`; `InfoBanner` (`src/components/info-banner.tsx:33`); `FigmaMutedNote` (`src/components/figma/figma-form-screen.tsx:152`); `Button variant="secondary"` with `loading` and `iconName="openExternal"` (`src/components/button.tsx:43`); `GlyphChip` (with `iconName="document"`); `Skeleton`; `isolateLtr`; the `figma-doctors.tsx:236-287` `ActionButton` idiom — **local to that file, not an export; it will be re-implemented.**

**GENUINELY NEW — no component exists:**
1. **PDF preview** — nothing. Confirmed zero matches for any PDF viewing code in `src/`.
2. **File card** (the centered 64×64 chip + centered title + type/size line) — no document card exists. The chip itself is `GlyphChip size="lg"`; the card composed around it is new.
3. **`openExternal` semantic icon** in `src/constants/icons.ts` — the registry has no open/external/link entry, and `Button.iconName` is `IconName`-only, so the open-externally button cannot use a lucide glyph. Proposed: `openExternal` → ionicons `open-outline`, non-directional.
4. **Indeterminate busy affordance for a file download** — there is no progress bar, no linear progress, no circular progress anywhere in the app; `SkeletonList` merely borrows `accessibilityRole="progressbar"`. The only honest affordance is the button's own `ActivityIndicator` plus a text line.

**Light / dark + RTL / LTR notes:** both themes, identical layout; the `InfoBanner`'s `infoBg` tint and the file chip's `primaryBg` tint are the two surfaces that shift most between themes, so draw the whole stack twice. «PDF» and the size numeral are LTR-isolated; the unit word is Arabic and stays outside the isolate. The file-card content is centered, so RTL affects only the meta line's internal token order — compose it as `isolateLtr(type) + '  ·  ' + isolateLtr(number) + ' ' + unitWord`.

**Copy notes:**
```
documents.noPreviewTitle   ar «لا يمكن عرض هذا الملف داخل التطبيق»
                           en "This file can't be viewed inside the app"
documents.noPreviewBody    ar «يمكن فتحه بتطبيق آخر على الجهاز، أو مشاركته كما هو.»
                           en "You can open it with another app on this device, or share it as it is."
documents.openExternally   ar «فتح بتطبيق آخر»                  en "Open in another app"
documents.preparing        ar «جارٍ تجهيز الملف…»               en "Preparing the file…"
documents.openFailed       ar «تعذّر فتح الملف. لا يوجد على الجهاز تطبيق يفتح هذا النوع.»
                           en "Couldn't open the file. There's no app on this device that opens this type."
documents.downloadFailed   ar «تعذّر تجهيز الملف. تحقّق من الاتصال وحاول مجددًا.»
                           en "Couldn't prepare the file. Check your connection and try again."
```
`documents.noPreviewTitle` states a limit of the app, never a fault of the user or the file. Both failure strings follow the canonical shape: «تعذّر …» + what to do. No «فشل», no «خطأ», no code.

---

### B1-6 · تأكيد الحذف / Delete confirmation
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** Guard an irreversible file deletion with exactly one sanctioned confirm pattern.
**Entry point:** the «حذف» pill in the actions footer of B1-4 or B1-5. Mutation-gated — the pill does not render for a read-only member.
**Header chrome:** none — this is an in-place transformation of the actions footer, not a new screen or sheet.

**Content blocks, in order:**
1. **The warning line appears first**, above the actions row: a 14/700 `errorFg` line with lucide `AlertTriangle` (already in the in-use lucide set), reading `documents.deleteWarning`. It is present only in the confirming state.
2. **The two action pills swap in place** — the `figma-doctors.tsx:199-216` two-step exactly: the danger pill becomes a **filled** confirm (`dangerSolid` fill, `onError` text, `border`-colored 2px border, `flex: 1.3`) reading `common.confirmDelete`; the edit pill is replaced by a `muted` outline pill reading `common.cancel`. Both ≥48dp, radius 8.
3. On confirm the pill shows an `ActivityIndicator` in `onError`; on success the screen pops back to B1-1 and the row is gone.

> **Sanctioned pattern choice, stated so the designer does not invent a fourth.** The house allows exactly three confirm patterns: `confirmAction()` (a platform Alert), the inline two-step (`ItemActions`), and the bottom-sheet confirm. Use the **inline two-step** here — it is the established pattern for every delete in the app (`contacts-manager.tsx:210`, `figma-doctors.tsx:199`), it is identical on web and native, and it keeps the destructive action anchored to the thing being destroyed. Do not draw a modal dialog. If a heavier confirm is later wanted, it must be the `FigmaBottomSheet` action-sheet chrome, never bespoke.
>
> **Do NOT use gold here.** A delete confirm is destructive and irreversible, but the shipped app's two sanctioned gold surfaces are the available-to-claim UI and the shown-once invite code. Destructive confirmation uses the **restrained danger tone** — `dangerSolid` fill (`#9C4034` light / `#E2907F` dark) with `onError` text, never a bright alarm red, never a full-red screen.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | The idle actions row: outline «تعديل» + outline danger «حذف». |
| empty | n/a. |
| loading | The confirm pill mid-delete: filled `dangerSolid`, `ActivityIndicator` in `onError` replacing the label, cancel pill disabled at 0.7 opacity. |
| error | Delete failed: both pills return to the confirming state and a 14/700 `errorFg` line with `accessibilityRole="alert"` appears above them reading `documents.deleteFailed`. **The row must never silently revert** — every mutation surfaces its failure (house law). |
| validation error | n/a. |
| read-only / permission-denied | n/a — the actions row does not render at all. |
| confirm sheet | This *is* the confirm. Also draw the confirming state itself as its own frame: warning line + filled confirm + cancel. |

**Reuse these existing components:** the `figma-doctors.tsx:236-287` `ActionButton` idiom — **local to that file, not an export, so it will be re-implemented.** That is the named component for this footer, chosen (not left open) so B1-4, B1-5 and B1-6 all draw the same pill: it is the Dar-styled version that carries an icon, which the shared `ItemActions` (`src/components/item-actions.tsx:21`) does not. **Do not use `ItemActions` here** — it is cited only as the precedent for the two-step *behaviour*. lucide `Trash2`, `AlertTriangle`, `Pencil` — all already in use, and all rendered inside the hand-composed pill, never in a `Button`'s `iconName` slot.

**GENUINELY NEW — no component exists:** none for the confirm itself. The one new detail is the **warning line above the two-step** — `ItemActions` and the doctors card both swap the buttons with no accompanying sentence, because a doctor record can be re-typed and a file cannot. If the maintainer prefers strict consistency with the existing delete rows, drop the line; if the irreversibility should be stated, this is a small deliberate addition. **Draw it, and annotate it as a maintainer decision** — it is not a choice for the designer to leave open.

**Light / dark + RTL / LTR notes:** draw idle, confirming and mid-delete in both themes — `dangerSolid` inverts between `#9C4034` (light) and `#E2907F` (dark) while `onError` follows the background token, so the filled confirm pill reads very differently in each and both must be signed off. The confirm pill takes `flex: 1.3` and sits at the **start** (right in RTL), cancel at the end — matching `figma-doctors.tsx:201-216`. No numeric values.

**Copy notes:**
```
documents.deleteWarning  ar «سيُحذف الملف نهائيًا من الخزانة، ولا يمكن التراجع.»
                         en "The file will be permanently removed from the vault, and this can't be undone."
documents.deleteFailed   ar «تعذّر حذف المستند. تحقّق من الاتصال وحاول مجددًا.»
                         en "Couldn't delete the document. Check your connection and try again."
```
Reuse `common.delete`, `common.confirmDelete`, `common.cancel` — do not mint feature-local variants. The warning states the consequence plainly and stops; it does not scold, and it does not use an exclamation mark.

---

### B1-7 · مشاركة المستند / Share action
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** Hand the actual file to the OS share sheet so it can go to a doctor, a pharmacy, or a family member outside the app.
**Entry point:** the bordered 44×44 `Share2` square in the `FigmaHeader` `trailing` slot on B1-4 and B1-5. **Not role-gated** — sharing is a read operation and every member who can view can share, consistent with the A1 transparent-circle posture. Available on both the image and the non-image detail screens, and this is the **only** thing a stored PDF can do besides being opened externally.
**Header chrome:** the action lives *in* B1-4/B1-5's `FigmaHeader`; there is no separate screen.

**Content blocks, in order:**
1. **The share square** — 44×44, **`band` fill (i.e. transparent over the band)**, 2px `bandInk` border, radius 8, lucide `Share2` at 20/2.2 in `bandInk` — matching `FigmaHeader`'s bordered back square, which is bordered-on-band, not `backgroundElement`-filled. (A `backgroundElement` fill would put `#FAF6EA` cream under a `#F4EEDC` cream glyph in light — ~1.03:1 — and the AA pairing law fixes `band`+`bandInk`.) `accessibilityLabel` = `documents.share`.
2. **Busy state** — the square's icon is replaced by a small `ActivityIndicator` in `bandInk` while the file downloads to a local `file://`. A 14/700 status line reading `documents.sharePreparing` appears as the first content block under the header, with `accessibilityRole="status"`.
3. **The OS share sheet itself is system UI.** Nothing to draw.
4. **The frame is drawn one way, and only one way: the bordered `Share2` square in `FigmaHeader`'s `trailing` slot, as specified in block 1.** There is a second existing share idiom in the app — the Pulse header's bordered share pill: *bordered pill, `Radius.pill`, 2px `border`, `backgroundElement` fill, minHeight 36, padH 14, lucide `Share2` at 14px in `primaryText`, label 14/800 `primaryText` (JSX at `figma-pulse.tsx:90-106`, styles at `:178-187`)*. It is recorded here as a **maintainer annotation only**, in case share should later move into the detail card's action row. Do not draw it as an alternative for the designer to pick between, and never ship both on the same screen.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | The bordered `Share2` square in the header end slot. |
| empty | n/a. |
| loading | Square shows `ActivityIndicator`; `documents.sharePreparing` status line under the band. Indeterminate — **no progress bar, no percentage** (there is no progress primitive, and the download reports no progress events). |
| error | A 14/700 `errorFg` line with `accessibilityRole="alert"` in the same position as the status line: `documents.shareFailed` when the download or hand-off fails, `documents.shareUnavailable` when `expo-sharing`'s availability check returns false (some tablets, some emulators). The square returns to idle. |
| validation error | n/a. |
| read-only / permission-denied | Identical — the share square renders for every member who can open the screen. |
| confirm sheet | n/a — sharing is not destructive and needs no guard. |

**Reuse these existing components:** `FigmaHeader`'s `trailing` prop (`src/components/figma/figma-header.tsx:30`); lucide `Share2` (already in use, rendered inside the hand-composed square — never in an `iconName` slot). The Pulse share pill idiom (`figma-pulse.tsx:90-106`, styles `:178-187`) is **local to that file, not an export; it would be re-implemented** — and it is not used on this frame (see block 4).

**GENUINELY NEW — no component exists:**
1. **Toast / snackbar** — **none.** Zero matches for toast or snackbar anywhere in the repo. There is no transient, auto-dismissing, stacking notification surface. Every piece of feedback in this feature — share preparing, share failed, upload failed, delete failed, saved — must be an **inline `accessibilityRole="alert"` / `"status"` text line** in a fixed position, or a `FigmaBottomSheet`. Do not draw a floating toast anywhere in B1.
2. **Bordered header action square** — `FigmaHeader`'s end slot has a *filled* add-square variant built in; a *bordered* action square is a new treatment (it must be drawn precisely, including its `bandInk` border and `bandInk` icon on the `band` fill).
3. **A file-download busy affordance** — same gap as B1-5's "preparing".

**Light / dark + RTL / LTR notes:** draw the square in both themes — `band` is `#0E4A40` in light and `#123B32` in dark while `bandInk` shifts `#F4EEDC` → `#EEE7D4`, so the border-on-band contrast must be checked in each. The share square sits in the header's **end** slot, which is the left in RTL — mirroring the back square on the right. No numeric values on this frame.

**Copy notes:**
```
documents.share             ar «مشاركة»                           en "Share"
documents.sharePreparing    ar «جارٍ تجهيز الملف للمشاركة…»       en "Preparing the file to share…"
documents.shareFailed       ar «تعذّر تجهيز الملف للمشاركة. تحقّق من الاتصال وحاول مجددًا.»
                            en "Couldn't prepare the file to share. Check your connection and try again."
documents.shareUnavailable  ar «المشاركة غير متاحة على هذا الجهاز.»
                            en "Sharing isn't available on this device."
```
`documents.share` is a masdar noun («مشاركة»), matching the existing `pulse.share`. No emoji, no exclamation.

---

### B1-8 · حالات الرفع / Upload in progress and upload failed
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** Show the caregiver, honestly, that the file is going up — and what to do when it doesn't.
**Entry point:** submitting B1-3's footer button. Mutation-gated by construction.
**Header chrome:** stays on B1-3 — `FigmaFormScreen`'s form band, unchanged, back square still present.

**The behavioural decision the designer must draw around:** the upload is **blocking and in-form**, not a background job. Reason: there is no toast, so a background upload that finished (or failed) minutes later on a different screen has **no surface to announce itself on**. Every other form in the app blocks on submit (`FormModal`, `FigmaFormScreen`), and matching that is both cheaper and more honest.

**Content blocks, in order (the in-progress frame):**
1. Every field on B1-3 renders disabled (0.7 opacity, non-editable), so nothing can change mid-upload.
2. The `FigmaFooterPrimaryButton` enters its `loading` state — `ActivityIndicator` in `onPrimary` replacing the 17/800 label. It keeps its full-width `primary` fill, 2px border, radius 8, minHeight 52.
3. A 14/700 `textSecondary` status line above the footer, `accessibilityRole="status"`, reading `documents.uploading`.
4. **No percentage. No progress bar. No byte counter. No ETA.** `supabase-js`'s storage `upload()` exposes **no progress events in React Native**, and the app has **no progress-bar component of any kind** — the nearest visual is `DoseBeadStrip`, which is discrete beads for a completely different job. An indeterminate spinner plus a sentence is the entire honest vocabulary available.

**Content blocks (the failed frame):**
1. Fields re-enable; **the picked file stays in state** so a retry costs no re-pick and no re-photograph. Draw the picked-file card still populated.
2. A 15/700 `errorFg` alert row above the footer with lucide `AlertCircle`, `accessibilityRole="alert"`, reading `documents.uploadFailed`.
3. The footer button returns to idle with its original label — retry is one tap on the same button. Do not add a second "retry" button.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | (B1-3's default.) |
| empty | n/a. |
| loading | The in-progress frame above: disabled fields, `loading` footer, `documents.uploading` status line. |
| error | The failed frame above: `documents.uploadFailed` alert row, fields and file preserved, footer idle. Also draw the **too-large** variant (`documents.errors.tooLarge`) — the server enforces the bucket's `file_size_limit` and can reject after a successful client-side check. |
| validation error | (B1-3's validation frame — title and category. These fire *before* any upload starts.) |
| read-only / permission-denied | n/a — unreachable. |
| confirm sheet | **Leaving mid-upload.** The back square during an upload must not silently abandon the request: guard with the existing `confirmAction()` discard prompt (a platform Alert — nothing to draw), or disable the back square while uploading. Recommend disabling it; it is one less thing to explain. |
| success | On success the screen navigates back to B1-1 and the new row is at the top of its category group. There is **no** success toast (none exists) and **no** celebratory moment — this is a filing action, not an achievement. If any acknowledgement is wanted, it is a quiet 14/700 `successFg` line with a `Check` on the vault list that clears on the next interaction. Draw it as a **separately labelled optional variant** of the B1-1 default frame, annotated as a maintainer decision — not as an open choice in the main frame. |

**Reuse these existing components:** `FigmaFooterPrimaryButton` with `loading` (`src/components/figma/figma-footer-primary-button.tsx:35`); the inline status/alert idiom **inside** `FormActions` (`src/components/form-actions.tsx:45-60`) — `FormActions` itself is exported at `:82`, but that status line is internal to it and is not separately importable, so the pattern is re-implemented here; it already renders an `accessibilityRole="alert"` line with `idle | saved | error` states and is the closest existing precedent for "surface the failure inline". lucide `AlertCircle`, `Check` — both rendered inside hand-composed alert/status rows, never in an `iconName` slot (`FigmaFooterPrimaryButton` has no icon prop at all).

**GENUINELY NEW — no component exists:**
1. **Progress bar / linear progress / circular progress** — **none, at all.** Say it on the frame so nobody draws one.
2. **Toast / snackbar** — **none** (repeated because it governs both the success and failure moments here).
3. **A background/queued upload surface** — there is no offline queue, no mutation persistence, and no network-state awareness anywhere: React Query is memory-only (`{retry: 2, staleTime: 30_000}`), with no persister and no `networkMode`, and `expo-sqlite` is installed with **zero imports**. A "will upload when you're back online" affordance would be inventing infrastructure that does not exist. Do not draw one.

**Light / dark + RTL / LTR notes:** the in-progress, failed and optional-success frames are each drawn in light and dark — the `errorFg` alert row and the `successFg` line both invert (`#9C4034`→`#E2907F`, `#2E6A4E`→`#93C9A6`) and must be legible on `card` in both. The size limit interpolated into `documents.errors.tooLarge` is LTR-isolated. Status and alert lines are Arabic, start-aligned. The `ActivityIndicator` in the footer button is centered and direction-neutral.

**Copy notes:**
```
documents.uploading     ar «جارٍ الرفع…»                       en "Uploading…"
documents.uploadFailed  ar «تعذّر رفع المستند. تحقّق من الاتصال وحاول مجددًا.»
                        en "Couldn't upload the document. Check your connection and try again."
documents.saved         ar «تم حفظ المستند»                    en "Document saved"
```
`documents.uploading` reuses the ellipsis style of the root `loading` («جارٍ التحميل…»). `documents.saved` is a plain statement of fact with no exclamation and no emoji — the quiet-celebration law.

---

### B1-9 · الاطلاع فقط / Read-only member view
**Governing report:** new — Milestone 7 (§5 B1)
**Purpose:** A member who may see every document but may not add, edit, or delete one.
**Entry point:** identical to B1-1 — the Explore row. The screen is the same screen; only the affordances differ.
**Header chrome:** `FigmaHeader` with the back square, the title, and — because `onAdd` is undefined — its **built-in empty 44dp spacer** in the end slot. The title stays optically centered; do not shift it.

**Who this is.** The circle roles are `admin`, `primary_caregiver`, `family_member`, `caregiver`, `remote_member`. `canManageCircle()` (`src/features/circle-selection/permissions.ts:4-6`) = admin + primary_caregiver. `canLogDoses()` (`:9-16`) = admin + primary_caregiver + family_member + caregiver. **Proposed gate, mirroring `FigmaVitals`'s `canAdd = canManage || canCollaborate` (`figma-vitals.tsx:64`):**
- **View** — every active member. No gate.
- **Upload / edit metadata** — `canManage || canLogDoses`.
- **Delete** — `canManage`, or the member who uploaded it (`uploaded_by === auth.uid()`).

So the read-only persona is **`remote_member`**, plus any member looking at a document they did not upload when the delete rule is uploader-scoped.

> **Flag for the maintainer:** the plan's §5 B1 does not settle the mutation gate, and B1 has no D-decision for it the way A5 has D10. The RLS predicate must be decided before build. The gate above is a proposal derived from the closest precedent, not a recorded decision. Note also §7.9 of the plan: the CLAUDE.md "transparent circle" posture and the live RLS have a known discrepancy for `care_tasks` / `care_appointments` / `medication_logs` / `family_visits` — the vault should be written to the *documented* posture (all members view) and that intent should be explicit in the migration.

**Content blocks, in order:** identical to B1-1, with three differences and one addition:
1. Header end slot = spacer, not the filled `Plus` square.
2. `EmptyState` renders **without** its subtitle (the subtitle invites an action this member cannot take) — precedent: `figma-vitals.tsx:125`, `figma-doctors.tsx:86`, `contacts-manager.tsx:116`.
3. On B1-4 / B1-5, the 2px divider and the edit/delete pills are absent. The `Share2` square **stays**.
4. **Addition:** an `InfoBanner tone="neutral"` (`src/components/info-banner.tsx:33`) directly under the storage-only note, reading `documents.readOnlyNote`. Neutral tone, not warning, not error — this is a fact about the role, not a problem.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | Full vault with documents, spacer header, neutral read-only banner, no add square anywhere. |
| empty | Note well + read-only banner + filter row + `EmptyState` with title only, **no subtitle**, no add affordance. |
| loading | Identical to B1-1 loading. |
| error | Identical to B1-1 error. |
| validation error | n/a — no input reachable. |
| read-only / permission-denied | This *is* the frame. Also draw the read-only variant of the **detail** screen (B1-4 and B1-5 with the actions footer removed and the divider gone — the note well becomes the last block). |
| confirm sheet | n/a — nothing destructive is reachable. |

**Reuse these existing components:** everything from B1-1, plus `InfoBanner` (`src/components/info-banner.tsx:33`, `tone="neutral"`).

**GENUINELY NEW — no component exists:** none beyond B1-1's list. There is no permission-denied screen archetype in the app, but none is needed — the correct treatment is *absence of the affordance* plus one calm explanatory banner, never a blocking "you don't have access" wall. The vault is readable by every member by design.

**Light / dark + RTL / LTR notes:** both themes, as B1-1 — and the neutral `InfoBanner`'s `backgroundSunken` tint is the lowest-contrast surface in the section, so its dark frame (`#0E211C` on `#0A1B17`) must be signed off explicitly. RTL is unchanged from B1-1. The banner icon sits at the start; the empty 44dp header spacer preserves the title's optical centering in RTL exactly as it does in LTR.

**Copy notes:**
```
documents.readOnlyNote  ar «الاطلاع على المستندات متاح لجميع أعضاء الدائرة. الإضافة والحذف متاحان لمن لديه صلاحية.»
                        en "Every member of the circle can view the documents. Adding and removing them is for members with permission."
```
Stated as a description of how the circle works, not as a denial aimed at the reader. Gender-neutral throughout (الاطلاع، الإضافة، الحذف — all masdar). No «ليس لديك صلاحية», no «ممنوع», no alarm.

---

### B1-10 · تعديل بيانات المستند / Edit document metadata
**Governing report:** new — Milestone 7 (§5 B1) — **beyond the plan's literal verb list; see the flag below**
**Purpose:** Correct the title, category, or note of an already-stored document. The **file itself is never editable or replaceable.**
**Entry point:** the «تعديل» pill in the actions footer of B1-4 or B1-5. Gated by `canManage || canLogDoses`.
**Header chrome:** none — a `FormModal` (`src/components/form-modal.tsx:34`), the canonical sheet chrome with the **explicit-close** contract: no backdrop dismiss, a 34dp bordered close-X square at the start, KeyboardAvoidingView, and a submit/cancel footer (`FigmaFooterPrimaryButton` + secondary `Button`). Precedent: `contacts-manager.tsx:318-327`, `doctors/doctor-form-modal.tsx:105`.

> **Flag:** the plan's §5 B1 scope reads "Upload, categorize, view, share, delete" — edit is not named. It is specified here because "categorize" implies a category can be *corrected*, and a mis-filed insurance card is otherwise permanently mis-filed or must be deleted and re-uploaded (losing the file). The entire surface is one `FormModal` reusing B1-3's three fields, so the cost is near zero. **If the maintainer drops it, delete this frame and remove the «تعديل» pill from B1-4/B1-5, leaving delete as the only footer action.**

**Content blocks, in order:**
1. Sheet title = `documents.editTitle`.
2. **Read-only file line** — a 14/600 `textSecondary` line naming the file, `«PDF · 1.4 ميغابايت»` or `«صورة · 380 كيلوبايت»`, with a `FigmaMutedNote` (`src/components/figma/figma-form-screen.tsx:152`) beneath it reading `documents.fileNotEditable`. **No change-file button.** Replacing a file would orphan a storage object and make the document's history ambiguous; a new file is a new document.
3. **Title field** — `FormField`, `required`, pre-filled from `title`.
4. **Category selector** — `OptionSelect variant="chip"`, pre-selected from `category`.
5. **Note field** — `FormField multiline`, pre-filled from `note`.
6. Footer — `FigmaFooterPrimaryButton` labelled `common.saveChanges` + secondary `Button` labelled `common.cancel`.

**States to draw:**

| State | What the designer draws |
|---|---|
| default | Sheet with all three fields pre-filled and the read-only file line at the top. |
| empty | n/a — always opened on an existing document. |
| loading | Footer button in `loading` state, fields disabled at 0.7 opacity. |
| error | `FormModal`'s built-in `error` slot: a 15/700 `errorFg` alert row above the footer, `accessibilityRole="alert"`, reading `documents.saveFailed`. Fields keep their edits. |
| validation error | Same two field errors as B1-3: `documents.errors.title` in `FormField`'s error row; `documents.errors.category` as a composed `errorFg` line under the chips. Save stays enabled. |
| read-only / permission-denied | n/a — the «تعديل» pill does not render. |
| confirm sheet | **Discard on close** — `FormModal`'s explicit-close contract routes through `confirmDiscard()` (`src/utils/confirm.ts:42`) with `common.unsavedTitle` / `common.unsavedMessage` / `common.discardChanges` / `common.keepEditing`, exactly as `contacts-manager.tsx:250-264` does. A platform Alert — nothing to draw. |

**Reuse these existing components:** `FormModal` (`src/components/form-modal.tsx:34`); `FormField` (`src/components/form-field.tsx:36`); `OptionSelect` (`src/components/option-select.tsx:43`); `FigmaMutedNote` (`src/components/figma/figma-form-screen.tsx:152`); `FigmaFooterPrimaryButton`; `Button variant="secondary"`; `useUnsavedChanges` (`src/hooks/use-unsaved-changes.ts:15`) + `confirmDiscard` (`src/utils/confirm.ts:42`).

**GENUINELY NEW — no component exists:** none. This frame is composed entirely from shipped primitives — it is the cheapest screen in B1 and the reason edit is worth including.

**Light / dark + RTL / LTR notes:** both themes — the sheet card sits on `theme.overlay` over the detail screen, and the scrim plus the 2px border are the whole separation in dark. The file line's type label and size numeral are LTR-isolated; the unit word stays Arabic. `FormModal` centers its 18/800 title and puts the close-X square at the start (right in RTL).

**Copy notes:**
```
documents.editTitle        ar «تعديل بيانات المستند»            en "Edit document details"
documents.fileNotEditable  ar «الملف نفسه لا يُعدَّل. لتغييره يمكن إضافة مستند جديد.»
                           en "The file itself can't be changed. To replace it, add a new document."
documents.saveFailed       ar «تعذّر حفظ التغييرات. تحقّق من الاتصال وحاول مجددًا.»
                           en "Couldn't save the changes. Check your connection and try again."
```
Reuse `common.saveChanges`, `common.cancel`, `common.close`, `common.unsavedTitle`, `common.unsavedMessage`, `common.discardChanges`, `common.keepEditing` — no feature-local duplicates.

---

### Consolidated GENUINELY NEW list for B1 (the build-cost summary)

Everything B1 needs that has **no component in the codebase today**, in rough order of cost:

| # | Missing thing | Evidence |
|---|---|---|
| 1 | **Any image component** — thumbnail, preview box, full-bleed viewer, aspect-ratio container, load-failed fallback | No `<Image>` in any feature file. `expo-image` is a dependency used only in the unused splash leftover `src/components/animated-icon.tsx`. |
| 2 | **Full-screen image viewer** with close affordance; pinch-zoom / pan if in scope | No lightbox, no modal image viewer, no gesture wiring. `react-native-gesture-handler` + `react-native-reanimated` are dependencies, so no native module is needed — but every gesture and transition is new. |
| 3 | **Document / file row** and **file card** | Zero attachment, file, or document concepts anywhere in `src/`. `FigmaListRow` cannot take an image in its leading slot, and `GlyphChip`'s diameters are fixed at 28/34/40/64 so it cannot be the row's 44×44 square. |
| 4 | **PDF preview** | Nothing. And `expo-document-picker` is **absent from the plan's dependency ledger**, so a PDF cannot even be selected today — B1-2 must be drawn in two versions. |
| 5 | **Horizontally scrolling filter-pill rail** | No shared filter-pill component; only a fixed inline 2-pill row at `src/features/tasks/figma-tasks.tsx:243-268`. `FigmaSegmentedTabs` cannot hold six Arabic labels at 390px. |
| 6 | **Progress bar of any kind** | None in the repo. Compounded: Supabase RN uploads report no progress. All busy states are indeterminate spinner + sentence. |
| 7 | **Toast / snackbar** | Zero matches. Every success and failure is an inline `accessibilityRole="alert"` / `"status"` line or a `FigmaBottomSheet`. |
| 8 | **Sheet action row** (icon + label + hint) | No exported primitive; hand-rolled locally in three places (`figma-tasks.tsx:366`, `account.tsx:263`, `figma-member-actions.tsx:201`), none matching, none exported. |
| 9 | **Bordered header action square** | `FigmaHeader`'s end slot ships a *filled* add square; a bordered `bandInk`-on-`band` variant is new. |
| 10 | **Two semantic icon registry entries** in `src/constants/icons.ts`: `document` (→ ionicons `document-text-outline`) and `openExternal` (→ ionicons `open-outline`) | None of the 52 registry names covers a document/file/folder, and none covers open-externally. `document` is required by `FigmaListRow` (Explore row), `EmptyState` (vault empties) and `GlyphChip` (B1-3, B1-5); `openExternal` by `Button.iconName` (B1-5). All four props are `IconName`-typed and cannot take a lucide component. |
| 11 | **lucide glyphs never imported before:** `Camera`, `Image`, `FolderOpen` | The in-use lucide set (44 glyphs across 31 files) contains none of them. `FileText`, `Share2`, `Trash2`, `Plus`, `X`, `Check`, `AlertCircle`, `AlertTriangle`, `Eye`, `Pencil`, `Info`, `ChevronLeft` are all already in use. (`ExternalLink` is **not** on this list — the open-externally button takes registry entry `openExternal`, not a lucide glyph.) Every lucide glyph in B1 renders inside a hand-composed view; none is ever passed to an `iconName` prop. |
| 12 | **Badge / count primitive** and **divider primitive** | Both hand-built at every call site. |
| 13 | **Camera / gallery UI** | Correctly absent — `expo-image-picker` hands off to the OS. Draw nothing. The permission-denied line is the only app-owned surface. |
| 14 | **Error field slot on `OptionSelect`** | `WeekdaySelector` has `error`; `OptionSelect` does not. |
| 15 | **Pull-to-refresh** | Not wired on any screen. |
| 16 | **Storage quota / usage meter** | None, and retention/quota is an explicitly open decision in the plan (Free-plan Supabase storage is 1 GB total). |


---

## B2 · Ramadan and prayer-time mode (وضع رمضان ومواقيت الصلاة)

**Governing report:** new — Milestone 7, §5 B2 of `docs/claude-reports/2026-07-26-milestone-7-plan.md`. It sits on top of `docs/product-report-2026-07-18/04-medications.md` (the medication schedule + dose list it annotates), `…/02-navigation-and-home.md` (the Home slot), `…/03-explore-and-account.md` (the Account settings row) and `…/14-notifications.md` (the reminder-suppression contract, sibling of quiet hours).

---

### Scope walls — read this before drawing anything

These are hard boundaries. A frame that violates one of them is wrong even if it looks right.

1. **The app surfaces anchors. It never reschedules a dose.** There is no "move to Iftar" button, no "suggested time", no proposed schedule, no comparison of "current vs. Ramadan" times. Moving a dose is a clinical decision. Every frame that shows a dose inside the fasting window ends in *look at this* and *talk to the doctor*, never in *change it*.
2. **No location, ever.** Do not draw a map, a pin, a "use my location" button, an OS permission dialog, a GPS icon, or displayed coordinates. Prayer times are computed on-device from a bundled ~120-city table plus a user-chosen city. The city is a **declared preference**, seeded from `care_circles.timezone`.
3. **Ramadan dates are predictive, never certain.** Umm al-Qura is a calculation; the real start is declared by moon sighting and varies ±1 day by country. Every date is phrased approximately («تقريبًا»), and **no behaviour is hard-gated on the boundary** — Ramadan-conditional surfaces appear from one day *before* the predicted start and stay until one day *after* the predicted end.
4. **The 6–8 week review guidance is diabetes-specific** (IDF-DAR 2021). It is not a general "review your medications" recommendation. The copy must name who recommends it and for whom, then route to the doctor. Never "adjust the dose". Never "it is safe to fast".
5. **Reminders are suppressed, not shifted.** Server-side. A held reminder arrives after the window; it is never cancelled and never moved to a new time.
6. **Nothing in B2 exists until a manager turns it on.** Default is off. With the mode off, B2-5 / B2-6 / B2-7 / B2-8 do not render at all, and the medication form shows no fasting annotation.

### The gold ruling for this feature

**No surface in B2 uses `goldFill` / `goldInk`.** Reasoning, since the brief asks for it explicitly on the pre-Ramadan prompt (B2-5):

- The reservation is "one-time **or irreversible** warnings" — the canonical example being an invite code shown once and unrecoverable. The pre-Ramadan card is one-time *per year* but entirely **reversible**: dismissing it destroys nothing, and it is reachable again from B2-1. It fails the irreversibility half of the test.
- It is guidance pointing at a published recommendation, not a warning about a consequence.
- Decisive: on the Home screen the card would sit within one scroll of the gold «متاح للتكفّل» banner. Two different meanings sharing one colour on one screen breaks the reservation's purpose.

The pre-Ramadan card therefore uses the **info** tone (`infoBg` fill / `infoFg` icon + `text` body — the design-language "info banner" recipe: tint fill + acc icon + 14–15/700 ink text).

> One precedent conflict the designer should know about, not resolve: `FigmaFormScreen`'s `disclaimer` prop renders a **gold** banner and is what the medication and vitals *forms* currently use for their non-diagnostic disclaimers. B2 deliberately does **not** use that prop — the non-diagnostic lines here are drawn as info banners and muted notes.

### Surfaces, routes, and where each one lives

| ID | Surface | Route / host file |
|---|---|---|
| B2-1 | Ramadan & prayer settings | new route `/ramadan-settings` |
| B2-2 | City picker (searchable sheet) | modal inside B2-1 |
| B2-3 | Calculation-method selector | **inline section** of B2-1, no navigation |
| B2-4 | Fasting attribute + schedule annotation | `src/features/medications/medication-form.tsx`, `medication-editor.tsx`, `figma-schedule-fields.tsx` |
| B2-5 | Pre-Ramadan prompt (one-time card) | `src/features/care-circle/figma-home.tsx` |
| B2-6 | Today's fasting-window card | `src/features/care-circle/figma-home.tsx` (same slot as B2-5; they never co-exist) |
| B2-7 | Dose annotation in the medication list | `src/features/medications/figma-medications.tsx` |
| B2-8 | Fasting-window dose review | new route `/ramadan-doses` |

### Proposed data fields (so labels bind to something real)

Per-circle, on `care_circles` — manager-writable, member-readable, mirroring `missed_dose_grace_minutes` and `timezone`:

- `prayer_times_enabled boolean not null default false`
- `prayer_city_id text null` — key into the bundled city table (e.g. `SA-RUH`), **not** an IANA id and **not** coordinates
- `prayer_calc_method text null` — one of `umm_al_qura | dubai | qatar | kuwait | egyptian | muslim_world_league`
- `prayer_suppress_prayers text[] not null default '{}'` — subset of `fajr | dhuhr | asr | maghrib | isha`
- `prayer_suppress_minutes int not null default 20` — range 5–45, step 5

Per-medication, on `medications`:

- `ramadan_reviewed_at timestamptz null`, `ramadan_reviewed_by uuid null` — a record that the family spoke to the doctor. It changes **no time and no behaviour**; it only switches the annotation tone and removes the medication from B2-8's "not reviewed" grouping.

Per-user, device-local (following `src/providers/theme-storage.ts`): the pre-Ramadan prompt dismissal, keyed by Hijri year.

### The computation contract (this changes what states exist)

The five prayer times, the fasting window, and the Ramadan date are computed **synchronously, on-device, offline**. There is therefore **no spinner, no network error, and no retry** on any prayer time anywhere in this feature. The only loading/error states in B2 belong to the circle-settings read/write and to the existing dose/medication queries. Draw them accordingly — a missing city is an **empty** state, never an error.

Boundary rule for "inside the fasting window": a dose time strictly **after Fajr and strictly before Maghrib** is inside. A dose exactly at Fajr or exactly at Maghrib is outside. A schedule with no time is not evaluated.

---

### B2-1 · إعدادات رمضان ومواقيت الصلاة / Ramadan and prayer settings
**Governing report:** new — Milestone 7 §5 B2 (settings chrome follows `docs/product-report-2026-07-18/14-notifications.md`)
**Purpose:** One per-circle screen where a manager turns the mode on, declares the city and calculation method, chooses which prayers mute reminders, and sees today's five times.
**Entry point:** Account tab (`src/app/(app)/(tabs)/account.tsx`) → the «دائرة الرعاية» grouped `Surface` → a **new third `FigmaListRow`**, inserted between «إعدادات الإشعارات» and «الانضمام إلى دائرة أخرى», with `iconName="moon"`, `tone="primary"`, `topDivider`. Title `ramadan.title`, subtitle `ramadan.entrySubtitle`. (`FigmaListRow` takes a semantic `IconName` from `src/constants/icons.ts`, never a lucide component — `moon` → ionicons `moon-outline` is an **existing** registry entry, currently unreferenced. See GENUINELY NEW below.) **Role gate:** the row is visible to every active member; the screen's controls are interactive only when `activeCircle.canManage` (admin / primary caregiver) — everyone else gets the read-only variant below. Secondary entries: B2-5's «الإعدادات» link and B2-6's chevron.
**Header chrome:** `FigmaFormScreen` band — 44dp bordered back square (ChevronRight, RTL back) + 20/800 title `ramadan.title` + 14/600 subtitle `ramadan.subtitle`. **Do not pass the `disclaimer` prop** (that renders gold).

**Content blocks, in order:**
1. **Enable card** — `Surface padded={false}` containing one **`FigmaToggleRow`** (`src/components/figma/figma-form-screen.tsx:158` — it is **0-usage, not missing**; do not hand-compose a switch row): `label` = `ramadan.enable.label`, `hint` = `ramadan.enable.description`, `value` bound to `care_circles.prayer_times_enabled`. Per the design language, state is never colour-only, so the **state word** (`common.toggleOn` «مفعّل» / `common.toggleOff` «غير مفعّل») renders as a 14/700 sibling line directly beneath the row inside the same card — `FigmaToggleRow`'s props are `label` / `hint` / `value` / `onValueChange` / `topDivider` only, with no slot for it. The state-word precedent is `medication-editor.tsx:283-285`.
2. **Privacy note** — `FigmaMutedNote` under the enable card: `ramadan.privacyNote`. This is the line that tells the caregiver there is no location involved. It renders in every state, including disabled.
3. **City card** — `Surface`. `SectionHeader title={ramadan.city.title}`. Then two deterministic lines, never a conditional single line: the chosen city on its own line as 18/700 text («الرياض»), and always beneath it a 14/600 muted line carrying the country («السعودية»). Then a `Button size="sm"` labelled `ramadan.city.change` (or `ramadan.city.select` when unset) that opens B2-2. Bound to `care_circles.prayer_city_id`. When the value is still the timezone-seeded suggestion and has never been confirmed, add a 14/600 `warningFg` line `ramadan.city.seededHint`. Below, always: `FigmaMutedNote` with `ramadan.city.accuracyNote`.
4. **Calculation-method section** — see **B2-3**. It lives inside this screen; no navigation.
5. **Today's times preview** — `Surface padded={false}`: a `SectionHeader title={ramadan.preview.title}` above it, then five rows separated by 2px `line` dividers. Each row: prayer name (`ramadan.prayers.*`) 16/700 at the start, time 16/800 **LTR-isolated** at the end. The next upcoming prayer's row additionally carries a `StatusBadge tone="info" iconName="clock" label={ramadan.preview.next}` (`clock` is an existing, in-use registry entry) — icon + text, never a colour-only highlight. Footer line inside the card: `ramadan.preview.attribution` (city · method), 14/600 muted.
6. **Reminder-suppression card** — `Surface`. `SectionHeader title={ramadan.suppress.title}`; description `ramadan.suppress.description` 16/400. Then:
   - `ramadan.suppress.prayersLabel` + a **5-chip multi-select** (fajr / dhuhr / asr / maghrib / isha) plus an «كل الصلوات» select-all chip. Bound to `prayer_suppress_prayers`. Chip visuals match `WeekdaySelector` (pill radius 999, 1.5px border, selected = `primary` fill + `onPrimary` + leading check).
   - `ramadan.suppress.windowLabel` + a **numeric stepper** (48dp bordered − square · sunken value well · 48dp bordered + square), value rendered as `ramadan.suppress.minutes`, range 5–45 step 5. Bound to `prayer_suppress_minutes`. Visual twin of `MissedDoseGraceCard` (`notification-settings.tsx:355-383`).
   - `FigmaMutedNote` with `ramadan.suppress.note`.
7. **Ramadan season line** — a 14/600 muted line at the foot of the preview card, **directly beneath `ramadan.preview.attribution`**: `ramadan.season.upcoming` (with the approximate date) outside Ramadan, or `ramadan.season.currentTitle` + `ramadan.hijriDate` during it. Always accompanied by `ramadan.window.approx`.
8. **Save** — `FormActions` (`src/components/form-actions.tsx:82`), the existing shared save block: it already renders the `accessibilityRole="alert"` status line above a `FigmaFooterPrimaryButton`, so nothing here is hand-drawn. Pass `saveLabel = ramadan.save`, `status` (`idle` | `saved` | `error`), `savedLabel = ramadan.saved`, `errorLabel = ramadan.saveError`. Same anatomy as the notification-settings pattern (`notification-settings.tsx:235-253`), which hand-rolls it. `UnsavedChangesGuard` on dirty.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default (mode ON, city set)** | All eight blocks above, populated. Five real times, one «التالية» badge, chips with 2–5 selected, stepper at 20. |
| **disabled — the default state** | Blocks 1 + 2 only. Below them, one `Surface` (not an error card) with a `GlyphChip iconName="moon"` (the existing registry entry; `GlyphChip` takes an `IconName`, never a lucide component), title 20/800 `ramadan.enable.offTitle`, body 16/600 `ramadan.enable.offBody`. Blocks 3–7 are **absent**, not greyed. Save block hidden (nothing to save). |
| **mode ON, no city chosen yet** | Blocks 1–4 render. Block 3 shows `ramadan.city.none` as the value (16/600 muted, not a real city name) and the `Button` reads `ramadan.city.select`. Block 3's hint becomes `ramadan.city.noneHint`. **Block 5 (preview) renders as a card with `ramadan.preview.needCity` in place of the five rows** — no skeleton, no zeroes, no dashes. Block 6 still renders and is editable. |
| **empty** | Not applicable as a distinct frame — the two empties are "disabled" and "no city", above. |
| **loading** | Only the circle-settings read. `SkeletonList count={3}` in place of blocks 3–6. Blocks 1–2 are still drawn (the toggle value is part of the same read — so during load the toggle row is also a skeleton block, 52dp tall). The prayer times themselves **never** show a skeleton. |
| **error** | Circle-settings read failure only. The inline Dar error card: bordered `card` Surface, `warningFg` icon square, 16/800 `ramadan.loadError`, 15/600 muted line, bordered retry pill `retry` — matching `figma-medications.tsx:200-208`, which is **re-implemented inline in every Dar list screen and is not a shared component**. Save block hidden. |
| **validation error** | One genuine case: **mode ON with no city, on save**. Block 3 gets a 2px `errorFg` border + an AlertCircle + 15/700 `errorFg` message `ramadan.city.required`, and the save does not commit. Save stays enabled (the Dar rule: an invalid press reveals errors). Second, softer case: suppression chips all cleared → a 14/600 `warningFg` note `ramadan.suppress.noneSelected` under the chips. This is a **note, not a blocker** — it saves. |
| **read-only / permission-denied** | Non-manager. Every value renders as text: the enable state as a `StatusBadge tone="info"` / `tone="neutral"` with `common.toggleOn` / `common.toggleOff` label, city and method as plain 16/700 lines, the five-row preview identical to the default, the suppression selection as a read-only comma-joined list («الفجر، المغرب، العشاء»). No switch, no chips, no stepper, no buttons, no save. One 14/600 muted line at the top of the first card: `ramadan.managerOnly`. Precedent: `circle-timezone-card.tsx:89-92`. |
| **confirm sheet** | n/a on this screen — the save button is the guard, matching notification settings. The one confirm in this feature is the inline city-change confirm inside B2-2. |
| **save failed** | `FormActions` with `status="error"` — its built-in 15/700 `errorFg` `accessibilityRole="alert"` line above the footer button, carrying `ramadan.saveError`. Do not draw a second, hand-made error line. |

**Reuse these existing components:**
`FigmaFormScreen`, `FigmaSectionLabel`, `FigmaFieldLabel`, `FigmaSwitch`, `FigmaMutedNote`, `FigmaToggleRow` (`:158` — 0-usage, not missing) — all `src/components/figma/figma-form-screen.tsx`
`SectionHeader` — `src/components/section-header.tsx`
`Surface` — `src/components/surface.tsx`
`OptionSelect` (variant `card`, for B2-3) — `src/components/option-select.tsx`
`StatusBadge` — `src/components/status-badge.tsx`
`GlyphChip` — `src/components/glyph-chip.tsx`
`Button` (`size="sm"`, variants `primary` / `secondary`) — `src/components/button.tsx`
`FormActions` — `src/components/form-actions.tsx:82` (wraps `FigmaFooterPrimaryButton` + the status line)
`FigmaFooterPrimaryButton` — `src/components/figma/figma-footer-primary-button.tsx`
`LtrText` / `isolateLtr` — `src/components/ltr-text.tsx`
`SkeletonList` — `src/components/skeleton.tsx`
`UnsavedChangesGuard` — `src/components/unsaved-changes-guard.tsx`
`FigmaListRow` (the Account entry row) — `src/components/figma/figma-list-row.tsx`
`Icon` — `src/components/icon.tsx` (the only renderer of registry names)

**GENUINELY NEW — no component exists:**
- **The five-prayer times block.** There is no list-of-label-plus-LTR-value component. `DoseBeadStrip` (`src/components/dose-bead-strip.tsx:53`) is the nearest visual but its props are dose-specific (`DoseBead[]` with `given|postponed|missed|null`) — it cannot be parameterised. Compose from `Surface padded={false}` + hand-written rows + hand-written 2px dividers.
- **A chip multi-select for anything that is not weekdays.** `WeekdaySelector` (`src/components/weekday-selector.tsx:34`) is the app's only multi-select, and it is named and indexed for 7 weekdays (`value: number[]`, `dayLabels`, `everyDayLabel`). Draw the 5 prayer chips to match its visuals; the clean engineering path is to generalise it into a shared chip-multi-select, which is a build decision, not a drawing one.
- **A numeric stepper primitive.** None exists. This would be the **third** inline reimplementation (`daily-logs/figma-daily-log-fields.tsx:167`, `notifications/notification-settings.tsx:355`). Match the notification-settings one.
- **A divider primitive.** None exists — every screen hand-writes `height: 2, backgroundColor: border`.
- No toast/snackbar exists; "saved" is `FormActions`' inline `accessibilityRole="alert"` / `accessibilityLiveRegion="polite"` line.
- **No new semantic icon registry entry for the Account row.** `FigmaListRow` takes an `IconName`, not a lucide component — and `src/constants/icons.ts` **already registers `moon` → ionicons `moon-outline`** (as well as `sleep` → the same glyph). Both are currently unreferenced, but an unreferenced entry is still an **existing** entry. Reuse **`moon`** for the Account row, for B2-1's disabled-state `GlyphChip`, for B2-7's `StatusBadge`, and for B2-8's `EmptyState`. **Do not add a `fasting` entry**, and do not draw a mosque. Where the glyph sits in a hand-composed row rather than a component slot, the lucide `Moon` and `Clock` glyphs are already in the in-use set. The one genuine glyph gap in B2 is the **search** icon in B2-2 — see that frame.

**RTL / LTR notes:** LTR-isolate every prayer time («4:52 ص», «6:31 م») rendered with `formatHm12` + `pickers.am` «صباحًا» / `pickers.pm` «مساءً». LTR-isolate the stepper's minute number, the Gregorian approximate-start date (`YYYY-MM-DD`), and the numerals inside the Hijri string («12 رمضان 1447»). Everything else is Arabic and aligns to the start. The back chevron points **right**; the Account entry row's trailing chevron points **left**.
**Light and dark:** draw every state in both — identical layout, only token values swap. The dark check that matters here: the five-row preview is separated only by 2px `line` dividers, which lighten to `#6B8074` in dark against `backgroundElement` `#122B24` — confirm the rows still read as rows.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.title` | رمضان ومواقيت الصلاة | Ramadan and prayer times |
| `ramadan.subtitle` | تُحسب داخل التطبيق، دون تحديد موقعك | Calculated inside the app, without using your location |
| `ramadan.entrySubtitle` | مواقيت الصلاة وإسكات التذكيرات | Prayer times and muting reminders |
| `ramadan.enable.label` | تفعيل مواقيت الصلاة | Turn on prayer times |
| `ramadan.enable.description` | إظهار مواقيت اليوم، وإسكات التذكيرات أثناء الصلاة. | Show today's times and mute reminders during prayers. |
| `ramadan.enable.offTitle` | الوضع غير مفعّل | Not turned on |
| `ramadan.enable.offBody` | لا يظهر شيء عن رمضان أو مواقيت الصلاة في التطبيق حتى يُفعَّل هذا الوضع. | Nothing about Ramadan or prayer times appears in the app until this is turned on. |
| `ramadan.privacyNote` | تُحسب المواقيت داخل التطبيق من جدول مدن مُضمَّن. لا يطلب سند موقعك ولا يرسله. | Times are calculated inside the app from a built-in city table. Sanad never asks for or sends your location. |
| `ramadan.managerOnly` | يمكن للمشرف أو مقدّم الرعاية الأساسي فقط تغيير هذه الإعدادات. | Only a manager or the primary caregiver can change these settings. |
| `ramadan.city.title` | المدينة | City |
| `ramadan.city.select` | اختيار المدينة | Choose a city |
| `ramadan.city.change` | تغيير المدينة | Change the city |
| `ramadan.city.none` | لم تُختَر مدينة بعد | No city chosen yet |
| `ramadan.city.noneHint` | يمكن اختيار المدينة الأقرب إلى الشخص الذي تعتني به لتظهر المواقيت. | Choose the city closest to the person you care for so the times can appear. |
| `ramadan.city.seededHint` | مقترحة من المنطقة الزمنية للدائرة، ويمكن التحقّق منها. | Suggested from the circle's timezone; it can be checked. |
| `ramadan.city.accuracyNote` | قد تختلف المواقيت بضع دقائق عن مسجد حيّك. | Times may differ by a few minutes from your local mosque. |
| `ramadan.city.required` | اختيار المدينة مطلوب قبل تفعيل الوضع. | Choose a city before turning this on. |
| `ramadan.prayers.fajr` | الفجر | Fajr |
| `ramadan.prayers.dhuhr` | الظهر | Dhuhr |
| `ramadan.prayers.asr` | العصر | Asr |
| `ramadan.prayers.maghrib` | المغرب | Maghrib |
| `ramadan.prayers.isha` | العشاء | Isha |
| `ramadan.preview.title` | مواقيت اليوم | Today's times |
| `ramadan.preview.next` | التالية | Next |
| `ramadan.preview.attribution` | {{city}} · {{method}} | {{city}} · {{method}} |
| `ramadan.preview.needCity` | يمكن اختيار مدينة لتظهر مواقيت اليوم. | Choose a city to see today's times. |
| `ramadan.suppress.title` | إسكات التذكيرات أثناء الصلاة | Mute reminders during prayers |
| `ramadan.suppress.description` | تُؤجَّل التذكيرات العادية أثناء الصلوات المحدّدة، ولا تُلغى. | Regular reminders are held during the chosen prayers, not cancelled. |
| `ramadan.suppress.prayersLabel` | الصلوات | Prayers |
| `ramadan.suppress.allPrayers` | كل الصلوات | All prayers |
| `ramadan.suppress.clearPrayers` | إلغاء التحديد | Clear |
| `ramadan.suppress.noneSelected` | لم تُحدَّد أي صلاة، ولن تُسكت أي تذكيرات. | No prayer is selected, so no reminders will be muted. |
| `ramadan.suppress.windowLabel` | مدة الإسكات بعد الأذان | Mute window after the adhan |
| `ramadan.suppress.minutes` | {{count}} دقيقة | {{count}} minutes |
| `ramadan.suppress.decrease` | إنقاص المدة | Decrease the window |
| `ramadan.suppress.increase` | زيادة المدة | Increase the window |
| `ramadan.suppress.note` | تصل التذكيرات المؤجَّلة بعد انتهاء المدة. وقد تصل تنبيهات الطوارئ رغم ذلك. | Held reminders arrive once the window ends. Emergency alerts may still come through. |
| `ramadan.season.upcoming` | يبدأ رمضان تقريبًا في {{date}} | Ramadan begins approximately on {{date}} |
| `ramadan.season.currentTitle` | رمضان | Ramadan |
| `ramadan.season.notNow` | ليس رمضان الآن. تظهر مواقيت الصلاة طوال العام. | It is not Ramadan now. Prayer times show all year round. |
| `ramadan.hijriDate` | {{date}} هـ | {{date}} AH |
| `ramadan.window.approx` | التواريخ تقريبية؛ يعتمد الإعلان على رؤية الهلال في بلدك. | Dates are approximate; the announcement depends on the moon sighting in your country. |
| `ramadan.save` | حفظ الإعدادات | Save settings |
| `ramadan.saved` | تم حفظ الإعدادات | Settings saved |
| `ramadan.saveError` | تعذّر حفظ الإعدادات. تحقّق من الاتصال وحاول مجددًا. | Couldn't save the settings. Check your connection and try again. |
| `ramadan.loadError` | تعذّر تحميل الإعدادات. | Couldn't load the settings. |

Voice check: no exclamation marks, no emoji, «تعذّر» never «فشل», and every instruction is masdar or impersonal («يمكن اختيار…», «اختيار المدينة مطلوب») rather than a masculine imperative. **One deliberate exception, flagged rather than changed:** `ramadan.saveError` keeps «تحقّق من الاتصال وحاول مجددًا» verbatim because CLAUDE.md's copy-voice law prescribes that exact sentence as the app-wide error shape and every shipped error key already uses it — diverging in one new key would break the register, so the fix (if wanted) belongs in a global pass, not here. **Known defect to inherit knowingly:** `ramadan.suppress.minutes` uses `{{count}}` and the repo has **zero** i18next plural suffixes, so «1 دقيقة» renders instead of «دقيقة واحدة». This exactly copies the existing `notificationSettings.missedDoseGrace.minutes` — keep it consistent rather than diverging; the fix is a global plural pass (§3 of the i18n reading), not a per-key workaround.

---

### B2-2 · اختيار المدينة / City picker
**Governing report:** new — Milestone 7 §5 B2
**Purpose:** Let a manager declare which city the prayer times are computed for, by search, with no location involved.
**Entry point:** B2-1, block 3, the `Button size="sm"` labelled `ramadan.city.select` / `ramadan.city.change`. Manager only.
**Header chrome:** none — this is a **bottom sheet**, not a screen. Draw it on the **canonical sheet chrome**: `theme.overlay` scrim, centred `backgroundElement` card capped at `MaxFormWidth` (480), `Radius.sheet` (16) top corners, 2px `border`, a 48×8 `backgroundSelected` grab handle, a centred 18/800 title `ramadan.city.pickerTitle`, and a 34dp bordered close square at the start carrying the registry `close` glyph (`Icon name="close"`, exactly `form-modal.tsx:67`). Dismissal is **explicit** (close square + cancel), matching `FormModal`.

**Content blocks, in order:**
1. **Search field** — full-width, `sunken` fill, 2px `line` border, r8, 16px value, placeholder `ramadan.city.searchPlaceholder` in `mut`/600, a leading **search glyph** (the app has none today — see GENUINELY NEW) and a trailing clear affordance when non-empty, drawn with the existing registry `close` glyph. Matches on city ar, city en, country ar, country en (the `TIMEZONES` matcher at `timezone-picker.tsx:35-46` is the behavioural precedent).
2. **«مقترحة لهذه الدائرة» section** — 14/800 muted eyebrow `ramadan.city.suggestedSection`, then every bundled city whose timezone equals `care_circles.timezone`. This is the block that resolves the Riyadh-vs-Jeddah problem: both share `Asia/Riyadh` and their Fajr differs by 38 minutes, so the picker shows both and makes the caregiver choose.
3. **«كل المدن» section** — 14/800 muted eyebrow `ramadan.city.allSection`, then the filtered list grouped by country, country name as a 14/800 muted sub-eyebrow.
4. **Row** — minHeight 56, `sunken` fill / 2px `line` border, r8. Start: city name in the active language 16/700. Second line: country name 14/600 muted. The currently-selected row: `primaryBg` fill, `primaryText` text, a leading check (lucide `Check`, in the in-use set, in this hand-composed row), and a trailing 14/600 `ramadan.city.currentLabel` — icon + text, never colour-only. **No coordinates, no timezone id, no distance.**
5. **Accuracy note** — pinned at the foot of the sheet, 14/600 muted: `ramadan.city.accuracyNote`.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | Search empty, suggested section with 1–3 rows, all-cities section grouped by country, one row marked current. |
| **empty** | No city has ever been chosen: identical layout, no row carries the current marker, and the suggested section is the only thing above the fold. |
| **no search results** | Both sections replaced by a centred 16/600 muted line `ramadan.city.noResults` plus a 14/600 second line `ramadan.city.noResultsHint` («يمكن اختيار أقرب مدينة؛ الفارق دقائق قليلة.»). Not an error card. |
| **loading** | n/a — the city table is bundled and synchronous. Never draw a spinner here. |
| **error** | n/a — no network call. |
| **validation error** | n/a — no free input is committed; the search box only filters. |
| **read-only / permission-denied** | n/a — a non-manager never reaches this sheet (the opening button is not rendered). |
| **confirm sheet** | **Required.** Selecting a row closes the picker and returns to B2-1, where the city card enters an **inline two-step confirm**: the pending city as 16/700 text, a 14/600 muted impact line `ramadan.city.confirmImpact`, then a `Button size="sm"` `ramadan.city.confirm` and a `Button size="sm" variant="secondary"` `common.cancel`. This is the exact pattern `circle-timezone-card.tsx:93-115` already uses for a timezone change. Nothing is written until confirm. |

**Reuse these existing components:** `Surface`, `Button`, `ThemedText`, `Icon` (the registry `close` glyph, on both the sheet's close square and the field's clear affordance), lucide `Check` (in-use set) for the selected row's leading mark. **Not `LtrText`** — nothing on this sheet is LTR-isolated (see the RTL note), so it would be listed and never used. Behaviourally and structurally, `TimezonePicker` (`src/components/timezone-picker.tsx:56`) is the twin — same search, same two sections, same row anatomy, same explicit-close contract.

**GENUINELY NEW — no component exists:**
- **A shared searchable-picker sheet.** `TimezonePicker` is single-purpose (hard-codes `TIMEZONES`, `circleTimezone.*` copy, and its own styles) and is **off the canonical sheet chrome** — it still uses `StyleSheet.hairlineWidth` borders, `Radius.xl`, and a 44×5 grabber (flagged as an open gap in `docs/claude-reports/2026-07-23-milestone-6-1-section-10.md:103-105`). **One frame fixes both:** draw the canonical searchable picker once and it retrofits `TimezonePicker`.
- **A search field component.** None exists anywhere in the app. The only search input is a bare `TextInput` at `timezone-picker.tsx:101-113` with no icon, no clear button, no shared style, and a 1px border that violates the 2px law. Draw the icon, the clear affordance, the focused (`acc` border) state, and the empty/filled states.
- **A search glyph — the one genuinely missing icon in B2.** Neither icon system has it: `src/constants/icons.ts` has **no** search entry, and lucide `Search` is **not** in the 31-file in-use set. Because the field is hand-composed the glyph *could* be a raw lucide import, but the right move is a registry entry — proposed **`search` → ionicons `search-outline`** — so this field and any future search share one mark. The clear affordance needs nothing new: `close` already exists and is in use.
- No section-list / sticky-header component exists — the country eyebrows are plain rows.

**RTL / LTR notes:** Everything on this sheet is Arabic and start-aligned. Nothing is LTR-isolated — deliberately: unlike `TimezonePicker`, this picker shows **no IANA id**, so there is no Latin secondary line. The close square sits at the **start** (right).
**Light and dark:** draw both. The dark check that matters here: the selected row's `primaryBg` (`#1D3B33`) sits very close to `backgroundElement` (`#122B24`), so the leading check and the `ramadan.city.currentLabel` text — not the fill — are what carry "current" in dark.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.city.pickerTitle` | اختيار المدينة | Choose a city |
| `ramadan.city.searchPlaceholder` | ابحث بالمدينة أو الدولة | Search by city or country |
| `ramadan.city.suggestedSection` | مقترحة لهذه الدائرة | Suggested for this circle |
| `ramadan.city.allSection` | كل المدن | All cities |
| `ramadan.city.currentLabel` | الحالية | Current |
| `ramadan.city.noResults` | لا توجد مدن مطابقة | No matching cities |
| `ramadan.city.noResultsHint` | يمكن اختيار أقرب مدينة؛ الفارق دقائق قليلة. | Choose the nearest city — the difference is a few minutes. |
| `ramadan.city.confirmImpact` | ستُحسب مواقيت الصلاة على أساس {{city}}. | Prayer times will be calculated for {{city}}. |
| `ramadan.city.confirm` | تأكيد المدينة | Confirm the city |

---

### B2-3 · طريقة الحساب / Calculation-method selector
**Governing report:** new — Milestone 7 §5 B2
**Purpose:** Make the genuine local disagreement about Fajr/Isha angles visible and choosable, explained by *who follows it*, never by degrees.
**Entry point:** Inline section of **B2-1**, between the city card and the times preview. **No navigation, no sheet.** Rationale: the one-component-per-job law already assigns single-choice selection with descriptions to `OptionSelect variant="card"`, and the whole point of this control is that the caregiver sees the option *and its description together* before choosing — a sheet would hide that behind a tap.
**Header chrome:** n/a — `SectionHeader title={ramadan.method.title}` inside B2-1's `FigmaFormScreen`.

**Content blocks, in order:**
1. **Explanatory line** — 16/400 body, `ramadan.method.hint`. This is the line that de-technicalises the control: it says authorities differ, that the gap is a few minutes, and that the one the local authority follows is the one to pick. **It must not mention angles, degrees, or twilight.**
2. **`OptionSelect variant="card"`** — six stacked full-width rows, each a 22px radio + 16/800 title + 15/600 description. Bound to `care_circles.prayer_calc_method`. Selected row = `primaryText` border + `primaryBg` fill + filled radio. Options and order:

| value | title key | description key |
|---|---|---|
| `umm_al_qura` | `ramadan.method.umm_al_qura` | `ramadan.method.umm_al_quraDesc` |
| `dubai` | `ramadan.method.dubai` | `ramadan.method.dubaiDesc` |
| `qatar` | `ramadan.method.qatar` | `ramadan.method.qatarDesc` |
| `kuwait` | `ramadan.method.kuwait` | `ramadan.method.kuwaitDesc` |
| `egyptian` | `ramadan.method.egyptian` | `ramadan.method.egyptianDesc` |
| `muslim_world_league` | `ramadan.method.muslim_world_league` | `ramadan.method.muslim_world_leagueDesc` |

3. **Suggested-for-this-city marker** — `OptionSelect`'s option type is `SelectOption<T> = {value, label, description?}` (`option-select.tsx:7`): a card row has a radio, a title and **one** description line, and **no third slot, no badge prop**. So the marker is **composed into that option's own `description`** as a trailing clause — «المعتمد في السعودية · المقترح لـ الرياض» — in the same 15/600 line, not as a separate coloured line and not as a new prop. When the caregiver has moved off that option, a `Button variant="plain"` (underlined `primaryText`, 15) labelled `ramadan.method.useDefault` appears under the list.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | Six radio cards, one selected, the suggested one marked by the trailing clause inside its own description line, no reset link. |
| **moved off the suggestion** | Same, plus the underlined `ramadan.method.useDefault` link below the list. |
| **empty** | No city chosen yet → the whole section still renders and is choosable, but the `ramadan.method.defaultFor` clause is absent from every description (there is nothing to suggest from). |
| **loading** | Inherits B2-1's skeleton. |
| **error** | Inherits B2-1's error card. |
| **validation error** | n/a — there is always a valid selection; the field defaults to the city's suggestion. |
| **read-only / permission-denied** | Non-manager: the six cards are replaced by one 16/700 line naming the active method plus its 15/600 description. No radios, no reset link. |
| **confirm sheet** | n/a — committed by B2-1's save. |

**Reuse these existing components:** `OptionSelect` (`src/components/option-select.tsx:43`, `variant="card"`), `SectionHeader`, `Button` (`variant="plain"`), `FigmaMutedNote`.
**GENUINELY NEW — no component exists:** none. This is the clearest existing-component fit in B2 — do not invent a picker for it, and do not add a per-option badge prop to `OptionSelect` (the marker rides in `description`, per block 3).
**RTL / LTR notes:** All-Arabic, start-aligned, radio at the start (right). No numerals in this section at all — the descriptions are deliberately written without any degree figures, so nothing needs isolation.
**Light and dark:** draw both. In dark, `primaryBg` and `backgroundElement` are near-neighbours, so the selected card is carried by its 2px `primaryText` border and the filled radio, not by the fill.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.method.title` | طريقة الحساب | Calculation method |
| `ramadan.method.hint` | تختلف الجهات في طريقة حساب الفجر والعشاء، والفارق عادةً دقائق قليلة، ويمكن اختيار ما تعمل به الجهة في البلد. | Authorities differ in how they calculate Fajr and Isha, and the difference is usually a few minutes. Choose the one the authority in your country follows. |
| `ramadan.method.umm_al_qura` | أم القرى | Umm al-Qura |
| `ramadan.method.umm_al_quraDesc` | المعتمد في السعودية | Used in Saudi Arabia |
| `ramadan.method.dubai` | دبي | Dubai |
| `ramadan.method.dubaiDesc` | المعتمد في الإمارات | Used in the United Arab Emirates |
| `ramadan.method.qatar` | قطر | Qatar |
| `ramadan.method.qatarDesc` | المعتمد في قطر | Used in Qatar |
| `ramadan.method.kuwait` | الكويت | Kuwait |
| `ramadan.method.kuwaitDesc` | المعتمد في الكويت | Used in Kuwait |
| `ramadan.method.egyptian` | الهيئة المصرية العامة للمساحة | Egyptian General Authority of Survey |
| `ramadan.method.egyptianDesc` | شائع في مصر وبلاد الشام | Common in Egypt and the Levant |
| `ramadan.method.muslim_world_league` | رابطة العالم الإسلامي | Muslim World League |
| `ramadan.method.muslim_world_leagueDesc` | شائع في أوروبا وأماكن أخرى | Common in Europe and elsewhere |
| `ramadan.method.defaultFor` | المقترح لـ {{city}} | Suggested for {{city}} |
| `ramadan.method.useDefault` | العودة إلى المقترح | Back to the suggested method |

---

### B2-4 · سمة الصيام داخل نموذج الدواء / The fasting attribute in the medication form
**Governing report:** `docs/product-report-2026-07-18/04-medications.md`, extended by Milestone 7 §5 B2
**Purpose:** Two things, and only two: (a) show, read-only, when a dose time already falls inside the fasting window, and (b) let a manager record that this medication was discussed with the doctor.
**Entry point:** Two hosts, drawn identically —
- **Add:** `src/features/medications/medication-form.tsx` — the «معلومات الدواء» `Surface` (the review toggle, directly under the existing «يؤخذ مع الطعام» switch row and its 2px divider, at `:195-206`) and the «جدول الجرعات» `Surface` (the per-time annotation, inside `FigmaScheduleFields`).
- **Edit:** `src/features/medications/medication-editor.tsx` — the same two places (the with-food row is at `:273-293`).
**Role gate:** the review toggle is manager-only, matching who can edit a medication at all (`medications/new.tsx:16-28`). The read-only annotation is visible to everyone who can see the medication.
**Header chrome:** unchanged — the existing form band (44dp back square + 20/800 `medications.addTitle` + 14/600 subtitle). B2 adds nothing to the band.

**Content blocks, in order:**
1. **Review toggle row** — added to the «معلومات الدواء» card, below the existing with-food row. Use **`FigmaToggleRow`** (`src/components/figma/figma-form-screen.tsx:158` — 0-usage, not missing) with `topDivider` (it draws the 2px divider itself), `label` = `ramadan.medReview.label`, `hint` = `ramadan.medReview.hint`. Bound to `medications.ramadan_reviewed_at` (on = a timestamp, off = null). `FigmaToggleRow` has **no** slot for a state word or a third line — its props are `label` / `hint` / `value` / `onValueChange` / `topDivider` — so both render as sibling lines directly beneath it inside the same card: the state word (`ramadan.medReview.on` / `ramadan.medReview.off`) 14/700, and, when on and previously saved, the 14/600 muted `ramadan.medReview.when` with the LTR-isolated date. The visual result matches the hand-composed with-food row at `medication-editor.tsx:273-293`.
   **This row renders only when `care_circles.prayer_times_enabled` is true.** With the mode off, the card is byte-identical to today.
2. **Per-dose-time fasting annotation** — inside `FigmaScheduleFields`'s dose-time list (`figma-schedule-fields.tsx:186-219`). Each `TimeField` row whose value falls strictly between today's Fajr and Maghrib gains a **14/700 annotation line directly under the field**: a lucide `Moon` glyph at 12px (in-use set; this line is hand-composed inside the row, not a component slot, so a raw lucide glyph is correct here) + `ramadan.scheduleHint` in `infoFg`. **Read-only. Not a warning, not an error, no border change, no tint fill on the row** — the `errorFg`/`errorBg` treatment on that row is already spoken for by the duplicate-time validation (`:193-199`) and must not be confused with it.
3. **Nothing else.** No "shift this time" affordance, no Iftar/Suhoor quick-fill on the `TimeField` wheel, no second set of Ramadan times. The `TimeField` picker is untouched.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default (mode on, dose inside the window)** | With-food row, the `FigmaToggleRow` divider, review toggle row (off, state word «غير مُراجَع»). Schedule card: three dose-time rows, the 08:00 and 14:00 rows carrying the moon annotation line, the 21:00 row plain. |
| **reviewed** | Toggle on, state word «مُراجَع» in `primaryText`, plus the 14/600 `ramadan.medReview.when` line with the LTR date. |
| **mode off (the default)** | Both additions absent. The form is exactly today's form. Draw this frame — it is the state most users see. |
| **mode on, no city chosen** | The review toggle renders. The per-time annotation does **not** — there is no window to compute against. No placeholder, no dash, no explanatory text on the time row. |
| **not currently Ramadan** | The per-time annotation still renders (the fasting window is meaningful year-round for anyone who fasts Mondays/Thursdays, and the app must not assert a Ramadan boundary). The review toggle also still renders. Only the *label* differs: nothing in this screen ever says "Ramadan is now". |
| **empty** | n/a — this is a form, it has no list. |
| **loading** | Inherits the medication form's existing load path (edit flow reads the medication first). No new skeleton. |
| **error** | Save failure surfaces on the existing footer error line (`medication-form.tsx:240-247`) using `ramadan.medReview.saveError` when the review field is the cause. |
| **validation error** | n/a for the B2 additions — a boolean cannot be invalid, and the annotation is computed. The existing duplicate-time and date-range errors are unchanged and must keep their `errorFg` 2px border + `errorBg` fill treatment, visually distinct from the moon annotation. |
| **read-only / permission-denied** | A non-manager cannot open the medication editor at all; on the read-only medication detail, the review state renders as a `StatusBadge tone="success" label={ramadan.medReview.on}` / `tone="neutral" label={ramadan.medReview.off}` in the existing detail rows (the pattern at `medication-editor.tsx:359-360` for with-food). Neither passes an `iconName` — each renders its own tone icon (`success` check / `neutral` dot). |
| **confirm sheet** | n/a — committed by the form's existing save button. |

**Reuse these existing components:** `FigmaToggleRow` (`src/components/figma/figma-form-screen.tsx:158`), `FigmaSwitch` (`:122`, inside it), `Surface`, `SectionHeader`, `FigmaScheduleFields` (`src/features/medications/figma-schedule-fields.tsx:52`), `TimeField`, `StatusBadge`, `LtrText`/`isolateLtr`, `FigmaFooterPrimaryButton`.
**GENUINELY NEW — no component exists:**
- **A hint/annotation slot under a `TimeField`.** `FormField` has a `hint` prop; `TimeField` (`src/components/time-field.tsx:53`) does not — its props are `label / value / onChange / error / placeholder / disabled / clearable / minuteStep / accessibilityLabel`. The annotation must be drawn as a sibling line inside `FigmaScheduleFields`'s row, not as a `TimeField` feature.
- No tooltip / popover exists, so the annotation cannot be a tap-to-explain affordance — it is always-visible text.

**RTL / LTR notes:** The dose time inside the `TimeField` is already LTR («8:00 ص»). The review date in `ramadan.medReview.when` is LTR-isolated `YYYY-MM-DD`. The annotation line itself is Arabic, start-aligned, with the moon glyph at the **start** (right) of the line, matching how the duplicate-time error row places its icon.
**Light and dark:** draw both, for every state — including "mode off", which must appear in both themes to prove the untouched form is genuinely untouched.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.medReview.label` | روجِع مع الطبيب لرمضان | Reviewed with the doctor for Ramadan |
| `ramadan.medReview.hint` | تسجيل حدوث مراجعة لهذا الدواء مع الطبيب. لا يغيّر هذا أي موعد. | Records that this medication was reviewed with the doctor. It changes no time. |
| `ramadan.medReview.on` | مُراجَع | Reviewed |
| `ramadan.medReview.off` | غير مُراجَع | Not reviewed yet |
| `ramadan.medReview.when` | روجِع في {{date}} | Reviewed on {{date}} |
| `ramadan.medReview.saveError` | تعذّر حفظ حالة المراجعة. تحقّق من الاتصال وحاول مجددًا. | Couldn't save the review state. Check your connection and try again. |
| `ramadan.scheduleHint` | هذا الوقت داخل نافذة الصيام في {{city}}. | This time is inside the fasting window in {{city}}. |

Note the hint's wording: it states a fact about the clock, attributes it to the declared city, and stops. It does not say «قد لا يناسب الصيام» or anything about suitability.

---

### B2-5 · تنبيه ما قبل رمضان / The pre-Ramadan prompt (one-time card)
**Governing report:** new — Milestone 7 §5 B2
**Purpose:** Once per Hijri year, point a manager at the published IDF-DAR recommendation and route them to the doctor. It proposes nothing and asserts nothing about the care recipient.
**Entry point:** Not navigated to — it appears **on Home** (`src/features/care-circle/figma-home.tsx`), in the slot between the gold «متاح للتكفّل» banner (`:499-514`) and the «جرعات اليوم» `SectionHeader` (`:519-524`). **Conditions, all required:** `prayer_times_enabled` is true **and** the predicted Ramadan start is 8 to 0 weeks away **and** the viewer is a manager (`circle.canManage`) **and** the card has not been dismissed for this Hijri year. Once Ramadan starts, this card is replaced by **B2-6** in the same slot — the two never render together.
**Header chrome:** n/a — it is a card on the Home tab band screen.

**Content blocks, in order:**
1. **Card** — `Surface tone="info"` (i.e. `infoBg` fill), 2px `line` border, r8. **Not gold** — see "The gold ruling" above.
2. **Header row** — a `GlyphChip size="md"` (40dp) `tone="info"` `iconName="doctor"` at the start; `GlyphChip` takes a semantic `IconName` from `src/constants/icons.ts`, **never a lucide component**, and `doctor` → material-community `doctor` is an existing, actively-used entry (no `Stethoscope`, no new registry name). Beside it, the 18/800 title `ramadan.prompt.title`. At the end, a **dismiss square**: 34dp bordered r6 carrying the registry `close` glyph (`Icon name="close"` — the same atom `FormModal`'s close square uses at `form-modal.tsx:67`), `accessibilityLabel = ramadan.prompt.dismiss`.
3. **Approximate-start line** — 14/700 `infoFg`: `ramadan.season.upcoming` with the LTR-isolated Gregorian date, followed **on its own line directly beneath it** by `ramadan.hijriDate` at 14/700 (not inline, not a designer choice).
4. **Attributed body** — 16/400, `text`: `ramadan.prompt.body`. This is the load-bearing string. It names the source (`{{source}}` = `isolateLtr('IDF-DAR 2021')`), names the population («لمن لديه سكري ويعتزم الصيام»), and names the action («مراجعة أدوية السكري مع الطبيب»).
5. **Applicability line** — 16/400: `ramadan.prompt.applies`. Written as a conditional («إن كان هذا يخصّ الشخص الذي تعتني به») so the card never asserts the care recipient has diabetes.
6. **Non-advice line** — 14/600 muted: `ramadan.prompt.notAdvice`.
7. **Two actions, side by side** — `Button size="sm"` `ramadan.reviewList.contactDoctor` → `/doctors`; `Button size="sm" variant="secondary"` `ramadan.reviewList.bookAppointment` → `/appointments/new`. **There is no third action, and none of them touches a medication.**
8. **Settings link** — `Button variant="plain"` (underlined `primaryText`, 15) labelled `ramadan.prompt.settingsLink` → `/ramadan-settings`.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | The card as specified, sitting between the gold claim banner and the «جرعات اليوم» header. Draw the neighbouring surfaces in the frame so the gold/info adjacency is visible and clearly distinguishable. |
| **dismissed** | The card is gone; the Home slot collapses with no residue — no "restore" chip, no greyed placeholder. The only recovery path is B2-1, which is why `ramadan.prompt.settingsLink` exists. **Draw the after-dismissal Home slot** so the designer confirms the surrounding spacing closes cleanly. |
| **empty** | n/a — the card has no list. |
| **loading** | n/a — the Ramadan date is computed on-device. If the circle-settings read has not resolved, the card simply does not render yet; **never draw a skeleton for it** (a placeholder that later becomes a religious/medical prompt would be worse than absence). |
| **error** | n/a — nothing here can fail. A circle-settings read failure means the card does not render. |
| **validation error** | n/a — no input on this card. |
| **read-only / permission-denied** | A non-manager never sees this card. Not greyed — absent. |
| **not currently the pre-Ramadan window** | Absent. It appears at ~8 weeks out and disappears the moment B2-6's window opens. |
| **mode off** | Absent. |
| **confirm sheet** | n/a — dismissal writes a device-local preference and destroys nothing recoverable, so it is not one of the three sanctioned confirm patterns' cases. |

**Reuse these existing components:** `Surface` (`tone="info"`), `GlyphChip` (`size="md"`, `tone="info"`, `iconName="doctor"` — the 40dp icon square), `Icon` (the registry `close` glyph on the dismiss square), `Button` (`size="sm"`, `variant="secondary"`, `variant="plain"`), `isolateLtr`. Structurally, `InfoBanner` (`src/components/info-banner.tsx:33`) is the tone precedent but its props are only `text` / `actionText` / `tone` / `onPress` / `accessibilityLabel` — one message line plus an optional action line — so it cannot carry a title, three paragraphs, two buttons and a dismiss. This card is composed from `Surface`.
**GENUINELY NEW — no component exists:**
- **A dismissible card.** No card anywhere in the app has a dismiss/close affordance. The nearest visual is `FormModal`'s 34dp bordered close square (`form-modal.tsx:67`) — reuse its geometry *and* its glyph.
- No toast/snackbar exists, so there is no "dismissed — undo" affordance to draw; the recovery is the settings link.
- No badge/count primitive (not needed here, but the same gap).

**RTL / LTR notes:** LTR-isolate the Gregorian approximate-start date, the numerals in the Hijri string, and — importantly — the Latin acronym in `{{source}}`. Pass `{{source}}` pre-isolated as `isolateLtr('IDF-DAR 2021')` per the repo's documented convention (`invitations-list.tsx:138` is the pattern). Deliberately, the body writes "six to eight weeks" **in Arabic words**, not digits, so no isolation is needed mid-paragraph. The dismiss square sits at the **end** (left).
**Light and dark:** draw both — and in both, draw the gold claim banner immediately above the card, because the entire justification for the info tone is that it must never be mistaken for gold in *either* theme.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.prompt.title` | قبل رمضان | Before Ramadan |
| `ramadan.prompt.body` | يوصي دليل الاتحاد الدولي للسكري ورمضان ({{source}}) بمراجعة أدوية السكري مع الطبيب قبل ستة إلى ثمانية أسابيع من رمضان، لمن لديه سكري ويعتزم الصيام. | The International Diabetes Federation's Diabetes and Ramadan guidance ({{source}}) recommends reviewing diabetes medications with a doctor six to eight weeks before Ramadan, for people with diabetes who intend to fast. |
| `ramadan.prompt.applies` | إن كان هذا يخصّ الشخص الذي تعتني به، يمكن التواصل مع الطبيب أو حجز موعد. | If this applies to the person you care for, you can contact the doctor or book an appointment. |
| `ramadan.prompt.notAdvice` | هذه إشارة إلى توصية منشورة، وليست نصيحة طبية من سند. | This points to a published recommendation. It is not medical advice from Sanad. |
| `ramadan.prompt.dismiss` | إخفاء هذه البطاقة | Hide this card |
| `ramadan.prompt.settingsLink` | إعدادات رمضان ومواقيت الصلاة | Ramadan and prayer settings |

Voice check: no guilt, no urgency, no exclamation. «يمكن التواصل» is the impersonal invitation shape (the `doctors.emptySubtitle` register), so it offers rather than instructs and stays gender-neutral. «الشخص الذي تعتني به» is the mandated dignity phrase.

---

### B2-6 · نافذة صيام اليوم على الرئيسية / Today's fasting window on Home
**Governing report:** `docs/product-report-2026-07-18/02-navigation-and-home.md`, extended by Milestone 7 §5 B2
**Purpose:** During Ramadan, show today's Fajr and Maghrib and how many of today's doses sit between them. Nothing more.
**Entry point:** Home (`src/features/care-circle/figma-home.tsx`), the **same slot as B2-5** — between the gold claim banner and the «جرعات اليوم» section header. **Conditions:** `prayer_times_enabled` is true, a city is set, and today is inside the soft Ramadan window (predicted start − 1 day … predicted end + 1 day). Visible to **every** member (it is read-only information and the circle is transparent); the dose count follows the viewer's existing Home scope — `scopeToMine` for a non-manager who can log, circle-wide for a manager (`figma-home.tsx:132,139`).
**Header chrome:** n/a — a card on the Home tab band screen.

**Content blocks, in order:**
1. **Section header** — `SectionHeader title={ramadan.window.title}` (10×10 solid `primary` square + 16/800), `linkLabel = ramadan.window.settingsLink`, `onLinkPress` → `/ramadan-settings`. The link is rendered for managers only. Do **not** use the `trailing` slot — it overrides `linkLabel`.
2. **Two anchor tiles, side by side** — the Fajr tile and the Maghrib tile, mirroring the geometry of Home's existing count/next tile pair. Each tile: 2px `line` border, r8, a 14/600 muted label (`ramadan.prayers.fajr` / `ramadan.prayers.maghrib`), then the time as a **large LTR-isolated value** (26/900, centred, per the Dar big-numeric rule), then a 14/600 muted caption. Fajr tile = `card` fill; Maghrib tile = `sunken` fill — matching the existing `countTile`/`nextTile` fill pairing at `figma-home.tsx:392,403`.
3. **Window range line** — 14/700, `ramadan.window.range` with both times LTR-isolated.
4. **Dose-count row** — a bordered r8 row, 2px `line`, `infoBg` fill: a lucide `Moon` at 18px in `infoFg` (in-use set; this row is hand-composed, not a component slot) + 16/700 `text` label `ramadan.window.dosesInside` (label-then-number phrasing, plural-safe) + a trailing **left-pointing** chevron. Tapping routes to **B2-8**. When the count is zero, the row is replaced by a plain 16/600 muted line `ramadan.window.dosesNone` with **no chevron and no route**.
5. **Approximation note** — 14/600 muted: `ramadan.window.approx`. Present in every rendering of this card, including mid-Ramadan.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | Section header + two anchor tiles with real times + range line + dose-count row with a count of 3 + approximation note. Draw it in the real Home context (claim banner above, «جرعات اليوم» below). |
| **zero doses inside the window** | Same card, dose-count row replaced by the muted `ramadan.window.dosesNone` line. Framed as good news, not as an absence. |
| **boundary day (start − 1 or end + 1)** | Identical card. The only change is that the approximation note is the *first* thing under the header rather than the last, so the uncertainty is read before the numbers. **No greyed state, no "maybe" badge, no disabled controls** — never hard-gate on the boundary. |
| **not currently Ramadan** | The card is **absent** from Home entirely. Prayer times remain available in B2-1 year-round; Home stays exactly as it is today. Draw the Home slot without it. |
| **mode off (the default)** | Absent. |
| **no city chosen** | Absent (there is no window to draw). The prompt to choose a city lives in B2-1, not on Home. |
| **empty** | Covered by "zero doses" above. |
| **loading** | The times never load. The **dose count** does — it comes from `useTodayDoses`. While that query is pending, draw the card with the two anchor tiles populated and the dose-count row as a single `Skeleton` block (full width, 52 high, r8). |
| **error** | If `useTodayDoses` failed, Home already shows its own retryable error banner at the top (`figma-home.tsx:319-330`). This card then renders the anchor tiles and **omits the dose-count row entirely** — never a "0" that would read as "nothing to review". |
| **validation error** | n/a — no input. |
| **read-only / permission-denied** | Every member sees the card. A non-manager sees no `ramadan.window.settingsLink` on the section header; the dose-count row still routes to B2-8 (which is read-only for them). |
| **confirm sheet** | n/a. |

**Reuse these existing components:** `SectionHeader` (with `linkLabel` + `onLinkPress`), `Surface`, `Skeleton` (`src/components/skeleton.tsx:36`), `isolateLtr`, lucide `Moon` and `ChevronLeft` (both already in the in-use set, both inside hand-composed rows here — not component `iconName` slots).
**GENUINELY NEW — no component exists:**
- **The two-up anchor tile pair.** Home's `countTile` / `nextTile` are **local `StyleSheet` entries inside `figma-home.tsx` (`:390-426`)**, not an importable component, and the exported `StatTile` / `DashboardTile` in `src/components/dashboard-tile.tsx` have **zero usages** and different geometry (48% width, minHeight 96, chip + value + label). The designer draws a new tile pair; the engineer either lifts the local styles or finally promotes them.
- No progress bar and no chart — and none is wanted here. The count is text: «3», never a bar, never a ring, never a percentage. That is the no-gamification law: this is "3 doses fall inside the window", not "you have completed 3 of 5".
- No divider primitive.

**RTL / LTR notes:** Both prayer times, the two times inside the range line, and the dose count are LTR-isolated. The chevron on the dose-count row points **left** (forward, in RTL). The two tiles are laid out with start/end props so the Fajr tile sits at the start (right).
**Light and dark:** draw both. The dark check that matters here: the Fajr (`card` `#122B24`) / Maghrib (`sunken` `#0E211C`) fill pairing is a much smaller step in dark than in light, so the 2px `line` border is what defines each tile there.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.window.title` | صيام اليوم | Today's fast |
| `ramadan.window.settingsLink` | الإعدادات | Settings |
| `ramadan.window.fajrCaption` | بداية الصيام | Fast begins |
| `ramadan.window.maghribCaption` | نهاية الصيام | Fast ends |
| `ramadan.window.range` | من {{from}} إلى {{to}} | From {{from}} to {{to}} |
| `ramadan.window.dosesInside` | جرعات اليوم داخل نافذة الصيام: {{count}} | Today's doses inside the fasting window: {{count}} |
| `ramadan.window.dosesNone` | لا جرعات داخل نافذة الصيام اليوم | No doses fall inside today's fasting window |

`ramadan.window.dosesInside` is deliberately written **label-then-number** rather than «{{count}} جرعات». Arabic has six CLDR plural categories and this repo has zero plural suffixes (verified: `figma.medications.activeCount` renders «1 أدوية نشطة» today). The label-then-number shape reads correctly for 0, 1, 2, 3, 11 and 100 with no plural machinery.

---

### B2-7 · وسم الجرعة داخل نافذة الصيام في قائمة الأدوية / Fasting-window annotation in the medication list
**Governing report:** `docs/product-report-2026-07-18/04-medications.md`, extended by Milestone 7 §5 B2
**Purpose:** Mark, in place, which doses in the medication list fall inside today's fasting window — and which of those medications the family has already discussed with the doctor.
**Entry point:** `src/features/medications/figma-medications.tsx` — both tabs. **Conditions:** `prayer_times_enabled` true, city set, and today inside the soft Ramadan window. Visible to every member; no role gate on reading.
**Header chrome:** unchanged — the existing sub-screen band (44dp back square + centred 20/800 «الأدوية» + 44dp filled add square for managers).

**Content blocks, in order:**
1. **«جرعات اليوم» tab — `DoseCard` (`:260`, a **local** component inside that file, not an export).** Into the existing `doseMetaRow` (`:315-329`), which today holds `[LTR time] [status pill] [responsible row]`, insert a **fourth chip after the status pill**: a `StatusBadge` (`src/components/status-badge.tsx:57`), whose shipped anatomy is already exactly 1.5px stroke, r4, tint fill, 12px icon + 14/700 label. Two variants, mutually exclusive:
   - not yet reviewed → `StatusBadge tone="info" iconName="moon" label={ramadan.doseInWindow}` — `moon` is the **existing** (currently unreferenced) registry entry in `src/constants/icons.ts`; `StatusBadge.iconName` takes an `IconName`, never a lucide component;
   - `ramadan_reviewed_at` set → `StatusBadge tone="success" label={ramadan.medReview.on}` with **no** `iconName`, so it renders the tone's own `success` check.
   **The 40dp status square at the start of the row (`:306-308`) is untouched** — it belongs to the dose status (given / postponed / missed / unlogged) and must not be repurposed. The «تسجيل» / «تعديل الحالة» button and the expandable status tray are untouched.
2. **«كل الأدوية» tab — `MedicationRow` (`:431`, also **local** to that file, not an export).** Each schedule chip in `chipRow` (`:506-518`) currently reads `[Clock] [LTR time] [days]`. For a chip whose time falls inside the window, prepend a 12px lucide `Moon` before the clock glyph and switch the chip fill from `backgroundSunken` to `infoBg`. This chip is hand-composed — it is **not** a `StatusBadge` — which is why a raw lucide glyph is correct here. Additionally, when the medication has `ramadan_reviewed_at` set, add a `StatusBadge tone="success" label={ramadan.medReview.on}` next to the existing `فعّال` / `غير فعّال` badge (`:492-502`).
3. **A one-line context banner above the tab switcher** — `InfoBanner tone="info"` with `text = ramadan.listBanner` and `actionText = ramadan.window.review` routing to B2-8. Renders only while the annotation is active. This is what tells the caregiver *why* moons have appeared.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | The «جرعات اليوم» tab with five dose cards: two carrying the info moon pill, one carrying the green reviewed pill, two plain. The banner above the tab switcher. Draw a card in each of the four dose statuses (given / postponed / missed / unlogged) **with** the moon pill, so the designer proves the two pills sit side by side without wrapping the meta row badly. |
| **«كل الأدوية» tab** | Medication cards with moon-marked schedule chips and one card carrying the reviewed badge alongside «فعّال». |
| **not currently Ramadan / mode off / no city** | **No moons, no banner, no reviewed badges anywhere.** The list is byte-identical to today. Draw this frame — it is the year-round default. |
| **empty** | Unchanged from today: the existing quiet `MedEmpty` («لا جرعات اليوم») with its `successBg` circle + check. **Do not add a Ramadan line to the empty state** — an empty day is good news and needs no annotation. |
| **loading** | Unchanged: `SkeletonList` (`:210`). The banner does not render during load. |
| **error** | Unchanged: the existing inline error card + retry pill (`:200-208`) — re-implemented inline in every Dar list screen, not a shared component. The banner does not render. |
| **validation error** | n/a — no input on this screen. |
| **read-only / permission-denied** | A member who cannot log doses sees the annotations and the banner, but no «تسجيل» button — unchanged from today's `canLog` gate (`:331`). |
| **confirm sheet** | n/a — the existing dose-correction confirm (`DoseCorrectionConfirm`, `:386`) is untouched and gains no Ramadan copy. |

**Reuse these existing components:** `StatusBadge` (`src/components/status-badge.tsx:57` — `tone="info"` + `iconName="moon"`, and `tone="success"` with no `iconName`), `InfoBanner` (`src/components/info-banner.tsx:33`, `tone="info"` with `actionText`), `SkeletonList`, `isolateLtr`, and lucide `Moon` **only** for the hand-composed schedule chip in block 2 — every `StatusBadge` marker takes the registry `moon`, never a lucide component.
**GENUINELY NEW — no component exists:** none required. **This is the one B2 surface that needs zero new components** — every marker is a `StatusBadge` and the banner is an `InfoBanner`. Flag, though, that the meta row at `figma-medications.tsx:315` is a hand-rolled wrapping flex row, not a component, so the designer must specify wrap behaviour when time + status pill + fasting pill + responsible name all coexist on a narrow screen (390px): specify that the responsible row wraps to a second line before either pill does.
**RTL / LTR notes:** The dose time stays LTR-isolated. Both pills read start-to-end with the icon at the **start** (right of the label). In the schedule chip, glyph order is Moon → Clock → LTR time → days, which in RTL renders right-to-left as moon first. The responsible name already in the meta row comes from `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`), which can fall back to an email local-part — it is **untrusted direction** and stays LTR-isolated at the call site, exactly as it is today.
**Light and dark:** draw both. This frame is what the cross-cutting dark-mode check below is about: in dark, `infoBg` `#1D3B33` sits very close to `backgroundElement` `#122B24`, so the moon pill must be read by its 1.5px `infoFg` stroke, not its fill.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.doseInWindow` | داخل نافذة الصيام | Inside the fasting window |
| `ramadan.listBanner` | بعض جرعات اليوم داخل نافذة الصيام. | Some of today's doses are inside the fasting window. |
| `ramadan.window.review` | مراجعة الجرعات | Review the doses |

Reuses `ramadan.medReview.on` («مُراجَع») for the green pill — one term per concept, per the canonical-terminology law.

---

### B2-8 · جرعات داخل نافذة الصيام / Fasting-window dose review
**Governing report:** new — Milestone 7 §5 B2
**Purpose:** The one place that lists exactly which doses fall between Fajr and Maghrib today, states plainly that the app proposes nothing, and routes to the doctor.
**Entry point:** Two: B2-6's dose-count row on Home, and B2-7's `InfoBanner` action in the medication list. Route `/ramadan-doses`. No role gate on viewing; the per-medication review toggle inside is manager-only.
**Header chrome:** `FigmaHeader` — 44dp bordered back square (ChevronRight) at the start, centred 20/800 title `ramadan.reviewList.title`, 44dp empty spacer at the end (**no add button** — nothing is created here).

**Content blocks, in order:**
1. **Window recap strip** — a bordered r8 row under the header: `ramadan.prayers.fajr` + LTR time · `ramadan.prayers.maghrib` + LTR time · the city name. 14/700.
2. **Non-diagnostic banner** — `InfoBanner tone="info"` with `text = ramadan.reviewList.disclaimer`. **This is the load-bearing sentence of the whole feature** and must be present in every state of this screen, including empty. It is drawn as an **info** banner, not gold (see the gold ruling).
3. **Grouped list** — one `Surface padded={0}` per group, rows separated by 2px `line` dividers, groups ordered **not reviewed first, then reviewed** (attention-first, matching the A7 ordering law), and within each group by dose time ascending. Each group carries a `SectionHeader` (`ramadan.reviewList.groupPending` / `ramadan.reviewList.groupReviewed`).
4. **Row anatomy** — a `GlyphChip size="md"` (40dp) `tone="info"` `iconName="medication"` at the start (an existing, actively-used registry entry; `GlyphChip` takes an `IconName`, never a lucide component); medication name 16/800 (wraps to two lines, never truncated); dosage 14/600 muted; then a meta row of `[LTR dose time]` + the moon or reviewed `StatusBadge` + the responsible person (a lucide `Users` glyph, in-use set, in this hand-composed row, plus the name from `memberDisplayName()`); trailing **left** chevron routing to `/medications/[id]`.
5. **Per-row review toggle — managers only.** Under the meta row, a 14/700 underlined `primaryText` action `ramadan.medReview.mark` (or `ramadan.medReview.unmark` when set). This is a single-tap mutation, so per the confirmation law it is guarded by **`confirmAction()`** (`src/utils/confirm.ts:16`) — the same lightweight prompt used for claim and for medication activate/deactivate. Title `ramadan.medReview.confirmTitle`, body `ramadan.medReview.confirmBody`, confirm `common.save`, cancel `common.cancel`.
6. **Footer actions** — `Button` `ramadan.reviewList.contactDoctor` → `/doctors`; `Button variant="secondary"` `ramadan.reviewList.bookAppointment` → `/appointments/new`. **No third action.**
7. **Approximation note** — 14/600 muted at the very bottom: `ramadan.window.approx`.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | Window recap, info banner, «لم تُراجَع» group with three rows, «رُوجعت» group with one row, footer actions, approximation note. |
| **empty** | `EmptyState` (`src/components/states.tsx:52`) with `iconName="moon"` — the existing registry entry, since `EmptyState.iconName` takes an `IconName`, never a lucide component. Its circle `GlyphChip` is **hardcoded to tone `success`**; `EmptyState` has no `tone` prop, so do not spec one. Title 20/800 `ramadan.reviewList.empty`, subtitle 16/600 `ramadan.reviewList.emptySubtitle`. **The window recap and the non-diagnostic banner stay above it.** The footer actions stay too — a caregiver may still want the doctor. |
| **all rows reviewed** | The «لم تُراجَع» group is absent; only the reviewed group renders. No celebratory treatment, no badge, no "all done" flourish — care is not a game. |
| **loading** | `SkeletonList count={4}` in place of the groups. The window recap renders immediately (computed on-device); the info banner renders immediately. |
| **error** | The dose query failed: the inline Dar error card + bordered retry pill (re-implemented inline per screen; not a shared component), replacing the groups. The window recap and the non-diagnostic banner still render. |
| **validation error** | n/a — no free input. |
| **read-only / permission-denied** | Non-manager: identical screen, minus the per-row review action in block 5. The reviewed/not-reviewed `StatusBadge` still shows (transparent circle). |
| **not currently Ramadan** | The route is unreachable from Home and from the medication list, because both entry points are gone. If it is reached directly (a stale deep link, a back-stack return), draw a single `EmptyState` with `ramadan.season.notNow` as the title and `ramadan.reviewList.emptySubtitle` as the subtitle. `EmptyState` has **no action slot** (its props are `title`, `subtitle?`, `icon?`, `iconName?`), so the `Button variant="secondary"` to `/ramadan-settings` is drawn as a sibling directly beneath the empty card, never inside it. **Never a 404 and never an error card** — nothing failed. |
| **mode off** | Same as above. |
| **confirm sheet** | The `confirmAction()` prompt for the per-row review toggle — the lightweight cross-platform prompt, not a bottom sheet. Draw it as a platform alert with title, body, «حفظ», «إلغاء». |

**Reuse these existing components:** `FigmaScreen` + `FigmaHeader` (`src/components/figma/figma-screen.tsx:31`, `figma-header.tsx:30`), `Surface (padded={false})`, `SectionHeader`, `StatusBadge`, `EmptyState` + `SkeletonList` (`src/components/states.tsx:52`, `src/components/skeleton.tsx:69`), `InfoBanner`, `Button`, `GlyphChip` (`iconName="medication"`), `isolateLtr`, `confirmAction` (`src/utils/confirm.ts:16`), `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`).
**GENUINELY NEW — no component exists:**
- **The window recap strip** — a three-value single-line summary row. Nothing similar exists.
- **A row-level inline text action inside a grouped list row.** `FigmaListRow` takes a `trailing` slot but its layout is title + subtitle + one trailing node; it cannot host a second stacked action line. This screen's rows are hand-composed, not `FigmaListRow`.
- No divider primitive; no badge primitive.

**RTL / LTR notes:** The two prayer times in the recap and every dose time in the rows are LTR-isolated. Row chevrons point **left**; the header back chevron points **right**. Medication names are Arabic or mixed and must **not** be forced LTR. Member names are the one exception: `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`) falls back to an email local-part, i.e. a Latin run inside an Arabic row, so its output is treated as **untrusted direction** and is LTR-isolated at the call site.
**Light and dark:** draw both, in every state — including the empty frame and the not-currently-Ramadan frame, which are the two most likely to be drawn once and forgotten.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `ramadan.reviewList.title` | جرعات داخل نافذة الصيام | Doses inside the fasting window |
| `ramadan.reviewList.disclaimer` | يعرض سند المواعيد كما أدخلتها العائلة فقط. لا يقترح تغيير أي جرعة ولا يقدّم نصيحة طبية. | Sanad only shows the times your family entered. It does not suggest changing any dose and does not give medical advice. |
| `ramadan.reviewList.groupPending` | لم تُراجَع بعد | Not reviewed yet |
| `ramadan.reviewList.groupReviewed` | رُوجعت مع الطبيب | Reviewed with the doctor |
| `ramadan.reviewList.empty` | لا جرعات داخل نافذة الصيام اليوم | No doses inside today's fasting window |
| `ramadan.reviewList.emptySubtitle` | كل جرعات اليوم خارج ساعات الصيام. | All of today's doses fall outside fasting hours. |
| `ramadan.reviewList.contactDoctor` | التواصل مع الطبيب | Contact the doctor |
| `ramadan.reviewList.bookAppointment` | حجز موعد | Book an appointment |
| `ramadan.medReview.mark` | تسجيل أنّه رُوجع مع الطبيب | Record that it was reviewed with the doctor |
| `ramadan.medReview.unmark` | إلغاء تسجيل المراجعة | Undo the review record |
| `ramadan.medReview.confirmTitle` | تسجيل المراجعة | Record the review |
| `ramadan.medReview.confirmBody` | سيُسجَّل أنّ هذا الدواء رُوجع مع الطبيب. لا يتغيّر أي موعد أو تذكير. | This records that the medication was reviewed with the doctor. No time and no reminder changes. |

The disclaimer is a **new** string, not one of the verbatim-locked ones. It must not be substituted for, or merged with, the locked vitals / daily-log / emergency disclaimers — those keep their exact existing values («قياسات تُدخلها العائلة للحفظ والمتابعة فقط…» etc.) and appear nowhere in B2.

---

### Cross-cutting notes for the designer

**Both themes, every frame.** Every surface above exists in light and dark with identical layout — only token values swap, and each frame above carries its own **Light and dark** line naming the check that matters for it. The dark-mode edge case that needs an explicit check here: `infoBg` in dark is `#1D3B33`, very close to `backgroundElement` `#122B24`, so the moon pill on B2-7's dose card must rely on its 1.5px `infoFg` stroke to read, not on its fill.

**Icons come from one of two places, and never the wrong one.** Any slot typed `iconName?: IconName` — `GlyphChip`, `FigmaListRow`, `EmptyState`, `StatusBadge`, `Button` — takes a **semantic name from `src/constants/icons.ts`**, never a lucide component. B2 uses only names that already exist there: `moon`, `clock`, `doctor`, `medication`, `close`. Raw lucide glyphs (`Moon`, `Check`, `Users`, `ChevronLeft`) appear **only** inside hand-composed rows that are not those components. The single new registry name B2 asks for is `search` (B2-2).

**What must never be drawn, restated because it is the whole risk of this feature:**
a map · a location pin · a "use my location" button · an OS location permission dialog · displayed coordinates · a "suggested new time" · a before/after schedule comparison · an Iftar/Suhoor quick-fill on the time wheel · a countdown to Iftar · a streak, a score, or a completion ring · gold on any B2 surface · a certain, unqualified Ramadan start date · the word «فشل» · a masculine imperative · an exclamation mark · an emoji.

**Consolidated new-component list for B2** (the thing worth costing before build):
1. searchable picker sheet on the canonical chrome — also retrofits `TimezonePicker`
2. search text field with icon + clear
3. five-row prayer-times block
4. generic chip multi-select (or a generalised `WeekdaySelector`)
5. numeric stepper primitive (third reimplementation)
6. two-up anchor tile pair (Home tiles are local styles, not exported)
7. dismissible-card affordance
8. annotation line under a `TimeField` inside `FigmaScheduleFields`
9. window recap strip
10. one semantic icon registry entry: **`search` → ionicons `search-outline`** (B2-2's field — neither the registry nor the lucide in-use set has a search mark). **No `fasting` entry:** `moon` → ionicons `moon-outline` already exists in the registry (unreferenced, but existing) and is reused for the Account row, B2-7's pill and B2-8's empty state.

Items 2, 4 and 5 are pre-existing app-wide gaps that B2 merely makes unavoidable; drawing them once pays for itself beyond this feature.


---

## B3 · Arabic AI narrator (الملخّص السردي)

**Governing report:** new — Milestone 7 (§5 B3 of `docs/claude-reports/2026-07-26-milestone-7-plan.md`). It attaches to the surface specified by `docs/product-report-2026-07-18/13-pulse.md` (frame **9f** in `docs/design/SCREENS.md`), which it must not disturb.

---

### Read this before drawing anything

**Six things this app does not have, and will not get for this feature.** Every frame below must be composable without them:

| Missing | Consequence for the designer |
|---|---|
| **No chat UI, no message bubbles, no thread, no avatars-in-conversation** | This is *not* an assistant conversation. One question in, one answer out, no history, no "previous questions" list. Never draw a bubble, a tail, a left/right alternation, or a typing indicator. |
| **No streaming-text component** | The response is buffered by design (a deterministic guard inspects the complete text before it can reach the screen). Draw a **skeleton loading state**, never a typewriter, never a cursor, never word-by-word reveal. |
| **No search / query input component** | The only search input in the whole app is a bare unstyled `TextInput` inside `src/components/timezone-picker.tsx:101-113`. The question field must be `FormField` with `multiline` — nothing else exists. |
| **No toast / snackbar** | Zero matches for toast or snackbar in `src/`. Every piece of feedback is either inline `accessibilityRole="alert"` text or a `FigmaBottomSheet`. Do not draw a transient banner. |
| **No progress bar, no chart, no sparkline, no badge primitive, no tooltip, no accordion, no divider primitive** | The narration is prose plus a meta line. Do not draw a "5 of 7 days" bar, a trend arrow, or a value chart next to it — that would also be interpretation, which is forbidden. |
| **No countdown / cooldown component** | `grep` for `cooldown|throttle|countdown` in `src/` returns 0. The rate-limited state must **not** show a live "try again in 04:12" timer. |

**Everything below is built from `Surface`, `FormField`, `Skeleton`, `GlyphChip`, `Button`, `FigmaHeader`, `FigmaScreen`, and `FigmaBottomSheet`.**

**The one law with a flagged exception:** the narration text itself is model-authored Arabic generated at runtime. It is the **first and only user-facing Arabic string in the app that does not come from i18n**. Everything wrapped around it — title, meta line, disclaimer, every error, every refusal — is a machine code returned by the edge function and rendered by the client from `ar.json`/`en.json`. The designer treats the narration as a **variable-length RTL paragraph slot**, not as designable copy. The **disclaimer is drawn by the UI in a fixed position below the narration and is never part of the generated text.**

**Locale note:** the generated field is `summary_ar`. The app has no runtime language switcher (`i18n.changeLanguage` appears nowhere in `src/`; `src/i18n/index.ts:24` hardcodes `'ar'`), so the English values below exist for key parity only. There is no English-narration frame to draw.

**Icon-slot law for this whole section.** `GlyphChip`, `FigmaListRow`, `EmptyState`, `StatusBadge` and `Button` all take `iconName?: IconName` — a **semantic name from `src/constants/icons.ts`**, resolved by `Icon`. A `lucide-react-native` component can never be passed into one of those slots. Wherever a frame below needs a lucide glyph (`Share2`), that element is stated as **hand-composed**, not as one of those components.

---

### N1 · بطاقة الملخّص السردي / Weekly narrative card

**Governing report:** new — Milestone 7 (§5 B3). Host screen governed by `13-pulse.md`.
**Purpose:** Restate, in one short Arabic paragraph, what the family recorded over the last seven days — without interpreting any of it.

**Entry point:** No new route. The card is inserted into the existing Care Pulse screen `/pulse` (`src/app/(app)/pulse.tsx` → `FigmaPulse`, `src/features/pulse/figma-pulse.tsx:64`), positioned **between the subtitle/share row (`figma-pulse.tsx:97-109`) and the body branch (`:111`)**. The Pulse screen itself is reached two ways, both unchanged:
1. Home → «نبض اليوم» section header → the **«عرض الكل»** link (`src/features/care-circle/figma-home.tsx`, `router.push('/pulse')`).
2. Explore tab → group **«دائرة الرعاية»** → first row **«سجل النشاط»** (`src/app/(app)/(tabs)/explore.tsx:117-124`).

**Role gate:** none. Per the transparent-circle posture, every *active* member may view and generate. The rate limit is **per circle**, not per person — see the rate-limited copy, which must not blame the individual.

**Why here, and not somewhere else** (justify against the existing chrome):
- The narrator summarizes **exactly** the data `/pulse` already lists, so the narration and its evidence sit on one screen. A caregiver who doubts a sentence scrolls down and reads the rows that produced it.
- **The `FigmaHeader` end slot stays an empty 44dp spacer.** Per the M6 app-shell law the sub-screen end square means "create the thing this screen lists"; the narrator creates nothing the list contains. Both narrator affordances live in *content*, never in chrome. Do not draw a header action square.
- **Rejected: Home.** Home is the cold-start screen; a 3–10 s buffered network wait and a per-call cost do not belong there.
- **Rejected: `FigmaSegmentedTabs` («سرد / سجل») at the top of `/pulse`.** Segmented tabs promise two equivalent, always-present views. The narration is generated on demand and is frequently absent; an empty tab is worse than an absent card.
- **Rejected: a fourth bottom tab.** The shell is fixed at 3 tabs (الرئيسية · استكشاف · الحساب).

**Header chrome:** unchanged `FigmaHeader` (`src/components/figma/figma-header.tsx:30`) — 44×44 bordered back square at start holding a **right-pointing** chevron, centered 20/800 `pulse.title` = «سجل النشاط», empty 44dp spacer at end.

**Content blocks, in order (the card itself):**
1. **Card container** — one `Surface tone="card"` (`src/components/surface.tsx:72`), `padded` (default `true` = 14dp, `CARD_PADDING` at `surface.tsx:17`), `gap={12}`. **Exactly one Surface.** Nothing inside it may be a second `Surface` (that would double the 2px border and break the flat-elevation law).
2. **Section header** — `SectionHeader` (`src/components/section-header.tsx:23`): 10×10 solid `primary` square + 16/800 title `narrator.weeklyTitle` = «ملخّص الأسبوع». Pass `linkLabel={narrator.whatIsThis}` = «ما هذا الملخّص؟» + `onLinkPress` — the component's built-in underlined `acc` link on the end side — which opens **N5**. **Do not use the `trailing` slot: it overrides `linkLabel`.** They are alternatives, not a pair.
3. **Body** — one of eight mutually-exclusive branches (see the state table). In the default branch this is:
   - **The narration paragraph** — model-authored Arabic prose, `≤60 words` (hard cap enforced by the guard), rendered at **16/26 regular (`Type.body`)**, start-aligned, RTL, no `numberOfLines` clamp, no "read more". *Draw the card at the full 60-word cap so the layout is proven at maximum length* — roughly 5–6 lines at 390px width.
   - **No `cited_values` chips.** The function returns a `cited_values` array so the guard can prove numeric grounding; it is **not** rendered. Surfacing raw values as badges beside prose reads as a chart and edges toward interpretation, and no badge primitive exists.
4. **Coverage meta line** — 14/600 `textSecondary`, key `narrator.coverage` = «مبني على سجلّات {{from}} إلى {{to}}». Both dates are `YYYY-MM-DD`, **LTR-isolated** by the caller via `isolateLtr()`.
5. **Generation meta line** — 14/600 `textSecondary`, key `narrator.generatedAt` = «أُعدّ في {{time}}», the time LTR-isolated. **Drawn as one row with (4)**, the two joined by the existing « · » meta separator. If that row exceeds the card's content width, the two parts wrap onto a second line at the same size, weight and colour, and the separator is dropped from the wrapped line. **Draw the single-line form**; the wrap is an implementer note, not a separate frame.
6. **The pinned disclaimer** — `InfoBanner tone="info"` (`src/components/info-banner.tsx:33`; borderless `Surface`, `tacc` fill, `acc` info icon, 14–15/700 text), `text` = `narrator.disclaimer`. **Always rendered whenever any narration text is on screen**, immediately below it, never above, never collapsible, never behind a tap. (`InfoBanner` has one message line plus an optional action line — there is no second-line/body prop, and none is needed here.)
   > **Do NOT use gold here.** `FigmaFormScreen`'s `disclaimer` prop paints a `goldFill`/`goldInk` banner; this is not a form screen and gold is reserved for available-to-claim surfaces and one-time/irreversible warnings only.
7. **Action row** — bottom of the card, a horizontal row, wrapping on narrow widths:
   - **Share** — **hand-composed, not `Button`** (the registry has no share `IconName`, and `Button.iconName` takes an `IconName`, never a lucide component). The one agreed recipe, used identically in B1-7, B3-N1, B3-N4, C1-3 and C1-8: *bordered pill, `Radius.pill`, 2px `border`, `backgroundElement` fill, minHeight 36, padH 14, lucide `Share2` at 14px in `primaryText`, label 14/800 `primaryText` (JSX at `figma-pulse.tsx:90-106`, styles at `:178-187`).* Same recipe as the existing Pulse share pill, different label: `narrator.share` = «مشاركة الملخّص». See **N4**.
   - **Regenerate** — `Button variant="secondary" size="sm"` (`src/components/button.tsx:43`), label `narrator.regenerate` = «إعداد ملخّص جديد».
8. **Ask entry row** — the last row inside the card, a full-width `FigmaListRow` (`src/components/figma/figma-list-row.tsx:37`) with `iconName="question"`, `tone="primary"`, `title` = `narrator.ask.entry` = «اسأل سؤالًا عن الأسبوع», and `topDivider` so the 2px divider separates it from the card body above. It renders its own 40dp tinted `Radius.control` icon square, 16/800 title, minHeight 64, and its built-in **left-pointing** trailing `ChevronLeft`. Pushes **N2**.
   > **`question` is a required new registry entry** — see GENUINELY NEW item 4. `FigmaListRow` takes `iconName: IconName`; a lucide `MessageCircle` cannot be its leading glyph.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | Card with all eight blocks: section header + «ما هذا الملخّص؟» link · 60-word narration paragraph · coverage + generated-at meta · info-tone disclaimer banner · share pill + regenerate secondary button · ask row with left chevron. Light **and** dark. |
| **first run / intro** *(pre-generation — see First-run section)* | Same card shell. Body = `narrator.intro.body` (16/26) + `narrator.intro.limit` (14/600 `textSecondary`, drawn via `FigmaMutedNote`) + the pinned disclaimer + a single **full-width `FigmaFooterPrimaryButton`** labeled `narrator.generate` = «إعداد ملخّص الأسبوع». **No share pill, no regenerate button** (there is nothing to share). Ask row still present. |
| **loading** | Card shell + section header retained. Body replaced by **three bare `Skeleton` blocks** (`src/components/skeleton.tsx:36`) at height 16, `Radius.sm` (both are the component defaults), widths 100% / 92% / 60%, 8dp gap from the wrapper. Above them a 14/700 `textSecondary` status line `narrator.preparing` = «جارٍ إعداد الملخّص» + a 14/600 line `narrator.preparingHint`. **Do NOT use `SkeletonList`** — it renders its own bordered cards and would nest a Surface. Skeleton treatment is the existing one: `backgroundSunken` fill, opacity pulsing 0.4 ↔ 0.85 over 700 ms each way; under OS reduce-motion it holds a static 0.6 opacity and does not animate. The generate button is replaced by the skeleton, not shown loading-inside-button. |
| **empty (a genuinely quiet week)** | Card shell retained. Body = a **circle `GlyphChip size="sm" shape="circle" tone="success" iconName="success"`** + 16/700 line `narrator.quietWeek` = «أسبوع هادئ — لا جديد يُذكر في السجلّات.» + 14/600 `narrator.quietWeekHint`. Disclaimer **not** rendered (no narration exists to qualify). Share pill hidden; regenerate hidden; ask row still present. **Do NOT nest `EmptyState`** inside the card — it renders its own `Surface`. This state is calm green, never gold, never an error. |
| **guard-rejected** | **This is not an error state and must not look like one.** Card shell retained. Body = `GlyphChip size="sm" shape="circle" tone="neutral" iconName="info"` + 16/700 `narrator.unavailable` = «تعذّر إعداد الملخّص هذه المرة. السجلّات كما هي ويمكن تصفّحها في الأسفل.» + a `Button variant="secondary" size="sm"` labeled `narrator.unavailableRetry` = «محاولة أخرى». Neutral/`textSecondary` tone — **never `errorFg`, never a red border, never the warning triangle.** No detail, no code, no "the model said something unsafe". The activity list below the card is fully intact and is the point of the copy. |
| **rate-limited** | Card shell retained. Body = `GlyphChip size="sm" shape="circle" tone="neutral" iconName="clock"` + 16/700 `narrator.rateLimited` = «تم إعداد عدّة ملخّصات لهذه الدائرة خلال الساعة الماضية. يمكن المحاولة بعد قليل.» **No retry button** (it would fail), **no countdown** (no such component exists — do not draw one). Note the copy says "for this circle", not "you": the limit is shared across the family. |
| **error (network / function unreachable)** | **This one IS an error and looks like one**, matching the existing inline Dar error card (`figma-pulse.tsx:114-126`, styles at `:188-199`): `backgroundElement` fill, 2px `border`, `Radius.card` (8), padding 20, centered body text **16/700** in `errorFg` = `narrator.loadError` = «تعذّر الاتصال أثناء إعداد الملخّص. تحقّق من الاتصال وحاول مجددًا.» + a solid `primary` retry pill (`Radius.control` 6, padH 18 / padV 10, minHeight 44) with `onPrimary` **15/800** label `retry` = «إعادة المحاولة». Preceded by `GlyphChip tone="error" iconName="warning"` so status is icon + text, never colour alone. Draw this next to the guard-rejected frame so the two are visibly distinguishable. |
| **validation error** | n/a — no input on this card. |
| **read-only / permission-denied** | n/a in the normal flow: `CircleGate` has already resolved an active circle before `FigmaPulse` renders, and every active member may view. If the endpoint ever returns 403, draw **the guard-rejected frame verbatim** — the endpoint returns an identical body for "not a member" and "circle does not exist" so it cannot be used as an existence oracle. **Never draw a frame that says "you are not a member of this circle".** |
| **confirm sheet** | n/a. Generating mutates no care data and ends no session, so none of the three sanctioned confirm patterns applies. Tapping «إعداد ملخّص الأسبوع» generates immediately. |

**Both themes, every frame above** — each N1 state is drawn in **light and dark**, identical layout, only token values swap.

**Reuse these existing components:**
- `Surface` — `src/components/surface.tsx:72`
- `SectionHeader` — `src/components/section-header.tsx:23`
- `Skeleton` — `src/components/skeleton.tsx:36`
- `GlyphChip` — `src/components/glyph-chip.tsx:65`
- `InfoBanner` — `src/components/info-banner.tsx:33`
- `Button` (`variant="secondary"`, `size="sm"`) — `src/components/button.tsx:43`
- `FigmaFooterPrimaryButton` — `src/components/figma/figma-footer-primary-button.tsx:35`
- `FigmaListRow` — `src/components/figma/figma-list-row.tsx:37`
- `FigmaMutedNote` — `src/components/figma/figma-form-screen.tsx:152`
- `LtrText` / `isolateLtr` — `src/components/ltr-text.tsx:16,29`
- `memberDisplayName()` — `src/features/circle-members/display-name.ts:27`
- `FigmaScreen`, `FigmaHeader` — `src/components/figma/figma-screen.tsx:31`, `figma-header.tsx:30` (host screen, unchanged)
- Share plumbing: `sharePulseSummary()` — `src/features/pulse/present.ts:160` (a real module export)

**GENUINELY NEW — no component exists:**
1. **A long-form prose paragraph block.** Every text run in the app today is a short label or a `numberOfLines={2}` row; the longest prose is `vitals.disclaimer` inside a banner. There is no component for a multi-line, variable-length, model-authored body paragraph. It is a plain `Text` at `Type.body` (16/26) with no clamp — but it is the first of its kind and the designer must prove the card at 60 words in both themes.
2. **The share pill as a reusable atom.** It exists only as a local `Pressable` + local `StyleSheet` inside a screen file (`figma-pulse.tsx:90-106` JSX, `:178-187` styles) — **local to that file, not an export; it will be re-implemented.** Two pills now need it (`pulse.share` and `narrator.share`). No `SharePill` component exists.
3. **A "generated at / covers" provenance meta line.** No component; a styled `Text` row with the existing « · » separator.
4. **A required new semantic icon registry entry: `question` → ionicons `help-circle-outline`** in `src/constants/icons.ts`. This is **not optional**: the ask row in block 8 is `FigmaListRow`, whose `iconName` is an `IconName`, and the 52-name registry has no message / chat / question / help entry (verified against `src/constants/icons.ts:48-122`). No other registry addition is needed by B3 — `success`, `info`, `clock`, `warning` and `doctor` all already exist.

**RTL / LTR notes:**
- The narration paragraph is RTL Arabic, start-aligned (right). It carries **Western digits** (0-9) per the Dar law; any digit run the model emits must be **LTR-isolated at render**, since the guard already requires every digit run to exist in the input facts.
- **Member names inside the narration.** The narration will name who recorded care. `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`) falls back to an **email local-part**, i.e. a Latin-script run inside Arabic prose — treat its output as untrusted direction. Because the narration arrives as **one model-authored string**, isolation cannot happen at an interpolation site: every member name must be wrapped with `isolateLtr()` **in the fact list handed to the function**, so the LRI/PDI marks are already inside the returned text. The designer draws one N1 default frame whose narration contains a Latin-script name (e.g. `ibrahim.k`) to prove it reads correctly inside the RTL paragraph.
- `{{from}}` and `{{to}}` in `narrator.coverage` are `YYYY-MM-DD` and are pre-isolated with `isolateLtr()` **by the caller** before interpolation — matching `invitations.expiresLabel` (`src/features/invitations/invitations-list.tsx:138`).
- `{{time}}` in `narrator.generatedAt` is `H:MM ص/م` via `formatHm12()` and is LTR-isolated.
- The ask row's forward chevron points **LEFT** (`ChevronLeft`); the header back chevron points **RIGHT** (`ChevronRight`). Both are already correct in `FigmaListRow` and `FigmaHeader`.

**Copy notes** *(new top-level namespace `narrator`, sibling of `pulse`; ar + en at exact parity)*:

| Key | ar | en |
|---|---|---|
| `narrator.weeklyTitle` | ملخّص الأسبوع | This week's summary |
| `narrator.whatIsThis` | ما هذا الملخّص؟ | What is this summary? |
| `narrator.generate` | إعداد ملخّص الأسبوع | Prepare this week's summary |
| `narrator.regenerate` | إعداد ملخّص جديد | Prepare a new summary |
| `narrator.preparing` | جارٍ إعداد الملخّص | Preparing the summary |
| `narrator.preparingHint` | يستغرق ذلك ثوانٍ قليلة. | This takes a few seconds. |
| `narrator.coverage` | مبني على سجلّات {{from}} إلى {{to}} | Based on records from {{from}} to {{to}} |
| `narrator.generatedAt` | أُعدّ في {{time}} | Prepared at {{time}} |
| `narrator.disclaimer` | سرد لما سجّلته العائلة فقط، وليس تشخيصًا أو نصيحة طبية، ولا يُفسّر التطبيق القيم. | A retelling of what the family recorded only. It is not a diagnosis or medical advice, and the app does not interpret the values. |
| `narrator.quietWeek` | أسبوع هادئ — لا جديد يُذكر في السجلّات. | A calm week — nothing to report in the records. |
| `narrator.quietWeekHint` | يمكن إعداد ملخّص بعد تسجيل شيء جديد. | A summary can be prepared once something new is recorded. |
| `narrator.unavailable` | تعذّر إعداد الملخّص هذه المرة. السجلّات كما هي ويمكن تصفّحها في الأسفل. | Couldn't prepare the summary this time. The records are unchanged and can be browsed below. |
| `narrator.unavailableRetry` | محاولة أخرى | Try again |
| `narrator.rateLimited` | تم إعداد عدّة ملخّصات لهذه الدائرة خلال الساعة الماضية. يمكن المحاولة بعد قليل. | Several summaries have been prepared for this circle in the past hour. You can try again shortly. |
| `narrator.loadError` | تعذّر الاتصال أثناء إعداد الملخّص. تحقّق من الاتصال وحاول مجددًا. | Couldn't connect while preparing the summary. Check your connection and try again. |
| `narrator.share` | مشاركة الملخّص | Share the summary |

*Voice check:* «تعذّر» never «فشل»; the rate-limit line is a fact about the circle, not a scolding; the quiet week is good news; zero exclamation marks; zero emoji; the guard rejection tells the user what still works. Every new string uses masdar / neutral impersonal forms («يمكن الـ…», «إعداد», «محاولة») — no masculine imperative.

> **The one retained imperative, deliberately.** `narrator.loadError`'s tail «تحقّق من الاتصال وحاول مجددًا» is the **app-wide shipped network-error tail**, present verbatim on 20+ existing keys in `src/locales/ar.json` (`error`, `circle.loadError`, `medications.loadError`, `doctors.saveFailed`, …) and prescribed word-for-word by the copy-voice law in `CLAUDE.md` («تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.»). It is carried unchanged so the narrator's network error reads identically to every other network error in the app. De-gendering it is a **whole-catalogue** change, not a B3 change — flagged here, not done here.

> **Open item for the maintainer (flagged, not designed):** the narration is built from facts read with the **caller's JWT**, and `medication_logs` SELECT is responsibility-scoped (`20260626161000:148-161`). A `family_member` who is not responsible for a medication cannot read its dose logs, so **two members of the same circle can receive different narrations of the same week**. If you want that disclosed, add `narrator.scopeNote` = «مبني على السجلّات المتاحة لك في هذه الدائرة.» / "Based on the records available to you in this circle." as a 14/600 line under the coverage meta, shown only to non-manager members. I have not drawn it — it needs a product call.

---

### N2 · اسأل عن الرعاية / Ask about care

**Governing report:** new — Milestone 7 (§5 B3, surface (b)).
**Purpose:** Let a caregiver ask one free-text question in their own words and get back a restatement drawn only from this circle's own records.

**Entry point:** the **ask row at the bottom of the N1 card** (`FigmaListRow` with `iconName="question"` — the required new registry entry — `title` = `narrator.ask.entry`, built-in left-pointing chevron) → pushes a new route `/pulse/ask`, registered header-less in `src/app/(app)/_layout.tsx` alongside `/pulse`. **No role gate** — same posture as N1. It is reachable **only** from N1, so the first-run explanation is always seen before any generation.

**Header chrome:** `FigmaHeader` (sub-screen band) — 44×44 bordered back square (right-pointing chevron) at start, centered 20/800 title `narrator.ask.title` = «اسأل عن الرعاية», **empty 44dp spacer at end** (this screen creates nothing).

Screen container: `FigmaScreen gap={16}` (`src/components/figma/figma-screen.tsx:31`). Not `FigmaFormScreen` — its band paints a **gold** disclaimer banner and gold is forbidden here.

**Content blocks, in order:**
1. **Scope card** — `Surface tone="card"` (`padded` default 14dp, `gap={12}`), body: 16/26 `narrator.ask.scope` explaining what it answers from, plus a 14/600 `FigmaMutedNote` with `narrator.ask.limit` (what it will not do). No section label inside it. This card is **always present**, in every state, above the input. It is the standing version of the first-run explanation.
2. **Question field** — `FormField` (`src/components/form-field.tsx:36`) with `multiline` (→ minHeight 84, top-aligned), `label` = `narrator.ask.label` = «سؤالك», `placeholder` = `narrator.ask.placeholder` = «كيف كان أسبوع الشخص الذي تعتني به؟», `hint` = `narrator.ask.hint`. 2px-bordered `sunken` well, `Radius.sm` (8), value 16px, `acc` (`primaryText`) focus ring. `maxLength` 200. **Not** `required` — the field carries no « (مطلوب)» suffix; the empty case is handled as a validation error on submit (see below).
3. **Suggested questions** — a wrapped row of **tap-to-fill** chips under the field, headed by a 14/800 muted eyebrow `narrator.ask.examplesTitle` = «أمثلة للأسئلة». Four chips, from `narrator.ask.examples.*`. Tapping a chip writes its text into the field (it does **not** submit). Visual recipe = **exactly** the `OptionSelect variant="chip"` unselected chip (2px `border`, `Radius.sm` 8, `minHeight` 48, 15px label, `card` fill) — but see GENUINELY NEW: it is *not* that component, because these are momentary actions with no selected state and no leading `Check`.
4. **Submit** — `FigmaFooterPrimaryButton` (`src/components/figma/figma-footer-primary-button.tsx:35`), full width, label `narrator.ask.submit` = «إرسال السؤال». **This component deliberately has no `disabled` prop.** The empty-question frame therefore shows a **normal, enabled** button; tapping it surfaces the inline validation error. This matches the medication form's documented behaviour ("save stays enabled", `SCREENS.md` 6b).
5. **Answer card** — appears below the button once an answer exists. `Surface tone="card"` with: `SectionHeader` title `narrator.ask.answerTitle` = «الإجابة» · the answer paragraph (16/26, RTL, ≤60 words, no clamp) · the coverage/generated-at meta line · the **pinned `narrator.disclaimer` `InfoBanner tone="info"`** · an action row with the hand-composed share pill (`narrator.share`, same recipe as N1 block 7) and a `Button variant="secondary" size="sm"` labeled `narrator.ask.askAnother` = «سؤال آخر» (clears the field and scrolls to it).

**States to draw:**

| State | What the designer draws |
|---|---|
| **default (before asking)** | Scope card · empty `FormField` showing the ghost placeholder · four suggestion chips · enabled primary button. No answer card. Both themes. |
| **typing** | Same, with the field focused: `acc` (`primaryText`) focus ring on the 2px border, real value at 16px, caret at the **start (right)** edge. Draw at a two-line question so the multiline growth from 84dp is shown. |
| **loading** | Scope card and field stay on screen and are **not** cleared (the user must be able to re-read their question). The primary button shows its own `loading` spinner (`FigmaFooterPrimaryButton` accepts `loading`). Below it, an answer-card **shell** with the section header + three `Skeleton` blocks (100% / 92% / 60%, height 16, gap 8) + the `narrator.preparing` status line. No typewriter, no streaming, no partial text. |
| **answer** | Full answer card as described in block 5, drawn at the 60-word cap. |
| **empty (no records to answer from)** | Answer card shell, body = `GlyphChip size="sm" shape="circle" tone="success" iconName="success"` + 16/700 `narrator.ask.noRecords` = «لا توجد سجلّات لهذه الفترة للإجابة منها.» Calm, not an error. No disclaimer (no narration to qualify), no share pill. |
| **guard-rejected** | Answer card shell, body = `GlyphChip size="sm" shape="circle" tone="neutral" iconName="info"` + `narrator.unavailable` + a `Button variant="secondary" size="sm"` = `narrator.unavailableRetry`. Neutral tone only — not red, not the warning triangle. The question stays in the field so a retry costs no retyping. |
| **rate-limited** | Answer card shell, body = `GlyphChip size="sm" shape="circle" tone="neutral" iconName="clock"` + `narrator.rateLimited`. No retry button, no countdown. |
| **error (network)** | Answer card shell in the inline Dar error recipe (identical to N1's error frame): `GlyphChip tone="error" iconName="warning"` + centered **16/700** `errorFg` `narrator.loadError` + solid `primary` retry pill (`Radius.control` 6, padH 18 / padV 10, minHeight 44) with `onPrimary` 15/800 label `retry`. |
| **validation error — empty question** | `FormField`'s own error treatment fires (`form-field.tsx:55-56,117-122`): the **input well itself** takes a 2px `errorFg` border **and an `errorBg` (`terr`) fill**; below it an **untinted** error row — lucide `AlertCircle` at 15 (strokeWidth 2.4) in `errorFg`, 6dp gap, 15/700 `errorFg` text `narrator.ask.emptyQuestion` = «كتابة السؤال مطلوبة.», carrying `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`. The submit button stays enabled and normal. |
| **validation error — too long** | Same `FormField` error treatment with `narrator.ask.tooLong` = «السؤال طويل. يمكن اختصاره في سطرين.» (fires at the 200-char `maxLength` boundary). |
| **read-only / permission-denied** | n/a in the normal flow. If the endpoint 403s, draw the **guard-rejected** frame verbatim — identical body for not-a-member and circle-not-found, never an existence oracle. |
| **confirm sheet** | n/a. Asking mutates nothing. No `UnsavedChangesGuard` either — a typed question is not saved data, and adding the guard would prompt on every back-tap. |

**Both themes, every frame above** — each N2 state is drawn in **light and dark**, identical layout, only token values swap.

**Reuse these existing components:**
- `FigmaScreen` — `src/components/figma/figma-screen.tsx:31`
- `FigmaHeader` — `src/components/figma/figma-header.tsx:30`
- `Surface` — `src/components/surface.tsx:72`
- `FormField` (`multiline`, `hint`, `error`) — `src/components/form-field.tsx:36`
- `FigmaFooterPrimaryButton` — `src/components/figma/figma-footer-primary-button.tsx:35`
- `Button` (`variant="secondary" size="sm"`) — `src/components/button.tsx:43`
- `SectionHeader` — `src/components/section-header.tsx:23`
- `Skeleton` — `src/components/skeleton.tsx:36`
- `GlyphChip` — `src/components/glyph-chip.tsx:65`
- `InfoBanner` — `src/components/info-banner.tsx:33`
- `FigmaMutedNote` — `src/components/figma/figma-form-screen.tsx:152`
- `FigmaListRow` — `src/components/figma/figma-list-row.tsx:37` (the N1 entry row)
- `LtrText` / `isolateLtr` — `src/components/ltr-text.tsx:16,29`
- `memberDisplayName()` — `src/features/circle-members/display-name.ts:27`

**GENUINELY NEW — no component exists:**
1. **Suggestion chip (tap-to-fill).** `OptionSelect` (`src/components/option-select.tsx:43`) is a *controlled single-choice* selector — it owns a `value`, renders a leading `Check` on the selected chip, and has no momentary-action mode. A suggestion chip has no selected state. Build it as a plain `Pressable` with a **static style array** and `android_ripple` — **never a function-form `style={({pressed}) => …}`**, which is silently dropped on Android by this project's NativeWind css-interop (standing law in `CLAUDE.md`).
2. **Character / word counter on `FormField`.** None exists. **Do not draw one.** The `maxLength` stop plus `narrator.ask.tooLong` is sufficient, and a live counter is the kind of chrome this app deliberately avoids. This is a decision, not an option left to the designer.
3. **Any conversation affordance** — no thread, no history list, no "ask a follow-up in context", no bubbles, no avatar, no timestamps-per-turn. Do not draw them. One question, one answer, then «سؤال آخر» clears and starts over.
4. **Copy-to-clipboard.** There is no clipboard component; `sharePulseSummary()` only falls back to `navigator.clipboard` on **web**. On device the only export is the OS share sheet. Do not draw a copy icon.
5. **Feedback / rating on the answer.** No thumbs, no stars, no "was this helpful". Nothing exists and nothing should be drawn this milestone.
6. **The `question` registry entry** (shared with N1) — `question` → ionicons `help-circle-outline`, required by the N1 `FigmaListRow` entry row that reaches this screen.

**RTL / LTR notes:**
- The `FormField` value and placeholder are RTL, start-aligned (right). Caret starts at the right edge.
- The answer paragraph is RTL; any digit run inside it renders LTR-isolated.
- **Member names in the answer.** `narrator.ask.examples.who` = «من سجّل الرعاية هذا الأسبوع؟» invites an answer that names members. `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`) may return an **email local-part** — a Latin-script run inside Arabic prose, and untrusted direction. As in N1, the names must be `isolateLtr()`-wrapped **in the fact list handed to the function**, since the answer arrives as one model-authored string with no interpolation site. Draw the **answer** frame with a Latin-script name in it.
- Coverage dates and the generated-at time are LTR-isolated exactly as in N1.
- Suggestion chips wrap **right to left**; the first chip sits at the right edge.

**Copy notes** *(ar + en at exact parity)*:

| Key | ar | en |
|---|---|---|
| `narrator.ask.title` | اسأل عن الرعاية | Ask about care |
| `narrator.ask.entry` | اسأل سؤالًا عن الأسبوع | Ask a question about this week |
| `narrator.ask.scope` | يُجاب على السؤال من سجلّات هذه الدائرة وحدها — الجرعات والمهام والمواعيد والقياسات والملاحظات التي سجّلتها العائلة. | Questions are answered from this circle's records alone — the doses, tasks, appointments, readings and notes the family recorded. |
| `narrator.ask.limit` | لا يفسّر سند القيم، ولا يقول إن كان شيء طبيعيًا أو مرتفعًا أو متحسّنًا، ولا يقترح أي إجراء. | Sanad does not interpret values, does not say whether something is normal, high or improving, and does not suggest any action. |
| `narrator.ask.label` | سؤالك | Your question |
| `narrator.ask.placeholder` | كيف كان أسبوع الشخص الذي تعتني به؟ | How was the week for the person you care for? |
| `narrator.ask.hint` | سؤال واحد في كل مرة، بكلماتك. | One question at a time, in your own words. |
| `narrator.ask.submit` | إرسال السؤال | Send the question |
| `narrator.ask.examplesTitle` | أمثلة للأسئلة | Example questions |
| `narrator.ask.examples.week` | كيف كان أسبوع الشخص الذي تعتني به؟ | How was the week for the person you care for? |
| `narrator.ask.examples.doses` | ما الجرعات التي سُجّلت هذا الأسبوع؟ | Which doses were recorded this week? |
| `narrator.ask.examples.appointments` | ما المواعيد التي جرت هذا الأسبوع؟ | Which appointments took place this week? |
| `narrator.ask.examples.who` | من سجّل الرعاية هذا الأسبوع؟ | Who recorded care this week? |
| `narrator.ask.answerTitle` | الإجابة | The answer |
| `narrator.ask.askAnother` | سؤال آخر | Another question |
| `narrator.ask.emptyQuestion` | كتابة السؤال مطلوبة. | A question is required. |
| `narrator.ask.tooLong` | السؤال طويل. يمكن اختصاره في سطرين. | That question is long. It can be shortened to two lines. |
| `narrator.ask.noRecords` | لا توجد سجلّات لهذه الفترة للإجابة منها. | There are no records for this period to answer from. |

*Voice check:* the placeholder uses the sanctioned dignity phrase «الشخص الذي تعتني به», never a clinical label. Both validation strings are **masdar / neutral impersonal** («كتابة السؤال مطلوبة», «يمكن اختصاره») — no masculine imperative «اكتب» / «اختصره». `narrator.ask.limit` names the three forbidden behaviours in plain words so the boundary is understood before, not after, a refusal.

---

### N3 · حالات الاعتذار / Refusal states (interpretation requested · action requested)

**Governing report:** new — Milestone 7 (§5 B3, "the model refuses" path).
**Purpose:** When a question asks the app to judge a value or to recommend a course of action, decline warmly and route the family to the treating doctor.

**Entry point:** not a screen. These are two body states of the **N2 answer card** (and, for completeness, unreachable from N1, which takes no input). They are returned as machine codes `refusal_reason: 'interpretation' | 'action'` and rendered entirely from i18n.

**Header chrome:** unchanged N2 `FigmaHeader` — 44×44 bordered back square (right-pointing chevron) at start, centered 20/800 `narrator.ask.title`, empty 44dp spacer at end.

**Content blocks, in order (inside the N2 answer card shell):**
1. **Section header** — `SectionHeader`, title `narrator.ask.answerTitle` = «الإجابة». Unchanged, so the refusal reads as *the answer to the question*, not as a system failure.
2. **Refusal icon + title** — `GlyphChip size="sm" shape="circle" tone="info" iconName="doctor"` (registry `doctor` → material-community `doctor`, already registered at `icons.ts:74` and in use) + 18/700 title.
3. **Refusal body** — 16/26 explaining, without scolding, what the app does and does not do.
4. **Rephrase hint** — 14/600 `textSecondary` via `FigmaMutedNote`, `narrator.refusal.hint`.
5. **Route-to-doctor action** — `Button variant="secondary" size="sm"` labeled `narrator.refusal.doctors` = «عرض الأطباء», pushing `/doctors` (`src/app/(app)/doctors.tsx`).
6. **No disclaimer banner.** There is no narration to qualify; the refusal *is* the boundary statement.
7. **No share pill.** A refusal is not shareable content.

**States to draw:**

| State | What the designer draws |
|---|---|
| **default — interpretation requested** | Answer card · info-tone `doctor` chip · 18/700 `narrator.refusal.interpretation.title` = «هذا سؤال للطبيب» · 16/26 `narrator.refusal.interpretation.body` · 14/600 `narrator.refusal.hint` · secondary «عرض الأطباء». The user's question stays in the field above, untouched. |
| **default — action requested** | Same layout, different strings: `narrator.refusal.action.title` = «هذا قرار للطبيب» + `narrator.refusal.action.body`. Draw as a **separate frame** so the two are visibly parallel but textually distinct. |
| **empty** | n/a — a refusal is by definition a populated response. |
| **loading** | n/a — indistinguishable from N2's loading state until the buffered response lands. |
| **error** | n/a — a refusal is a successful response, not an error. |
| **validation error** | n/a — the question already passed validation to be sent. |
| **read-only / permission-denied** | n/a. |
| **confirm sheet** | n/a. |

**Both themes, every frame above** — both refusal frames are drawn in **light and dark**, identical layout, only token values swap.

**Tone rules the designer must hold to:**
- **Not an error.** No `errorFg`, no red border, no `AlertCircle`, no warning triangle, no `StatusBadge tone="error"`. Info tone throughout.
- **Not gold.** Gold is claim surfaces and one-time/irreversible warnings only.
- **Not a scold.** The copy never says the question was wrong, inappropriate, or unsafe. It says what Sanad's job is and whose job the rest is.
- **Status is icon + text** — the `doctor` chip always accompanies the title.

**Reuse these existing components:** `Surface` (`src/components/surface.tsx:72`) · `SectionHeader` (`src/components/section-header.tsx:23`) · `GlyphChip` (`src/components/glyph-chip.tsx:65`) · `Button variant="secondary"` (`src/components/button.tsx:43`) · `FigmaMutedNote` (`src/components/figma/figma-form-screen.tsx:152`).

**GENUINELY NEW — no component exists:** none. Both refusal frames are the N2 answer-card shell with a different body, and `doctor` is an existing registry entry.

**RTL / LTR notes:** pure Arabic prose, RTL, start-aligned. No numeric content and no member name — a refusal never restates a value and never names a person — so nothing needs LTR isolation on these two frames.

**Copy notes** *(ar + en at exact parity)*:

| Key | ar | en |
|---|---|---|
| `narrator.refusal.interpretation.title` | هذا سؤال للطبيب | This one is for the doctor |
| `narrator.refusal.interpretation.body` | يعرض سند ما سُجّل كما هو، ولا يقول إن كانت القيمة طبيعية أو مرتفعة أو متحسّنة. هذا يُطرح على الطبيب المتابع. | Sanad shows what was recorded, as recorded. It doesn't say whether a value is normal, high, or improving. That's a question for the treating doctor. |
| `narrator.refusal.action.title` | هذا قرار للطبيب | This is the doctor's decision |
| `narrator.refusal.action.body` | لا يقترح سند دواءً ولا جرعة ولا أي إجراء. يمكن عرض ما سُجّل على الطبيب المتابع ليقرّر. | Sanad doesn't suggest a medication, a dose, or any action. What was recorded can be shown to the treating doctor, who decides. |
| `narrator.refusal.hint` | يمكن إعادة صياغة السؤال ليطلب ما سُجّل فقط. | The question can be rephrased to ask only for what was recorded. |
| `narrator.refusal.doctors` | عرض الأطباء | View doctors |

*Voice check:* both use «هذا … للطبيب» so the redirect is the headline, not the refusal. No «لا يمكنني», no «غير مسموح», no «فشل», no «خطأ», no exclamation. Every line is impersonal («يعرض سند», «يمكن عرض», «يمكن إعادة صياغة») — no imperative, no gendered address. The care recipient is never mentioned in a refusal, so no clinical framing can leak in.

---

### N4 · مشاركة الملخّص / Sharing a generated summary

**Governing report:** new — Milestone 7 (§5 B3). Reuses the share affordance specified in `docs/product-report-2026-07-18/13-pulse.md`.
**Purpose:** Send a generated narration out of the app — to a sibling on WhatsApp, or to the treating doctor.

**Entry point:** the share pill in the **N1 card action row** and the identical pill in the **N2 answer card action row**. No role gate.

**Header chrome:** n/a — no screen of its own. The OS share sheet is platform chrome and is not drawn.

**Content blocks, in order:**
1. **The pill** — **hand-composed, not `Button`** (`Button.iconName` takes an `IconName` and the registry has no share entry). The one agreed recipe, identical in B1-7, B3-N1, B3-N4, C1-3 and C1-8: *bordered pill, `Radius.pill`, 2px `border`, `backgroundElement` fill, minHeight 36, padH 14, lucide `Share2` at 14px in `primaryText`, label 14/800 `primaryText` (JSX at `figma-pulse.tsx:90-106`, styles at `:178-187`).* Same recipe as the existing Pulse share pill, so it needs no new visual design — only a new label.
2. **The composed text** (not drawn, but specified because it leaves the app):
   - Line 1: `narrator.shareHeader` = «ملخّص الأسبوع — {{from}} إلى {{to}}» with both dates LTR-isolated.
   - Blank line.
   - The narration verbatim.
   - Blank line.
   - **`narrator.disclaimer` verbatim.** This is mandatory. The disclaimer is pinned by the UI, so it does not travel with the text unless the composer appends it. A narration shared without its disclaimer is exactly the failure the three-layer safety design exists to prevent.
   - No app name footer, no link, no emoji, no exclamation mark.
3. **Transport** — `sharePulseSummary()` (`src/features/pulse/present.ts:160`, a real module export) unchanged: `Share.share({ message })` on native, Web Share → clipboard on web. A sibling composer `composeNarratorShareText()` mirrors `composePulseShareText()` (`present.ts:143-156`).

**Disambiguation from the existing share pill — the designer must get this right.** `/pulse` will now carry **two** share affordances:

| Pill | Where | Label | Shares |
|---|---|---|---|
| existing | subtitle row, above the narrator card (JSX at `figma-pulse.tsx:90-106`, styles at `:178-187`) | `pulse.share` = «مشاركة ملخص اليوم» | today's **event list** as bullet lines |
| new | inside the narrator card, below the disclaimer | `narrator.share` = «مشاركة الملخّص» | the **week's narration** + its disclaimer |

They are disambiguated by **label and container**, never by colour or icon (both use `Share2`). **They must never be drawn as two adjacent identical pills.** The existing pill stays in the subtitle row above the card; the new one lives inside the card. Keep the existing pill's conditional rendering unchanged (`events.length > 0`).

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | The pill at rest, in both themes, in both host cards. |
| **empty** | Pill **absent** — hidden in every state where no narration exists (intro, loading, quiet week, guard-rejected, rate-limited, error, refusal). |
| **loading** | n/a — the OS share sheet opens synchronously; there is no in-app spinner. |
| **error** | n/a — `sharePulseSummary()` swallows a cancelled share; a dismissed OS sheet is not an error and produces no in-app feedback (and there is **no toast** to produce it with). |
| **validation error** | n/a — no input. |
| **read-only / permission-denied** | n/a — sharing is non-mutating and available to every active member. |
| **confirm sheet** | n/a — sharing is non-mutating, so none of the three sanctioned confirm patterns applies. |

**Both themes, every frame above** — the pill is drawn in **light and dark**, identical layout, only token values swap.

**Reuse these existing components:**
- The pill styles at `src/features/pulse/figma-pulse.tsx:178-187` (JSX at `:90-106`) — **local to that file, not an export; it will be re-implemented.**
- `sharePulseSummary()` at `src/features/pulse/present.ts:160` — a real module export.
- `composePulseShareText()` at `src/features/pulse/present.ts:143-156` — a real module export, used as the pattern for the new composer.
- `isolateLtr()` at `src/components/ltr-text.tsx:29`.

**GENUINELY NEW — no component exists:** the share pill still has no extracted component (see N1 item 2). Nothing else.

**RTL / LTR notes:** `{{from}}` / `{{to}}` in `narrator.shareHeader` are `YYYY-MM-DD`, pre-isolated with `isolateLtr()` before interpolation — the same call-site discipline used by `pulse.shareHeader` (`figma-pulse.tsx:86-87`). Any **member display name** carried inside the shared narration is already LTR-isolated upstream (see N1's RTL notes) and stays isolated in the outgoing text. Note that the LRI/PDI marks survive into WhatsApp and are what keeps the dates and Latin-script names readable inside the Arabic line.

**Copy notes:**

| Key | ar | en |
|---|---|---|
| `narrator.shareHeader` | ملخّص الأسبوع — {{from}} إلى {{to}} | This week's summary — {{from}} to {{to}} |

*(`narrator.share` and `narrator.disclaimer` are defined in N1.)*

---

### N5 · ما هذا الملخّص؟ / First-run explanation + standing info sheet

**Governing report:** new — Milestone 7 (§5 B3, the pre-generation understanding requirement).
**Purpose:** Make sure that before the first generation, the caregiver understands that this summarizes only what the family recorded, and is not medical advice.

**Where it lives — two places, deliberately:**

**(a) The first-run state is the N1 card's own pre-generation body.** This is the primary mechanism and it cannot be skipped, because the **«إعداد ملخّص الأسبوع» button sits underneath the explanation, inside the same card.** There is no way to reach a generation without the explanation being on screen. This is preferable to a dismissible modal for three reasons: the app has no toast and no onboarding-overlay pattern; a modal on first open of `/pulse` would ambush a screen users reach for a different reason; and a "seen" flag would have to be persisted per user per circle, which is state nobody needs.

**(b) The standing version is a `FigmaBottomSheet`**, opened by the `SectionHeader`'s built-in `linkLabel` link `narrator.whatIsThis` = «ما هذا الملخّص؟» in the N1 card, and always available afterwards. Same content, more room.

**Entry point:** (a) automatic — the N1 card's body whenever no narration exists for the current week in this circle. (b) the «ما هذا الملخّص؟» underlined `acc` link on the end side of the N1 `SectionHeader` (via `linkLabel` + `onLinkPress`, never the `trailing` slot). No role gate.

**Header chrome:** (a) none — it is card content inside `/pulse`, under the unchanged `FigmaHeader` described in N1. (b) `FigmaBottomSheet` (`src/components/figma/figma-bottom-sheet.tsx:29`): centered `backgroundElement` card, `Radius.sheet` (16) top corners, 2px `border`, 48×8 `backgroundSelected` grab handle, `MaxFormWidth` (480) cap, maxHeight 85%, `theme.overlay` scrim, centered 18/800 title, **backdrop-dismiss**, no footer.

**Content blocks, in order (identical in both (a) and (b)):**
1. **Title** — `narrator.intro.title` (18/800 in the sheet; the `SectionHeader` supplies it in the card).
2. **What it does** — 16/26, `narrator.intro.body`.
3. **Where the data comes from** — 16/26, `narrator.intro.source`. Names the six record types explicitly so "only what the family recorded" is concrete, not a slogan.
4. **What it will not do** — 14/600 `textSecondary` via `FigmaMutedNote`, `narrator.intro.limit` (the same string N2's scope card uses — one key, two placements).
5. **Pinned disclaimer** — `InfoBanner tone="info"` with `text` = `narrator.disclaimer`. Present here too, so the boundary is stated before the first generation and not only after it.
6. **Action** — in (a): the full-width `FigmaFooterPrimaryButton` labeled `narrator.generate`. In (b): a single `Button variant="secondary"` labeled `common.close` = «إغلاق» (verified present at `src/locales/ar.json:16`; the sheet is also backdrop-dismissible).

**States to draw:**

| State | What the designer draws |
|---|---|
| **default** | (a) the N1 card in its intro form — section header + «ما هذا الملخّص؟» link · intro body · source line · muted limit line · info disclaimer banner · full-width green «إعداد ملخّص الأسبوع» · ask row. (b) the bottom sheet with the same content and a close button. Both, both themes. |
| **empty** | n/a — the explanation is static copy. |
| **loading** | n/a — no data fetch. |
| **error** | n/a. |
| **validation error** | n/a — no input on this surface. |
| **read-only / permission-denied** | n/a — every active member sees it. |
| **confirm sheet** | n/a — (b) *is* an informational sheet, not a confirm. It has no destructive action and therefore no submit/cancel footer; do not draw one. |

**Both themes, every frame above** — the (a) card form and the (b) sheet are each drawn in **light and dark**, identical layout, only token values swap.

**Reuse these existing components:** `FigmaBottomSheet` — `src/components/figma/figma-bottom-sheet.tsx:29` · `Surface` — `src/components/surface.tsx:72` · `SectionHeader` (with `linkLabel`/`onLinkPress`) — `src/components/section-header.tsx:23` · `InfoBanner` — `src/components/info-banner.tsx:33` · `FigmaMutedNote` — `src/components/figma/figma-form-screen.tsx:152` · `FigmaFooterPrimaryButton` — `src/components/figma/figma-footer-primary-button.tsx:35` · `Button variant="secondary"` — `src/components/button.tsx:43`.

**GENUINELY NEW — no component exists:** none. Do **not** invent an onboarding overlay, a coach-mark, a tooltip, a carousel, or a dismissible tip banner — none of these exist in the app and none is needed.

**RTL / LTR notes:** all Arabic prose, RTL, start-aligned. No numeric content and no member name in the explanation, so nothing is LTR-isolated here.

**Copy notes** *(ar + en at exact parity)*:

| Key | ar | en |
|---|---|---|
| `narrator.intro.title` | ملخّص بالكلمات لما سجّلته العائلة | A plain-words summary of what the family recorded |
| `narrator.intro.body` | يقرأ سند ما سجّلته العائلة خلال الأسبوع ويعيد سرده في فقرة قصيرة، لتسهيل متابعة ما جرى دون تصفّح السجلّات سطرًا سطرًا. | Sanad reads what the family recorded during the week and retells it in a short paragraph, so the week can be followed without going through the records line by line. |
| `narrator.intro.source` | يعتمد على سجلّات هذه الدائرة وحدها: الجرعات والمهام والمواعيد والزيارات والقياسات والملاحظات اليومية. لا يقرأ شيئًا من خارجها. | It draws on this circle's records alone: doses, tasks, appointments, visits, readings and daily notes. It reads nothing from outside them. |
| `narrator.intro.limit` | لا يفسّر سند القيم، ولا يقول إن كان شيء طبيعيًا أو مرتفعًا أو متحسّنًا، ولا يقترح أي إجراء. هذا للطبيب المتابع. | Sanad does not interpret values, does not say whether something is normal, high, or improving, and does not suggest any action. That is for the treating doctor. |

*Voice check:* «لتسهيل متابعة ما جرى» frames the benefit as relief, never as insight. `narrator.intro.limit` is one string reused in three places (N5, N2's scope card, and the maintainer's system prompt reference) so the boundary is worded identically everywhere. No exclamation marks, no emoji, gender-neutral throughout (`يقرأ سند` — the subject is the app, not the user; the benefit clause is a masdar, not a 2nd-person verb).

---

### Summary of frames to deliver

| # | Frame | Light | Dark |
|---|---|---|---|
| 1 | N1 default — narration at the 60-word cap (include a Latin-script member name to prove LTR isolation) | ✓ | ✓ |
| 2 | N1 first-run / intro (with the green generate button) | ✓ | ✓ |
| 3 | N1 loading (skeleton, no typewriter) | ✓ | ✓ |
| 4 | N1 quiet week | ✓ | ✓ |
| 5 | N1 guard-rejected (neutral, NOT an error) | ✓ | ✓ |
| 6 | N1 rate-limited (no countdown) | ✓ | ✓ |
| 7 | N1 network error (red, retry pill) | ✓ | ✓ |
| 8 | N2 default (empty field + 4 suggestion chips) | ✓ | ✓ |
| 9 | N2 typing (focused multiline field, 2 lines) | ✓ | ✓ |
| 10 | N2 loading (button spinner + answer-shell skeleton) | ✓ | ✓ |
| 11 | N2 answer (include a Latin-script member name) | ✓ | ✓ |
| 12 | N2 empty — no records to answer from | ✓ | ✓ |
| 13 | N2 validation error — empty question | ✓ | ✓ |
| 14 | N2 validation error — too long | ✓ | ✓ |
| 15 | N3 refusal — interpretation requested | ✓ | ✓ |
| 16 | N3 refusal — action requested | ✓ | ✓ |
| 17 | N5 info bottom sheet | ✓ | ✓ |

Every frame is delivered in **both themes** — identical layout, only token values swap. N2's guard-rejected / rate-limited / network-error frames reuse frames 5–7's bodies inside the answer-card shell and need not be redrawn separately, provided frames 5–7 are drawn once at card width.


---

## C1 · Hired-caregiver supervision and worker companion (التنسيق مع مقدّم الرعاية)

**Track C — plan and design only. Nothing in this section is built in Milestone 7.** The purpose of this brief is to hand the designer a complete, unambiguous frame list so that when C1 is greenlit after customer validation, the drawing is already done.

### The single design constraint that governs every frame in this section

This feature must read as **shared work coordination that protects the worker**. It must never read as covert supervision. Gulf domestic-worker law is tightening and a surveillance framing is both an ethical problem and a legal one. Five rules, and every frame below encodes them:

1. **The worker sees exactly what the family sees about her.** Screen C1-9 is not a courtesy — it renders the *same* summary component tree as the family's C1-3, with the same numbers, so a worker shown the family's phone recognises her own screen.
2. **No location. Ever.** No coordinate is collected, requested, stored, or displayed. `expo-location` is explicitly rejected in the Milestone 7 plan (§3). The absence must be *drawn* — screen C1-9 carries an explicit "not recorded" card listing location first. If a frame feels like it has a hole where a map would go, that hole is the deliverable.
3. **No silent capture.** A photo is attached only when the worker taps to attach it, and sent only when she taps save. There is no background upload, no auto-capture, no microphone. Every worker frame that touches the camera must draw an explicit save step.
4. **The shift log is hers as much as the family's.** She starts it, she ends it, she corrects it, she exports her own copy. The family can *view* it and can never edit it. That asymmetry is drawn as an *absent* edit affordance on the family side (C1-4b) and a *present* one on hers (C1-8). Rest is logged at the same visual weight as work — never as a secondary link.
5. **Photo-proof is framed as «سجلّك أنت» — "your record that this was done"** — never as evidence, never as proof for anyone else. The proposed copy in C1-7 is load-bearing; do not soften it into neutral product language.

### Known blockers — state these on the brief cover, they change what can be drawn

- **The `caregiver` role cannot be assigned today.** It is rejected server-side by `create_circle_invitation` and `update_circle_member_role` with "this role is not available yet", and excluded client-side from `ASSIGNABLE_ROLE_ORDER` at `src/features/circle-members/role-capabilities.ts:23-28`. C1's entire persona has no assignable role. Unblocking it is the first work item (one migration + three client files) and it precedes every frame here.
- **The app forces RTL from a hardcoded constant.** `src/i18n/rtl.ts:7` is `const SHOULD_BE_RTL = true`, not derived from language. All four candidate worker languages are LTR. Today, a Tagalog UI would render with the entire chrome mirrored: `start`/`end` props flip, `flexDirection:'row'` runs right-to-left, and the two consumers that branch on `I18nManager.isRTL` actively invert — `src/components/icon.tsx:51` (directional glyphs) and `src/components/date-field.tsx:133` (date-picker column order). **And it cannot be fixed live**: `forceRTL` takes effect only on the *next app launch*, and the file deliberately refuses `Updates.reloadAsync()`. The designer must draw the relaunch instruction screen in C1-5. Do not design around this.
- **Cairo covers `arabic`, `latin`, `latin-ext` only** (verified in `@expo-google-fonts/cairo/metadata.json`). Tagalog and Indonesian are covered. **Hindi (Devanagari) and Amharic (Ethiopic) are not** — they would render as tofu or fall back to a system face with mismatched metrics, and fixing that means a second and third font family, which breaks the standing Milestone 6 "one typeface, never a second family" law. **Draw Tagalog and Indonesian only.** Hindi and Amharic are a product decision, not a design task.
- **All server-side push copy is hardcoded Arabic**, outside i18next — `supabase/functions/_shared/messages.ts:12-52` and `_shared/digest.ts:30-56`. `profiles.locale` exists (default `'ar'`) but is never read by any edge function. A Filipino caregiver today would get an app in Tagalog and *every notification in Arabic*. **Design consequence: no worker frame may depend on a push notification to be reachable.** Every worker action must be reachable from the worker home in one or two taps.
- **There is no offline behaviour anywhere.** React Query is memory-only, mutations are not queued, and `expo-sqlite` has zero imports. A hired caregiver on a poor connection is the single likeliest real user of this feature. **Every worker mutation needs a drawn failed-send state with a retry** — and the copy must not promise a queue that does not exist.
- **`{{count}}` plurals are already wrong in Arabic** (zero plural-suffix keys exist; «1 أدوية نشطة» renders where «دواء واحد نشط» belongs). Every new count string proposed below deliberately uses the `{{done}} من {{total}}` shape, mirroring `figma.medications.summary`, to sidestep this.
- **i18n arrays do not render.** `circleMembers.capabilities.*.can` is an array in the JSON but `returnObjects` is not enabled (`src/i18n/index.ts:34-36`) and the key has **zero consumers**. All new list copy below is proposed as **named leaves iterated by a local key array** — the exact `LEGEND` pattern at `src/features/circle-members/figma-members.tsx:49-53`. Never propose an array key.

### The two shells

| | Family shell | Worker shell |
|---|---|---|
| Chrome | The existing 3-tab Dar app, unchanged | A **separate, radically simpler** shell |
| Tab bar | `FigmaTabBar` — الرئيسية · استكشاف · الحساب | **Cannot reuse `FigmaTabBar`.** `TAB_META` at `src/components/figma/figma-tab-bar.tsx:13-17` is a closed 3-entry map and returns `null` for any unknown route (`:47-48`), so a worker tab would silently render nothing. A 4th tab is also untested at 200% font scale (the file's own comment at `:93-95`). |
| Direction | RTL always | Mirrors — LTR for Tagalog/Indonesian, RTL for Arabic |
| Destinations | 3 tabs + all sub-screens | **Today** and **Me** only |

**Do not add a 4th family tab for C1.** The family entry point is a row in the Explore tab's «دائرة الرعاية» group, matching how every other sub-feature is reached.

---

## Family side

### C1-1 · دعوة مقدّم رعاية / Invite a hired caregiver
**Governing report:** `docs/product-report-2026-07-18/10-members-and-invitations.md` for the invite mechanics; the caregiver-specific disclosure blocks are new — Milestone 7 (plan §6 C1).
**Purpose:** Create a one-time invitation code for a paid caregiver, and tell the family in plain language exactly what that person will and will not be able to see before the code exists.
**Entry point:** Explore tab → «دائرة الرعاية» group → «دائرة الرعاية» row → the members roster (`FigmaMembers`) → the 44×44 filled `Plus` square in the sub-screen band. **Role gate:** manager only — `isManagerRole(actorRole)`, wired at `src/features/circle-members/figma-members.tsx:191`, routing to `/circle-members/invite`.
**Header chrome:** `FigmaFormScreen` band — 44dp bordered back square + 20/800 title + 14/600 subtitle + gold `disclaimer` slot.

**Content blocks, in order:**
1. **Gold shown-once disclaimer** — existing `invitations.warning`, passed to `FigmaFormScreen`'s `disclaimer` prop. This is a **sanctioned gold use** (a one-time irreversible secret follows). It is the only gold on this screen.
2. **Role selector** — `Surface` + `OptionSelect variant="card"`, one radio card per role from `invitableRoles(actorRole)`. Today that list is four cards (`admin`, `primary_caregiver`, `family_member`, `remote_member`). **New: a fifth card «مقدّم رعاية».** Title from the existing `circleMembers.roles.caregiver`; description from `circleMembers.roleDescriptions.caregiver`, whose current value («يسجّل الرعاية والسجلات اليومية.») is a placeholder and must be rewritten (see Copy notes).
3. **NEW — «ما سيراه مقدّم الرعاية» disclosure card**, rendered **only when the caregiver card is selected**. A `Surface tone="card"` with a `FigmaSectionLabel` heading and four **hand-composed icon + text rows**. These rows are **not** `FigmaListRow` and **not** `GlyphChip` — both of those take a semantic `iconName: IconName` from `src/constants/icons.ts` and neither renders a bare inline glyph beside a wrapping paragraph. Each row is a lucide `Check` at 16 / strokeWidth 2.2 in `successFg` + 16px text, following the direct-lucide idiom the Dar screens already use (31 files import `lucide-react-native`). Data: static copy, not derived from any table.
   Keys: `caregiver.invite.sees.tasks` / `.doses` / `.shift` / `.summary`.
4. **NEW — «ما لن يراه» card**, same chrome, four **hand-composed** rows, each a lucide `X` at 16 / 2.2 in `textSecondary` (**not** `errorFg` — this is a scope statement, not a warning). Again: not `FigmaListRow`, not `GlyphChip`. Keys: `caregiver.invite.hidden.members` / `.pulse` / `.medical` / `.unassigned`.
5. **NEW — «ما لا يسجّله التطبيق» card**, same chrome, four hand-composed rows, each an `<Icon name="shield" />`. **`shield` is an EXISTING registry entry** (`src/constants/icons.ts` → `ionicons:shield-checkmark-outline`) — it is currently unreferenced, but an unused entry is still an existing entry, so **no new registry entry is needed here**. Location is the **first** row. Keys: `caregiver.invite.notRecorded.location` / `.background` / `.mic` / `.photos`.
6. **NEW — the mutual-visibility line.** A single `FigmaMutedNote` under the three cards: `caregiver.invite.mutualNote`. This is the sentence that makes the whole feature defensible; do not bury it.
7. **NEW — worker app language row.** `FigmaFieldLabel` + `OptionSelect variant="chip"` over the supported worker languages, **each chip labelled in its own script** (see RTL/LTR notes). Below it, `FigmaMutedNote` = `caregiver.invite.languageHint`. This seeds the worker's first-run language so she is not handed an Arabic sign-in form.
8. **Optional reference name** — existing `FormField` with `invitations.fields.invitedName` / `invitations.placeholders.invitedName` / `invitations.helpers.invitedName`. Unchanged.
9. **Error alert row** — existing 14px `errorFg` `Text` with `accessibilityRole="alert"` (`invite-form.tsx:100-107`).
10. **`FigmaFooterPrimaryButton`** «إنشاء رمز الدعوة», rendered in the body (not the `footer` prop — the existing file documents at `:109-110` that the footer prop did not render on Android).

**After success — the code reveal (frame 9c, `CreatedCard`).** Reuse it unchanged, with **one new row** in the meta block under the code well: `caregiver.invite.codeNote` — «this code opens the caregiver app, not the family app» — plus the chosen language echoed back. The gold shown-once warning, the code well (28/900, `letterSpacing: 4`, LTR-isolated), the role row, the expiry row, and the WhatsApp/copy/share stack all stay as drawn.

**States to draw:**
| State | What the designer draws |
|---|---|
| default | Family role selected — blocks 3–7 absent, screen is the existing 4-card invite form. Then the caregiver-selected variant with all three disclosure cards and the language row expanded. Draw both variants, **light and dark** — identical layout, only token values swap. |
| empty | n/a — the role list is static and always has at least one option. |
| loading | `create.isPending` → the footer button's built-in spinner; the form stays interactive-looking but the button is the only busy element. |
| error | The existing `accessibilityRole="alert"` row with `invitations.createFailed`. No card, no icon — a plain calm `errorFg` line, matching the current implementation. |
| validation error | n/a — no required text input; a role is always preselected and the reference name is optional. If the language row is left unset (should not be possible — default it), the `FormField` error row idiom applies. |
| read-only / permission-denied | A non-manager cannot reach `/circle-members/invite` (the `+` square is not rendered). If deep-linked, draw the existing `managersOnly` message pattern. |
| confirm sheet | n/a — the gold shown-once warning plus the irreversible code reveal *is* the guard. Do not add a second confirm. |

**Reuse these existing components:** `FigmaFormScreen`, `FigmaSectionLabel`, `FigmaFieldLabel`, `FigmaMutedNote` (all `src/components/figma/figma-form-screen.tsx`) · `FigmaFooterPrimaryButton` (`src/components/figma/figma-footer-primary-button.tsx`) · `Surface` (`src/components/surface.tsx`) · `OptionSelect` variants `card` and `chip` (`src/components/option-select.tsx`) · `FormField` (`src/components/form-field.tsx`) · `FigmaHeader`, `FigmaScreen` for the reveal · `LtrText` / `isolateLtr` (`src/components/ltr-text.tsx`) · `Button variant="secondary"` (`src/components/button.tsx`) · `Icon` (`src/components/icon.tsx`, with the existing registry name `shield`).
**GENUINELY NEW — no component exists:**
- **A disclosure / "what they can and cannot see" card.** There is no icon-list-row primitive. The nearest is the role legend at `figma-members.tsx:239-250` (a coloured dot + bold term + description) — a dot is not sufficient here because status must never be colour-only; these rows need icon + text. Because the row is hand-composed, its glyph is a lucide component (`Check` / `X`) or an `<Icon name="shield" />`; it is **not** a `GlyphChip` and **not** a `FigmaListRow`.
- **A language chip row whose labels are endonyms.** No language picker exists anywhere in the app (`i18n.changeLanguage` = 0 occurrences repo-wide). See C1-5.
- **No badge/count primitive** if the designer wants a "N invited" affordance — the gold notification badge is hand-rolled inline in `figma-home.tsx`. If one is added, it borrows the «أنت» badge's local style (see C1-2), never the gold one.

**RTL / LTR notes:** The invite code (`SND`-style `XXXXX-XXXXX` from a 31-char alphabet — note there is **no `SND-` prefix in the real product**, only in mockups) is `LtrText selectable` with the raw value kept in `accessibilityLabel`. The expiry date is `isolateLtr(ymdFromInstant(...))` interpolated into `invitations.expiresLabel`. The language chip labels are **each independently direction-isolated** — "Tagalog" and "Bahasa Indonesia" are LTR runs inside an RTL screen and must be wrapped, exactly as an email is at `figma-members.tsx:148`.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `circleMembers.roleDescriptions.caregiver` *(rewrite)* | مقدّم رعاية بأجر. يرى مهام اليوم والجرعات المسندة إليه فقط، ويسجّل مناوباته. | A hired caregiver. Sees only today's assigned tasks and doses, and records their own shifts. |
| `circleMembers.capabilities.caregiver.summary` *(rewrite)* | يسجّل رعاية اليوم ومناوباته، ولا يرى بقية بيانات الدائرة. | Records today's care and their own shifts; does not see the rest of the circle's data. |
| `caregiver.invite.disclosureTitle` | ما سيراه مقدّم الرعاية | What the caregiver will see |
| `caregiver.invite.sees.tasks` | اسم الشخص الذي تعتني به، ومهام اليوم المسندة إليه | The name of the person you care for, and today's assigned tasks |
| `caregiver.invite.sees.doses` | الجرعات المسندة إليه وأوقاتها | The doses assigned to them, and their times |
| `caregiver.invite.sees.shift` | سجلّ مناوباته وفترات راحته | Their own shift and rest log |
| `caregiver.invite.sees.summary` | الملخّص الأسبوعي نفسه الذي تراه العائلة | The same weekly summary the family sees |
| `caregiver.invite.hiddenTitle` | ما لن يراه | What they will not see |
| `caregiver.invite.hidden.members` | بيانات بقية الأعضاء أو بريدهم الإلكتروني | Other members' details or email addresses |
| `caregiver.invite.hidden.pulse` | سجل نشاط الدائرة | The circle's activity log |
| `caregiver.invite.hidden.medical` | القياسات الحيوية والسجلات اليومية وبطاقة الطوارئ | Vitals, daily logs, and the emergency card |
| `caregiver.invite.hidden.unassigned` | أي بيانات لم تُسند إليه | Anything not assigned to them |
| `caregiver.invite.notRecordedTitle` | ما لا يسجّله التطبيق | What the app does not record |
| `caregiver.invite.notRecorded.location` | الموقع الجغرافي — لا يُسجَّل ولا يُطلب في أي وقت | Location — never recorded, never requested |
| `caregiver.invite.notRecorded.background` | أي نشاط في الخلفية | Any background activity |
| `caregiver.invite.notRecorded.mic` | الميكروفون أو الكاميرا دون ضغطة منه | The microphone or camera without a tap from them |
| `caregiver.invite.notRecorded.photos` | أي صورة لم يرفقها بنفسه | Any photo they did not attach themselves |
| `caregiver.invite.mutualNote` | مقدّم الرعاية يرى عن نفسه ما تراه العائلة عنه، بلا استثناء. | The caregiver sees the same record about themselves that the family sees. Nothing is hidden from them. |
| `caregiver.invite.languageLabel` | لغة تطبيق مقدّم الرعاية | Caregiver's app language |
| `caregiver.invite.languageHint` | يمكن تغييرها من داخل التطبيق في أي وقت. | They can change it from inside the app at any time. |
| `caregiver.invite.codeNote` | هذا الرمز يفتح تطبيق مقدّم الرعاية، لا تطبيق العائلة. | This code opens the caregiver app, not the family app. |

---

### C1-2 · صفّ مقدّم الرعاية في دائرة الرعاية / The caregiver row in the roster, and the role legend
**Governing report:** `docs/product-report-2026-07-18/10-members-and-invitations.md` (frame 9a).
**Purpose:** Make a hired caregiver legible in the roster as a distinct kind of member — not a family editor — and explain that role in the legend.
**Entry point:** Explore tab → «دائرة الرعاية» group → «دائرة الرعاية» row. Visible to every active member; the `MoreHorizontal` management affordance appears only where `memberHasActions(member, all, actorRole)` returns true (`src/features/circle-members/figma-member-actions.tsx:46-63`).
**Header chrome:** `FigmaHeader` — bordered back square, centered 20/800 «دائرة الرعاية», manager-only filled `Plus` square.

**Content blocks, in order:**
1. **Circle summary pill** — existing tinted `primaryBg` pill, `Users` icon + `figma.members.summary` interpolating `{{name}}` (recipient) and `{{count}}` (active members). *Note: this is one of the 11 keys affected by the missing Arabic plurals.*
2. **«إدارة الدعوات»** — existing `Button variant="secondary"`, managers only.
3. **Member rows.** Each: 44px letter avatar (2px border, `Radius.pill`, tint fill, 18/900 initial from `initialOf()`), name 16/800, optional «أنت» badge (1.5px `primaryText` border, r4), then a meta row of role icon + role label + optional status + optional LTR email.
   **NEW — the caregiver's own visual identity.** `roleVisual()` at `figma-members.tsx:38-46` currently folds `caregiver` into the same amber `Edit3` bucket as `family_member`. That is wrong: a hired caregiver is not a family editor. Proposal: lucide **`HandHelping`** (already in the app's lucide set — used for the claim pill at `figma-tasks.tsx:590`) on the accent tone (`primaryText` fg / `primaryBg` tint — the sanctioned acc-on-tacc tint pairing). **This slot takes a lucide component and not a semantic `IconName`, because the roster row is hand-composed inside `figma-members.tsx` — it is not `FigmaListRow` and not `GlyphChip`, both of which take `iconName: IconName`.** If the row is ever converted to `FigmaListRow`, the glyph must become a registry name; the nearest existing entry is `claim` (`ionicons:hand-left-outline`, already in use for the claim CTA). The designer draws the row; the icon choice must be distinguishable from `Crown` (manager), `Edit3` (family editor), and `Eye` (view-only) at 12px.
   **NEW — a «تطبيق مقدّم الرعاية» meta chip** on the caregiver row, plus the app language as a meta segment, so a manager can see at a glance that this person is on the simplified shell and in which language. Keys: `caregiver.roster.appBadge`, `caregiver.roster.languageMeta`.
4. **Inactive section** — existing `SectionHeader` + rows at 0.6 opacity with a `circleMembers.status.*` meta segment. Managers only.
5. **Role legend card** — existing `Surface` + `figma.members.rolesTitle` + the `LEGEND` array at `figma-members.tsx:49-53`. **NEW: a fourth row.** Keys `figma.members.legend.caregiver` + `.caregiverDesc`, tone-matched to the new caregiver glyph colour.

**States to draw:**
| State | What the designer draws |
|---|---|
| default | The roster with one caregiver row among family rows, so the visual distinction is testable at a glance. Both themes. |
| empty | n/a — a circle always contains at least its creator. |
| loading | `SkeletonList` (`src/components/skeleton.tsx:69`) — N bordered cards with a 44 pill chip + 70%/45% lines, `accessibilityRole="progressbar"`. |
| error | The existing inline card at `figma-members.tsx:198-206`: `Surface tone="card" padded={20}` + centered 16/800 `errorFg` message (`circleMembers.loadError`) + a centered bordered retry pill. **Not** the shared `ErrorState`. |
| validation error | n/a — no input on this screen. |
| read-only / permission-denied | A non-manager sees every row but no `MoreHorizontal` on any of them, no `+` square in the band, no «إدارة الدعوات» button, and no inactive section. Draw this variant — it is the majority case. |
| confirm sheet | `MemberActionsSheet` (`FigmaBottomSheet` chrome; both `MemberActionsSheet` and `memberHasActions` are real exports of `figma-member-actions.tsx` and are importable) in its `role` mode: `OptionSelect variant="card"` over `assignableRolesFor(...)`, plus the live direction note (`ArrowUp`/`ArrowDown`/`ArrowLeftRight` on the matching tint). **NEW: when the change crosses into or out of `caregiver`, add a second note below the direction note** — the role change swaps which app shell that person opens, and takes effect only on their next app launch. Key: `caregiver.roster.shellChangeWarning`. Draw it in the amber `warningFg`/`warningBg` caution tone, never gold. |

**Reuse these existing components:** `FigmaScreen`, `FigmaHeader` · `Surface` · `SectionHeader` (`src/components/section-header.tsx`) · `SkeletonList` · `Button variant="secondary"` · `MemberActionsSheet` + `memberHasActions` (`src/features/circle-members/figma-member-actions.tsx`) · `FigmaBottomSheet` · `OptionSelect variant="card"` · `isolateLtr` · `memberDisplayName()` (`src/features/circle-members/display-name.ts:27`).
**GENUINELY NEW — no component exists:** the «تطبيق مقدّم الرعاية» meta chip. There is **no badge primitive** — the «أنت» badge is a local style at `figma-members.tsx:321-327` and the gold notification badge is inline in `figma-home.tsx`. **Decided: the new chip borrows the «أنت» badge's local style** (1.5px `primaryText` border, `Radius.tiny` 4, `primaryText` 14/700 label on `card`) and will be re-implemented alongside it — **never** the gold notification badge, because gold is reserved for claim surfaces and one-time/irreversible warnings only. Nothing else is new — the row, avatar, legend, and sheet all exist.
**RTL / LTR notes:** The email meta segment is `isolateLtr(emailLine)`. **The member name itself comes from `memberDisplayName()` (`display-name.ts:27`), which falls back to an email local-part — a Latin run inside an Arabic sentence. Treat its output as untrusted direction and isolate it at the call site; never assume it is Arabic.** The language name, if shown as an endonym ("Tagalog"), is a Latin run inside Arabic and must be LTR-isolated the same way. The row's trailing affordance is `MoreHorizontal` (non-directional, safe). Any chevron added to make the row navigable must be `ChevronLeft` — forward points **left** in RTL.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `figma.members.legend.caregiver` | مقدّم رعاية | Caregiver |
| `figma.members.legend.caregiverDesc` | يسجّل رعاية اليوم ومناوباته فقط | Records today's care and their own shifts only |
| `caregiver.roster.appBadge` | تطبيق مقدّم الرعاية | Caregiver app |
| `caregiver.roster.languageMeta` | اللغة: {{language}} | Language: {{language}} |
| `caregiver.roster.shellChangeWarning` | تغيير هذا الدور يغيّر التطبيق الذي يفتحه هذا الشخص، ولن يكتمل التغيير إلا عند إعادة تشغيل تطبيقه. | Changing this role changes which app this person opens. It takes effect the next time they restart their app. |

---

### C1-3 · ملخّص الأسبوع لمقدّم الرعاية / Weekly caregiver summary
**Governing report:** new — Milestone 7 (plan §6 C1). Nearest precedents: `13-pulse.md` (the activity feed) and `04-medications.md` (dose statuses).
**Purpose:** Give the family one calm weekly page of what was recorded — counts and records, never a score.
**Entry point:** Two, both leading to the same screen. (a) Explore tab → «دائرة الرعاية» group → a **new** `FigmaListRow` «التنسيق مع مقدّم الرعاية» (manager-gated, hidden when the circle has no caregiver). `FigmaListRow` takes `iconName: IconName` — pass the existing registry entry **`member`** (`ionicons:people-outline`), already in use on the Explore rows. (b) The caregiver's roster row in C1-2, which gains a `ChevronLeft`. **Role gate:** managers see it and can share it; a `family_member` or `remote_member` sees it read-only without the share affordance; the caregiver herself sees the identical content at C1-9.
**Header chrome:** `FigmaHeader` sub-screen — bordered back square, centered 20/800 title = the caregiver's display name via `memberDisplayName()` (`display-name.ts:27`), 44dp empty spacer at the end (no add action).

**Content blocks, in order:**
1. **Identity card** — `Surface tone="card"`: 44px letter avatar, display name 16/800, `circleMembers.roles.caregiver` label with the C1-2 caregiver glyph, and the `caregiver.roster.appBadge` chip.
2. **Week selector** — previous / next week, with the range in the middle. **NEW: there is no stepper primitive and no calendar month view in the app.** Compose from two **hand-composed** 44×44 bordered squares — not `Button`, not `GlyphChip` — each holding a lucide chevron (`ChevronRight` = previous in RTL, `ChevronLeft` = next), plus a centered LTR-isolated `{{from}} — {{to}}` range. Draw the "current week, next disabled" state explicitly.
3. **Counts card** — three blocks: doses recorded, tasks completed, shifts recorded. Data: `medication_logs` rows in range, `care_tasks` with `completed_by` = this member in range, and the new shift table. **Use the `{{done}} من {{total}}` shape for doses**, never a bare `{{count}}` (Arabic plurals are broken) and never a percentage with a judgement attached — the Milestone 7 plan applies the same rule to the PDF adherence figure (§4.4: "a count, never a percentage-with-a-judgement"). The nearest visual is the local `StatTile` at `src/features/care-circle/figma-home.tsx:572` (**local to that file, not an export; it will be re-implemented**); the shared `StatTile` at `src/components/dashboard-tile.tsx:94` exists, is unused, and is directly reusable (48% width, minHeight 96, `ltrValue` prop). **Note two required props on the shared `StatTile`: `iconName: IconName` and `onPress` are both non-optional.** Pass the existing registry names `medication`, `task`, and `clock`; and give every tile a destination — if a counts tile should not navigate, making `onPress` optional is a component change and must be called out on the frame.
4. **Doses block** — `SectionHeader` «الجرعات» + seven day rows. Each row = the weekday label + a `DoseBeadStrip` (`src/components/dose-bead-strip.tsx:53`) whose beads carry the real per-dose status (`given` / `postponed` / `missed` / unlogged), with the LTR time under each bead and a single spoken a11y summary for the row. This is the app's one existing care-loop visual and it fits exactly.
5. **Tasks block** — `SectionHeader` «المهام» + a `Surface(padded=0)` group card of rows, each a title + LTR due + a `StatusBadge` (icon + 14/700 label; `StatusBadge` takes `tone` + `label` and an optional `iconName: IconName` — leave `iconName` unset so the tone's built-in registry icon is used). Reuse the task-row idiom from `figma-tasks.tsx:531-609` (**local to that file, not an export; it will be re-implemented**) stripped of the checkbox, claim pill, and cancel square — the family is reading, not acting.
6. **Shifts block** — `SectionHeader` «المناوبات» + one row per shift: date (LTR), start (LTR), end (LTR), total (LTR), rest-break count, and a `StatusBadge` for open vs. completed. Tapping a row opens C1-4b.
7. **NEW — the mirror note.** A `FigmaMutedNote` closing the page: `caregiver.week.mirrorNote`. This is the anti-surveillance anchor on the family side and it must be drawn, not implied.
8. **Share pill** — manager only. Reuse the Pulse header share idiom — **local to `src/features/pulse/figma-pulse.tsx`, not an export (the file's only export is `FigmaPulse`); it will be re-implemented.** Its one canonical spec, used identically in C1-3, C1-8 and C1-9: **bordered pill, `Radius.pill`, 2px `border`, `backgroundElement` fill, minHeight 36, padH 14, lucide `Share2` at 14px in `primaryText`, label 14/800 `primaryText` (JSX at `figma-pulse.tsx:90-106`, styles at `:178-187`).** It composes plain text the same way `composePulseShareText()` does (`src/features/pulse/present.ts:143-156`). **The shared text carries counts and the mirror note only — never a photo, never a location, never a raw email.**

**States to draw:**
| State | What the designer draws |
|---|---|
| default | A full week with all four blocks populated, including at least one postponed dose and one "not logged yet" bead, so the non-punitive statuses are visible. Both themes. |
| empty | A week with nothing recorded. `EmptyState` (`src/components/states.tsx:52`) inside the content area — a `Surface` card, a circle `GlyphChip` at `size="lg"`, 20/800 title, 16/600 subtitle. **`EmptyState` has exactly four props — `title`, `subtitle`, `icon` (legacy glyph), `iconName` — and no `tone` prop**: the chip's `tone="success"` and `shape="circle"` are fixed inside the component. Pass `iconName="success"` (the existing registry entry, `ionicons:checkmark-circle`), which renders as the green `ok` mark on the `tok` tint. **Green, not gold** (M6 retargeted empty/celebration to calm green). Copy is «أسبوع هادئ», never «لم يُنجَز شيء». The identity card and week selector stay. |
| loading | `SkeletonList` for the three list blocks; individual `Skeleton` blocks sized to the counts card. |
| error | The bespoke bordered Dar error card + retry pill (the idiom at `figma-tasks.tsx:274-283` / `figma-visits.tsx:125-135` — **inline in each of those files, not an export; it will be re-implemented**), with `caregiver.week.loadError`. |
| validation error | n/a — no input on this screen. |
| read-only / permission-denied | A `family_member` / `remote_member`: identical page minus the share pill. **Also draw the partial-data variant** — `medication_logs` SELECT is responsibility-scoped (`can_view_all_operational(circle_id) OR (is_circle_member AND is_responsible_for_medication)`), so a viewer who is not responsible for a medication will see that dose row rendered as unavailable rather than as a status. Use `<Icon name="lock" />` (an **existing** registry entry, `ionicons:lock-closed-outline`, currently unreferenced — an unused entry is still an existing entry) + `caregiver.proof.notPermitted`. Never a broken or blank bead. |
| confirm sheet | n/a — nothing on this screen mutates. |

**Reuse these existing components:** `FigmaScreen`, `FigmaHeader` · `Surface` (`tone="card"`, `padded={0}` for group cards, `gap` for field grouping) · `SectionHeader` · `DoseBeadStrip` · `StatusBadge` (`src/components/status-badge.tsx:57`) · `StatTile` (`src/components/dashboard-tile.tsx:94`, currently unused — a real export, unlike the `figma-home.tsx:572` twin) · `EmptyState`, `Skeleton`, `SkeletonList` · `GlyphChip` · `FigmaMutedNote` · `FigmaListRow` (for the Explore entry row) · `isolateLtr` / `LtrText` · `memberDisplayName()` (`display-name.ts:27`) · `Icon` (existing registry names `medication`, `task`, `clock`, `success`, `lock`).
**NOT reusable — local code that will be re-implemented:** the Pulse share pill (`figma-pulse.tsx:90-106`, `:178-187`) · the task-row idiom (`figma-tasks.tsx:531-609`) · the local `StatTile` (`figma-home.tsx:572`) · the bordered error card + retry pill (`figma-tasks.tsx:274-283`). None of these are exports.
**GENUINELY NEW — no component exists:**
- **A week/period stepper.** No stepper primitive exists — it is hand-rolled twice already (`daily-logs/figma-daily-log-fields.tsx:167`, `notifications/notification-settings.tsx:355`). No calendar month view, no week view, no date-range picker (`DateField` is a 3-column scroll wheel, not a grid).
- **A shift row / duration display.** No component renders an elapsed duration or a time range.
- **No chart, no sparkline, no progress bar** — and none should be introduced here. Vitals deliberately render value+unit text only; the same restraint applies. `DoseBeadStrip` is discrete beads, not a bar, and that is the correct visual.
- **No divider primitive** — every group card writes its own `height: BorderWidth.standard` rule.

**RTL / LTR notes:** LTR-isolate every one of: the week range, each bead's time, task due date/time, shift start/end/total. The `{{done}} من {{total}}` counts render with Western digits inside the Arabic sentence and each numeral run is isolated. `formatLongDate()` already forces Latin digits in Arabic via the `ar-u-nu-latn` extension (`src/utils/date.ts:52-63`) — match it. **The band title and the identity card's name both come from `memberDisplayName()`, which may return an email local-part — treat that output as untrusted direction and isolate it at the call site, exactly as C1-9 specifies.**
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.week.title` | ملخّص الأسبوع | This week's summary |
| `caregiver.week.range` | {{from}} — {{to}} | {{from}} — {{to}} |
| `caregiver.week.previous` | الأسبوع السابق | Previous week |
| `caregiver.week.next` | الأسبوع التالي | Next week |
| `caregiver.week.dosesLabel` | جرعات سُجِّلت | Doses recorded |
| `caregiver.week.tasksLabel` | مهام أُنجزت | Tasks completed |
| `caregiver.week.shiftsLabel` | مناوبات سُجِّلت | Shifts recorded |
| `caregiver.week.dosesCount` | {{done}} من {{total}} | {{done}} of {{total}} |
| `caregiver.week.unlogged` | لم تُسجَّل بعد | Not logged yet |
| `caregiver.week.empty` | أسبوع هادئ — لا سجلّات في هذه الفترة | A calm week — no records in this period |
| `caregiver.week.loadError` | تعذّر تحميل ملخّص الأسبوع. تحقّق من الاتصال وحاول مجددًا. | Couldn't load this week's summary. Check your connection and try again. |
| `caregiver.week.mirrorNote` | يرى مقدّم الرعاية هذه الصفحة نفسها عن نفسه. | The caregiver sees this same page about themselves. |
| `caregiver.week.share` | مشاركة ملخّص الأسبوع | Share this week's summary |

---

### C1-4 · سجلّ الجرعة وسجلّ المناوبة / Viewing photo-proof and shift records
**Governing report:** `04-medications.md` for the dose record; the photo surface is new — Milestone 7, and rides on plan item **A5** (dose-photo infrastructure), which is the deliberate overlap.
**Purpose:** Let the family open one recorded dose (with its photo, if the caregiver chose to attach one) or one shift, read-only.
**Entry point:** C1-3 → tap a dose bead or a task row (→ 4a) or a shift row (→ 4b). Same role gates as C1-3, plus the per-medication responsibility gate on 4a.
**Header chrome:** `FigmaHeader` sub-screen — back square, centered 20/800 title (medication name for 4a, the LTR date for 4b), 44dp spacer at the end. **No edit square, in either frame.** The absent action is the design. *(Note for the LTR worker-side twin: `FigmaHeader` hardcodes lucide `ChevronRight` for its back square with no direction branch — `figma-header.tsx:52`. It is correct in RTL and wrong in an LTR app; that is a fix requirement, not a design choice.)*

**Content blocks, in order — 4a, dose record:**
1. **Status hero** — `StatusBadge` with icon + Arabic label from the existing `medications.status.*` set: «أُعطيت» / «مؤجَّلة» / «لم تُعطَ». Pass `tone` + `label` and leave `iconName` unset so the tone's built-in registry icon renders. Never colour-only.
2. **NEW — the photo frame.** **This is the largest genuinely-new surface in the whole section.** The app has **no image component at all**: zero `<Image>` in any feature, and `expo-image` appears only in the unused splash leftover (`src/components/animated-icon.tsx`). There is no aspect-ratio box, no placeholder, no failed-load state, no zoom, no lightbox, no photo avatar. The designer must specify from scratch: the frame's aspect ratio and max height, its 2px `line` border and `Radius.sm` (8) per the Dar law, and all three of its states below.
   **Decided (not left to the designer): the photo is tappable and opens a new full-screen viewer.** That viewer is: a full-bleed `theme.overlay` scrim, the image centered and letterboxed (`contain`), and a single 44×44 bordered close square at the start of the top safe area carrying `<Icon name="close" />` (the existing registry entry, and the `FormModal` close-square idiom at `form-modal.tsx:67`). No zoom, no pan, no gallery, no swipe — one image, one close. **It is a new component: it is not `FigmaBottomSheet`, not `FormModal`, and not `PickerSheet`**, none of which are full-screen.
3. **Caption row** — `caregiver.proof.photoLabel` in 14/600 `textSecondary`, directly under the frame.
4. **Meta rows** — scheduled time (LTR), recorded time (LTR), recorded by (`memberDisplayName()`, `display-name.ts:27`), and the medication's dose instruction. Compose as a `Surface(padded=0)` group of rows with 2px dividers.
5. **NEW — the ownership note.** `FigmaMutedNote` = `caregiver.proof.ownerNote`. The family cannot delete or replace this photo; only the caregiver can, within her correction window. Draw the note *and* the absence of any destructive affordance. `ItemActions` must **not** appear on this screen.

**Content blocks, in order — 4b, shift record:**
1. **Status hero** — `StatusBadge`: «مناوبة مكتملة» (success tone) or «مناوبة مفتوحة» (info tone). Icon + text.
2. **Time rows** — date (LTR), start (LTR), end (LTR), total (LTR). Same group-card idiom.
3. **Rest breaks** — a nested list, each with start/end (LTR) and duration. If none, a calm `caregiver.shift.emptyToday`-style line, not an alert.
4. **Recorded by** — always the caregiver. Never a family member.
5. **NEW — the read-only note.** `FigmaMutedNote` = `caregiver.shift.familyReadOnly`.
6. **NEW — the deliberate absence of a location row.** Do not draw a placeholder, a greyed row, or a "location unavailable" line — draw nothing. If the layout feels incomplete there, that is the intended reading.

**States to draw:**
| State | What the designer draws |
|---|---|
| default | 4a with a photo attached; 4b completed with two rest breaks. Both themes, both frames. |
| empty | 4a with **no photo attached** — a bordered `backgroundSunken` frame at the same aspect ratio holding a muted camera glyph + `caregiver.proof.noPhoto` + `caregiver.proof.noPhotoHint`. **GENUINELY NEW registry entry required for that glyph:** `src/constants/icons.ts` has no camera entry among its 52 names, and `Camera` is not in the app's in-use lucide set either — propose adding **`camera` → ionicons `camera-outline`**, exactly as `Icon` consumers require an `IconName`. **This is not an error state.** Attaching a photo is always optional and the frame must not read as a failure. 4b with no rest breaks. |
| loading | A `Skeleton` block at the photo frame's **exact** aspect ratio — never a spinner floating in an empty box. Meta rows as thin `Skeleton` lines. |
| error | Signed-URL fetch failed → the bordered Dar error card + retry pill (inline idiom, not an export) inside the photo frame's footprint, with `caregiver.proof.loadError`. The meta rows still render — a failed image must never take the record down with it. |
| validation error | n/a — no input on either frame. |
| read-only / permission-denied | **This entire screen is read-only for the family; that is the default, not a variant.** The separate *permission-denied* case is real and must be drawn: a `family_member` who is not responsible for that medication cannot read the log row or fetch the photo (the live RLS predicate is `can_view_all_operational(circle_id) OR (is_circle_member AND is_responsible_for_medication(...))`, and the storage path `<circle_id>/<medication_id>/<log_id>.jpg` exists precisely so the bucket policy can mirror it). Draw `<Icon name="lock" />` (existing registry entry) + `caregiver.proof.notPermitted` in place of the photo frame — never a broken image, never a blank box. |
| confirm sheet | n/a — nothing on this screen mutates for the family. |

**Reuse these existing components:** `FigmaScreen`, `FigmaHeader` · `Surface` (`padded={0}` group cards) · `StatusBadge` · `Skeleton` · `FigmaMutedNote` · `GlyphChip` · `Icon` (existing registry names `lock`, `shield`, `close` — `lock` and `shield` are registered and currently unreferenced, which still makes them existing entries) · `LtrText` / `isolateLtr` · `memberDisplayName()` (`display-name.ts:27`).
**GENUINELY NEW — no component exists:**
- **The image / thumbnail component itself**, in every one of its states: loading, loaded, failed, absent, permission-denied.
- **A full-screen image viewer / lightbox.** None exists; its chrome is specified in block 2 above.
- **A `camera` registry entry** (`ionicons:camera-outline`) — see the empty state, and C1-7.
- **A thumbnail slot in a list row.** Plan item A5 notes that the 40×40 bordered `Radius.control` status square in `DoseCard` (`figma-medications.tsx:306-308`) and `DoseRow` (`figma-home.tsx:652-654`) are fixed-size `flexShrink:0` boxes and therefore drop-in thumbnail slots with no reflow — but the thumbnail *component* that would go in them does not exist.
- **A duration display** (shift total, rest length).
- **No attachment row, no document card, no PDF preview** — relevant only if a family later wants to attach a contract or an ID to a caregiver record. Out of C1 scope; flagged so the designer does not assume one exists.

**RTL / LTR notes:** Every time and date is LTR-isolated. **The "recorded by" value is `memberDisplayName()` output, which may resolve to an email local-part — treat it as untrusted direction and isolate it at the call site.** The photo itself is direction-agnostic but its **frame** sits at the start of the content column, which mirrors between the family (RTL) and worker (possibly LTR) shells — so the same record renders mirrored on the two sides. Note that explicitly on the frame.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.proof.title` | سجلّ الجرعة | Dose record |
| `caregiver.proof.photoLabel` | صورة أرفقها مقدّم الرعاية | Photo attached by the caregiver |
| `caregiver.proof.noPhoto` | لا صورة مرفقة | No photo attached |
| `caregiver.proof.noPhotoHint` | إرفاق الصورة اختياري. | Attaching a photo is optional. |
| `caregiver.proof.loadError` | تعذّر عرض الصورة. تحقّق من الاتصال وحاول مجددًا. | Couldn't show the photo. Check your connection and try again. |
| `caregiver.proof.notPermitted` | هذا السجلّ غير متاح لك — هذا الدواء ليس ضمن مسؤوليتك. | This record isn't available to you — this medication isn't one of your responsibilities. |
| `caregiver.proof.ownerNote` | هذه الصورة جزء من سجلّ مقدّم الرعاية. يمكنه وحده استبدالها. | This photo is part of the caregiver's own record. Only they can replace it. |
| `caregiver.shift.familyReadOnly` | تُسجَّل المناوبات من مقدّم الرعاية وحده. لا يمكن تعديلها من العائلة. | Shifts are recorded by the caregiver alone. The family cannot edit them. |

---

## Worker side — a different, radically simpler shell

**How to draw every worker frame.** Each of C1-5 through C1-10 must be delivered as **four artboards minimum**:

| # | Language | Direction | Why |
|---|---|---|---|
| 1 | **Tagalog (Filipino)** | **LTR** | The primary proof that the shell works mirrored. Covered by Cairo's `latin` + `latin-ext` subsets (including `ñ`). |
| 2 | Tagalog | LTR, **dark** | Both themes are first-class; identical layout, token values swap. |
| 3 | **Arabic** | RTL | An Arabic-speaking hired caregiver is the likeliest first real user in the Gulf. |
| 4 | Arabic | RTL, **dark** | Same. |

**Indonesian is a straight substitution for Tagalog** — same script, similar string lengths; draw one representative frame in Indonesian to sanity-check length rather than the full set. **Do not draw Hindi or Amharic.**

**What "the layout mirrors" concretely means in the LTR artboards:** text aligns **left**; row icon squares sit at the **left**; the back chevron points **LEFT** and forward chevrons point **RIGHT** — the exact inverse of the Arabic law stated on the brief cover; the bottom bar's first destination sits at the **left**; `marginStart`/`paddingEnd` resolve to left/right respectively. **Draw Tagalog and Indonesian strings 15–30% longer than their English equivalents** and verify every button label and tab label survives at that length.

**And draw the truth about the blocker:** with `SHOULD_BE_RTL = true` unfixed, the Tagalog artboards are **not** what ships — the app would render Tagalog text inside mirrored RTL chrome, with directional icons flipped the wrong way (`icon.tsx:51`), the date-picker columns reversed (`date-field.tsx:133`), and `FigmaHeader`'s hardcoded lucide `ChevronRight` back square still pointing right (`figma-header.tsx:52`). The designer should produce **one deliberately-broken reference frame** showing that, labelled as the pre-fix state, so the engineering fix has a visual acceptance criterion.

---

### C1-5 · تسجيل دخول مقدّم الرعاية واختيار اللغة / Worker sign-in, first run, and language choice
**Governing report:** `docs/product-report-2026-07-18/01-auth-and-onboarding.md` for the auth chrome (frame 7a); language choice and the consent card are new — Milestone 7.
**Purpose:** Get a worker who may not read Arabic from a cold app install into her own language, signed in, joined to one circle, and informed about what is and is not recorded — before she sees any care data.
**Target language(s):** Tagalog LTR primary; Arabic RTL secondary. **The language list screen itself must be legible with no language chosen** — it carries no translated chrome.
**Entry point:** Cold app launch on a device that has never signed in. The worker arrives with an invitation code sent by the family from C1-1.
**Header chrome:** None on the language screen (brand mark only). `AuthHeader` (`src/features/auth/auth-chrome.tsx:25`) on the sign-in and code steps — a 64×64 bordered `band` square holding the SVG care-mark, 30/900 title, 16/600 subtitle.

**Content blocks, in order:**

**Step 1 — Language.** Shown first, before any other text, on the `Screen` shell (`src/components/screen.tsx:68`, `center`, `MaxFormWidth`).
1. The brand square alone (no title — there is no language yet to write it in).
2. **NEW — the language list.** `OptionSelect variant="card"` is the closest reusable primitive: full-width stacked rows, 22px radio, title + optional description, selected = `primaryText` border + `primaryBg` fill. Each row's label is the language's **endonym in its own script** — `Tagalog` · `Bahasa Indonesia` · `العربية` · `English` — with the English name as the `description` line so a bilingual worker can cross-check. **These are not i18n values.** They must never be translated per active locale; they are a fixed endonym table, and no such data shape exists in the app (the nearest, `src/constants/timezones.ts:12-13`, is a closed `{en, ar}` type and is itself one of the four localisation blockers).
3. A primary continue button.
4. **NEW — the relaunch screen.** Selecting a language whose direction differs from the current one **cannot take effect until the next app launch**. Draw a full frame: `Surface tone="warning"` card (amber `warningFg` on `warningBg` — the sanctioned tint pairing, and **not gold**; gold is reserved for claim surfaces and one-time secrets only), an `<Icon name="warning" />` (existing registry entry, `ionicons:warning`), `caregiver.language.restartTitle`, `caregiver.language.restartBody`, and **no action button that claims to do it** — React Native cannot quit an app on iOS. This is an instruction, not an action. Draw it in the *old* direction, because that is what the user will actually be looking at.

**Step 2 — Sign in.**
5. `AuthHeader` with `auth.signInTitle` / `auth.signInSubtitle`, now in the chosen language.
6. `FormField` email — `keyboardType="email-address"`, `autoCapitalize="none"`.
7. `FormField` password with `secureToggle` (the component owns `secureTextEntry` and renders the eye reveal).
8. `AuthError` (`auth-chrome.tsx:42`) — a calm 15/700 `errorFg` row with a lucide `AlertCircle` rendered inside the component, announced as a live alert.
9. `FigmaFooterPrimaryButton` sign in.
10. A `Button variant="plain"` link to create an account, and one to forgot-password.

**Step 3 — Join by code.**
11. Reuse the join-circle form exactly: a single code input styled at `src/features/invitations/join-form.tsx:120-127` (`Fonts.mono`, 20px, `letterSpacing: 3`, centered, `writingDirection:'ltr'` — **a local StyleSheet entry in that file, not an exported component; it will be re-implemented**), the existing `joinCircle.warning` banner reproduced as shipped, and a primary submit. **Note for the maintainer, not a design instruction:** that banner's gold treatment predates the M6 gold reservation and meets neither arm of it — it is a caution shown when *entering* a code, revealing no one-time secret and doing nothing irreversible. Flag it for a separate decision rather than propagating the justification; do **not** cite it as a sanctioned gold use the way C1-1's `invitations.warning` (code shown once) genuinely is.
12. **NEW — the wrong-app error.** A family-role code must fail with a specific, non-blaming message, not the generic `joinCircle.errors.invalid`. Key: `caregiver.codeWrongApp`.

**Step 4 — Consent / transparency card.** Shown once, after joining, before the home appears.
13. **NEW — this card is the product's ethical spine and is not optional chrome.** `Surface tone="card"` with `SectionHeader` = `caregiver.consent.title`, then `caregiver.consent.body` at 16/400 with `lineHeight` ≥ 1.5×, then the four "not recorded" rows from C1-1 block 5 (hand-composed `<Icon name="shield" />` + text, location first), then `caregiver.consent.mutual` as a bolder 16/700 line. One primary button: `caregiver.consent.ack`. **Not gold.** Use `Surface tone="card"` with a **`GlyphChip tone="primary"` carrying `iconName="shield"`** — `primary` resolves to `primaryText` on `primaryBg` (acc on tacc). **Do not use `GlyphChip tone="accent"`: that tone maps to `accentFg`/`accentBg`, which are the gold tokens (`glyph-chip.tsx:19-36`), and gold on a consent card violates the gold reservation.**

**States to draw:**
| State | What the designer draws |
|---|---|
| default | All four steps, in Tagalog LTR and Arabic RTL, light and dark. |
| empty | n/a — no lists on this screen. |
| loading | Sign-in pending and join pending: the `FigmaFooterPrimaryButton`'s built-in spinner. Nothing else changes. |
| error | `AuthError` for wrong credentials; the same row for `caregiver.codeWrongApp`; and the join errors already in `joinCircle.errors.*` (expired / revoked / used / invalid / alreadyMember). |
| validation error | `FormField error` rows: required email, invalid email format, required password, code wrong length. Draw one field in its error state (2px `errorFg` border + `errorBg` tint + the component's `AlertCircle` + 15px message) so the pattern is unambiguous. |
| read-only / permission-denied | n/a. |
| confirm sheet | n/a — the consent card is a full step, not a sheet. |

**Reuse these existing components:** `Screen` (`center`, `keyboardAvoiding`, `maxWidth`) · `AuthHeader`, `AuthError` (`src/features/auth/auth-chrome.tsx`) · `FormField` (with `secureToggle`, `error`, `required`, `hint`) · `FigmaFooterPrimaryButton` · `Button variant="plain"` · `OptionSelect variant="card"` · `Surface` (tones `card`, `warning`) · `GlyphChip` (`tone="primary"`) · `SectionHeader` · `Icon` (existing registry names `shield`, `warning`).
**NOT reusable — local code that will be re-implemented:** the code-input style at `join-form.tsx:120-127` (a local `StyleSheet` entry, not an exported field component).
**GENUINELY NEW — no component exists:**
- **The language picker.** `i18n.changeLanguage` appears **nowhere** in the repo. There is no settings row for it, no persisted language preference, and no detector (`expo-localization` *is* already a dependency and already used for timezone at `src/features/notifications/device.ts:2`, so `getLocales()` is free — but nothing reads it). The only searchable-list chrome in the app is `TimezonePicker` (`src/components/timezone-picker.tsx`), which is explicitly **off** the canonical sheet chrome (`Radius.xl` + `hairlineWidth` instead of `Radius.sheet` 16 + 2px) and is flagged as an unfinished unification — do not copy it.
- **A search field.** The only search input in the app is a bare, unstyled `TextInput` inside `TimezonePicker` (`:101-113`) — no icon, no clear button, no shared style. **Decided: the language list has no search field.** Four entries do not need one, and inventing a search input is out of scope for this frame.
- **The relaunch-required screen.** No such pattern exists.
- **No toast/snackbar** anywhere in the app for any confirmation — feedback is either an inline `accessibilityRole="alert"` line or a bottom-anchored `FigmaBottomSheet`. **Decided: the language-saved confirmation is the inline `accessibilityRole="alert"` line**, immediately above the relaunch card; not a sheet, not a toast.

**RTL / LTR notes:** The endonyms `Tagalog`, `Bahasa Indonesia`, `English` are Latin runs that appear inside an Arabic-direction screen at first run and must each be LTR-isolated. `العربية` is an RTL run that appears inside a Tagalog LTR screen and needs the mirror treatment. The invitation code stays LTR in **every** language — `writingDirection: 'ltr'` on the input plus `isolateLtr()` wherever it is echoed. The email field is LTR content in an RTL layout in the Arabic draw.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.language.title` | اللغة | Language |
| `caregiver.language.choose` | اختيار اللغة | Choose your language |
| `caregiver.language.restartTitle` | يلزم إعادة تشغيل التطبيق | The app needs to be restarted |
| `caregiver.language.restartBody` | تم حفظ اللغة. يكتمل التغيير عند إغلاق التطبيق وفتحه مجددًا. | Your language is saved. The change is complete once the app is closed and opened again. |
| `caregiver.language.changeMine` | تغيير لغتي | Change my language |
| `caregiver.codeWrongApp` | هذا رمز دعوة عائلية. المطلوب رمز خاص بمقدّم الرعاية. | This is a family invitation code. A caregiver code is needed. |
| `caregiver.consent.title` | قبل البدء | Before you start |
| `caregiver.consent.body` | يسجّل هذا التطبيق ما يُضغط عليه فقط: المهام المعلَّمة منجزة، والصور المرفقة، وأوقات المناوبة المسجَّلة. لا يسجّل الموقع في أي وقت. | This app records only what you tap: the tasks marked done, the photos attached, and the shift times recorded. It never records your location. |
| `caregiver.consent.mutual` | ما تراه العائلة عنك يظهر لك هنا. | Whatever the family sees about you is shown to you here. |
| `caregiver.consent.ack` | فهمت | I understand |

*(Both locales must reach exact `ar.json` ↔ `en.json` key parity — currently 1102 leaves each, verified. `tl.json` and `id.json` are additional files that must reach the same leaf set; that translation is a separate localisation task and is not the designer's deliverable, but string-length realism in the artboards is.)*

---

### C1-6 · اليوم / Worker home — today only
**Governing report:** new — Milestone 7. Simplifies `05-tasks.md` (frame 8c) and `04-medications.md` (frame 6a).
**Purpose:** One screen, one day, three things: my shift, my doses, my tasks. Nothing else exists in this app.
**Target language(s):** Tagalog LTR + Arabic RTL, both themes. **This is the frame where mirroring matters most** — it has the most rows and the most icons.
**Entry point:** The worker shell's default route after C1-5. There is no other home.
**Header chrome:** **NEW — a worker band, a new component modelled on `FigmaTabBand`, not `FigmaTabBand` itself.** It copies that component's spec (`src/components/figma/figma-header.tsx:84`: `band` fill, own top safe-area inset, 24/800 `bandInk` title + optional 16/600 subtitle at 85% — the sanctioned `band`+`bandInk` pairing), but `FigmaTabBand` accepts **only** `title` and `subtitle`, so the shift-state chip cannot be passed to it; the worker band is a new component. It must also **not** carry the family Home band's furniture: no circle switcher chevron, no notification bell, no gold unread badge, no emergency square (those are all local to `figma-home.tsx:315`). It carries: the care recipient's first name as title, today's date (LTR) as subtitle, and a shift-state chip.

**Content blocks, in order:**
1. **Shift control — the largest element on the screen.** A single full-width button whose label and tone change by state: not started → «بدء المناوبة» (`primary` fill with an `onPrimary` label — the fixed AA pair, never remixed); on shift → «إنهاء المناوبة» (`secondary`: `card` fill + 2px `line` border + `text` label, so ending is never a one-tap accident); on rest → «إنهاء الراحة». Under it, the current-state line with an LTR time. Tapping the state line opens C1-8.
   **GENUINELY NEW:** `ButtonSize` has only `md` (minHeight 52) and `sm` (minHeight 48), and `FigmaFooterPrimaryButton` is fixed at 52 with **no** size prop by design. A worker-scale primary — larger tap target, larger label — has no token and no variant. The designer must specify it, and it must still honour the ≥16 body rule and the 14 absolute floor at 200% font scale.
2. **`SectionHeader` «جرعات اليوم»** — the 10×10 solid `primary` square + 16/800 title.
3. **Dose rows** — one `Surface(padded=0)` group card. Each row: medication name 16/800, dose instruction 14/600, scheduled time (LTR), and **one large action button**. Two states only: due (button = «تسجيل الجرعة») and logged (a `StatusBadge`, icon + text, from `medications.status.*`, with `iconName` left unset so the tone's registry icon renders). Do **not** import the family screen's segmented tabs («جرعات اليوم / كل الأدوية»), the responsible-person line, or the «كل الأدوية» browse affordance. Tapping a due row opens C1-7.
4. **`SectionHeader` «مهام اليوم»**.
5. **Task rows** — a second group card. Each row: a checkbox circle (family draws it at 28px, `figma-tasks.tsx:667-676`; **draw it larger for the worker** — specify the size), title 16/800, LTR due time, and the «تعذّر الإنجاز» square on the end: a **hand-composed** 34px bordered `Radius.control` square holding a lucide `X` in `errorFg` — hand-composed because it is not `GlyphChip` and not `Button`, both of which take an `iconName: IconName`. **Strip everything else** from the family task row: no segmented status tabs, no مهامي/كل المهام scope pills, no «أنا متكفّل» claim pill, no assignee meta, no navigation to a task detail.
6. **NEW — nothing else.** No Explore, no Pulse, no vitals, no daily logs, no members, no emergency card, no notification centre. The restraint is the feature.
7. **Bottom bar** — **NEW, two destinations only: «اليوم» and «أنا»** (→ C1-9). `FigmaTabBar` cannot be reused (closed 3-entry `TAB_META`, `null` for unknown routes, and the file itself flags that three short labels need runtime QA at 200% font scale — two longer worker-language labels will need it more).

**States to draw:**
| State | What the designer draws |
|---|---|
| default | Shift not started, with due doses and open tasks. Then the on-shift variant. Both, both directions, both themes. |
| empty | → C1-10. Note the empty replaces **blocks 2–5 only**; the band, the shift control, and the bottom bar stay. |
| loading | `SkeletonList` in place of each group card. The shift control renders immediately from local state — never skeleton the one control she may need most. |
| error | The bordered Dar error card + retry pill (inline idiom, not an export), with `caregiver.worker.loadError`. **Critical: the shift control must remain usable when the care data fails to load.** Draw that combination explicitly. |
| validation error | n/a — no input on this screen. |
| read-only / permission-denied | **n/a, and deliberately so.** A worker whose shift has not started is *not* locked out of logging care. Never gate a dose behind a clock. Draw the un-started state as a prompt above the rows, not as a disabled list. |
| confirm sheet | The task complete / «تعذّر الإنجاز» confirm, reusing the Dar bottom-sheet chrome (`BottomSheet` + `SheetButton`, `figma-tasks.tsx:331` and `:366` — scrim, `card` sheet, 48×8 sunken grab handle, `Radius.sheet` 16 top corners, centered 18/800 title, stacked full-width primary then secondary) at worker scale. Per the standing law, a one-tap mutation must be guarded by exactly one of the three sanctioned patterns; this is pattern 3. |

**Reuse these existing components:** `FigmaScreen` (with its `band` slot) · `SectionHeader` · `Surface` (`padded={0}`) · `StatusBadge` · `SkeletonList`, `Skeleton` · `EmptyState` · `GlyphChip` · `isolateLtr` / `LtrText` · `Icon`.
**NOT reusable — local code that will be re-implemented:** the `BottomSheet` + `SheetButton` confirm chrome at `src/features/tasks/figma-tasks.tsx:331,366` — **local to that file, not an export; it will be re-implemented** · the checkbox circle at `figma-tasks.tsx:667-676` (inline styles) · the bordered error card + retry pill (`figma-tasks.tsx:274-283`).
**GENUINELY NEW — no component exists:** the worker band variant · the worker-scale primary button size · the worker bottom bar (2 destinations) · a larger checkbox circle · the hand-composed «تعذّر الإنجاز» square. **Pull-to-refresh — decided: none in the worker shell.** No pull-to-refresh is wired anywhere in the app (`Screen` accepts a `refreshControl` prop but no screen passes one, and `FigmaScreen` has no such prop at all); the error card's retry pill is the worker home's only refresh affordance, so no additional state is drawn.
**RTL / LTR notes:** Every scheduled time, due time, and the band date is LTR-isolated. In the Tagalog LTR artboard the whole row order reverses relative to the Arabic one: icon/checkbox at the **left**, action button at the **right**. The `X` "couldn't do it" square lives on the row's **end**, which is left in Arabic and right in Tagalog — draw both, do not assume the reader will infer it.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.worker.todayTitle` | اليوم | Today |
| `caregiver.worker.dosesTitle` | جرعات اليوم | Today's doses |
| `caregiver.worker.tasksTitle` | مهام اليوم | Today's tasks |
| `caregiver.worker.give` | تسجيل الجرعة | Record the dose |
| `caregiver.worker.postpone` | تأجيل | Postpone |
| `caregiver.worker.cannotGive` | تعذّر إعطاء الجرعة | Couldn't give this dose |
| `caregiver.worker.done` | تم | Done |
| `caregiver.worker.cannotDo` | تعذّر الإنجاز | Couldn't do this |
| `caregiver.worker.loadError` | تعذّر تحميل عمل اليوم. تحقّق من الاتصال وحاول مجددًا. | Couldn't load today's work. Check your connection and try again. |
| `caregiver.worker.offline` | تعذّر الحفظ — لا يوجد اتصال. حاول مجددًا عند عودة الاتصال. | Couldn't save — no connection. Try again when you're back online. |

*(`caregiver.worker.offline` deliberately does **not** promise a queue. There is no offline mutation queue in the app — §7.8 of the plan — and copy that implies one would be a lie the worker pays for.)*

---

### C1-7 · مهمة مع صورة / A task or dose with photo-proof capture
**Governing report:** `04-medications.md` for the dose action; the capture flow is new — Milestone 7, riding on plan item **A5**.
**Purpose:** Record one dose or task, and — always optionally — attach a photo that is *her* record it was done.
**Target language(s):** Tagalog LTR + Arabic RTL, both themes.
**Entry point:** C1-6 → tap a due dose row or an open task row.
**Header chrome:** `FigmaHeader` sub-screen — bordered back square, centered 20/800 title = the medication or task name, 44dp spacer at the end. The back square's glyph must be lucide `ChevronRight` in the RTL draw and `ChevronLeft` in the LTR draw; **`FigmaHeader` currently hardcodes `ChevronRight` with no direction branch (`figma-header.tsx:52`), so the LTR artboard is a fix requirement, not a component that exists today.**

**Content blocks, in order:**
1. **What and when** — the medication name 18/700 (or task title), the dose instruction, and the scheduled time as a large LTR value. Per the Dar law, big numeric values render LTR at up to 26/900 centered.
2. **Primary actions, stacked, at worker scale** — «تسجيل الجرعة» (`primary` fill + `onPrimary` label) and «تأجيل» (`secondary`). Below them, the smaller restrained-danger «تعذّر إعطاء الجرعة» (`card` fill + 2px `errorFg` border + `errorFg` text — the `Button variant="danger"` treatment). **Never a full-red screen.**
3. **NEW — the photo block.** Always optional, always after the action, never before it.
   - **Add affordance:** a bordered `backgroundSunken` square (2px `line`, `Radius.control` 6) with a camera glyph + `caregiver.photo.addLabel` + `caregiver.photo.optional`. **GENUINELY NEW registry entry required:** `src/constants/icons.ts` has no camera among its 52 entries and `Camera` is not in the app's in-use lucide set — propose adding **`camera` → ionicons `camera-outline`** and render it via `<Icon name="camera" />`. Do not assume a camera icon already exists.
   - **Framing line, mandatory:** `caregiver.photo.purpose` — «سجلّك أنت بأن هذه الجرعة أُعطيت.» This exact framing is the constraint, not decoration.
   - **Explicit save semantics:** `caregiver.photo.sendOnSave` — the photo is sent only when she saves. **Draw the save step. Never auto-upload on pick.**
   - **Capture UI is the OS, not the app.** There is no `expo-camera` and no in-app camera; the plan installs `expo-image-picker`, which opens the platform camera or gallery sheet. The designer draws the *entry* affordance and the *returned* thumbnail, not a camera viewfinder.
   - **After pick:** the thumbnail at the same frame spec as C1-4a, plus `caregiver.photo.replace` and `caregiver.photo.remove`.
4. **NEW — the upload state.** There is **no progress bar and no toast** in this app. **Decided (not left to the designer): the upload state is the inline `accessibilityRole="alert"` status line** — the `FormActions` idiom at `src/components/form-actions.tsx:45-60`, re-implemented here because `FormActions` bundles its own `FigmaFooterPrimaryButton` — carrying `caregiver.photo.uploading`, with the thumbnail held at 0.6 opacity while the send is in flight. No progress bar, no spinner over the image, no toast. A stalled connection is the realistic case, not the edge case, so draw the alert line and the dimmed thumbnail together.
5. **Optional note** — `FormField multiline` (minHeight 84, top-aligned).
6. **Save** — `FigmaFooterPrimaryButton` at worker scale.

**States to draw:**
| State | What the designer draws |
|---|---|
| default | The dose with no photo yet; then the same frame with a thumbnail attached. Both directions, both themes. |
| empty | The add-photo square is itself the empty state and must read as an invitation, never as a missing requirement. |
| loading | Fetching the dose → `Skeleton` lines. Uploading → the upload state from block 4. |
| error | **Two distinct errors, drawn separately.** (a) The record failed to save → an alert row + the actions still available. (b) The record saved but the photo upload failed → `caregiver.photo.uploadFailed` + a `caregiver.photo.retry` affordance. **The dose must survive an upload failure, and the copy must say so** — a worker who thinks her dose record was lost because a photo failed will re-dose. |
| validation error | Normally n/a — nothing is required. **One exception:** if a family has marked a medication as photo-required, draw the `FormField error` row with `caregiver.photo.required` on the photo block. |
| read-only / permission-denied | A dose already logged and past its correction window: the frame renders with its `StatusBadge` and **all actions absent** — no disabled buttons, no greyed-out affordances. Absence, not disabling. |
| confirm sheet | The Dar bottom-sheet confirm at worker scale, for both «تسجيل الجرعة» and «تعذّر إعطاء الجرعة». Same chrome as C1-6. |

**Reuse these existing components:** `FigmaScreen`, `FigmaHeader` · `Surface` · `Button` (`primary` / `secondary` / `danger` variants) · `FigmaFooterPrimaryButton` · `FormField` (`multiline`) · `StatusBadge` · `Skeleton` · `FigmaMutedNote` · `LtrText` / `isolateLtr` · `Icon`.
**NOT reusable — local code that will be re-implemented:** the `BottomSheet` + `SheetButton` confirm chrome (`src/features/tasks/figma-tasks.tsx:331,366`) — **local to that file, not an export** · the `FormActions` status-line idiom (`form-actions.tsx:45-60`) is inside an exported component that also renders its own save button, so the status line alone is re-implemented.
**GENUINELY NEW — no component exists:** the image/thumbnail component (see C1-4) · the add-photo affordance · a **`camera` registry entry** (`ionicons:camera-outline`) · the replace/remove pair on a photo · the upload status surface · a per-medication "photo required" rule and its validation row · **no toast** for the "photo sent" confirmation — use the inline alert-row idiom.
**RTL / LTR notes:** The scheduled time renders LTR at large size, centered — it does not flip. The thumbnail and its action pair sit at the content column's start, which mirrors between the two artboard sets. Any note the worker types is her own language's direction and needs no isolation; the *time* interpolated into a status line does.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.photo.addLabel` | إضافة صورة | Add a photo |
| `caregiver.photo.optional` | اختياري | Optional |
| `caregiver.photo.purpose` | سجلّك أنت بأن هذه الجرعة أُعطيت. | Your own record that this dose was given. |
| `caregiver.photo.sendOnSave` | لا تُرسَل الصورة إلا عند الحفظ. | The photo is only sent when you save. |
| `caregiver.photo.replace` | استبدال الصورة | Replace photo |
| `caregiver.photo.remove` | إزالة الصورة | Remove photo |
| `caregiver.photo.uploading` | جارٍ إرسال الصورة | Sending the photo |
| `caregiver.photo.uploadFailed` | حُفظت الجرعة، وتعذّر إرسال الصورة. حاول إرسالها مجددًا. | The dose was saved. The photo couldn't be sent. Try sending it again. |
| `caregiver.photo.retry` | إعادة إرسال الصورة | Send the photo again |
| `caregiver.photo.required` | هذا الدواء يتطلّب صورة مع التسجيل. | This medication requires a photo with the record. |

---

### C1-8 · المناوبة والراحة / Shift start, shift end, and rest logging
**Governing report:** new — Milestone 7. No existing report covers attendance; the closest data precedent is `18-data-model.md`.
**Purpose:** Let the worker record when she started, when she rested, and when she finished — as **her** record, which she can correct and take with her.
**Target language(s):** Tagalog LTR + Arabic RTL, both themes.
**Entry point:** C1-6 → tap the shift-state line under the shift button; or the «أنا» destination → «المناوبة».
**Header chrome:** `FigmaHeader` sub-screen — back square, centered 20/800 `caregiver.shift.title`, 44dp spacer. (Same hardcoded-`ChevronRight` caveat as C1-7 applies to the LTR draw.)

**Content blocks, in order:**
1. **State hero card** — a large `Surface` showing exactly one of four states, each with an icon + text label (never colour-only): not started · on shift since HH:MM (LTR) · on rest since HH:MM (LTR) · ended at HH:MM (LTR).
   **NEW: an elapsed-duration display does not exist anywhere in the app.** **Decided (not left to the designer): the hero shows the start time only, and the total after she ends the shift.** No live-ticking elapsed clock — the M6 motion law is "dignified and minimal", motion respects the OS reduced-motion setting, and a running clock on a worker's screen reads as a timesheet under watch. Draw the static hero; do not draw a ticking variant.
2. **The primary action** — one full-width worker-scale button whose label follows the state: `caregiver.shift.start` / `caregiver.shift.end`.
3. **Rest — at the same visual weight.** `caregiver.shift.restStart` / `caregiver.shift.restEnd` as a second full-width button, **not** a secondary link, **not** a small chip, **not** tucked inside a menu. Logging rest must be at least as easy as logging work. This is a deliberate design instruction, not a preference.
4. **Today's segments** — a `Surface(padded=0)` group card, one row per segment: type (shift / rest, icon + text), start (LTR), end (LTR), duration (LTR). **Each row carries the sanctioned inline two-step confirm — `ItemActions` (`src/components/item-actions.tsx:21`, confirm pattern 2).** Not the bottom-sheet confirm; that pattern is reserved on this screen for the shift-end guard below, so the two are never ambiguous.
5. **Total** — `caregiver.shift.total` with an LTR value.
6. **NEW — «هذا السجلّ لك».** `caregiver.shift.ownRecord`, rendered as a plain `FigmaMutedNote`, not a banner. It states that she can correct and share it.
7. **NEW — export her own copy.** Reuse the Pulse share-pill idiom at its one canonical spec: **bordered pill, `Radius.pill`, 2px `border`, `backgroundElement` fill, minHeight 36, padH 14, lucide `Share2` at 14px in `primaryText`, label 14/800 `primaryText` (JSX at `figma-pulse.tsx:90-106`, styles at `:178-187`) — local to that file, not an export; it will be re-implemented.** It composes plain text like `composePulseShareText()` does. Key: `caregiver.shift.exportOwn`. **This is the single strongest anti-surveillance signal in the product — her record leaves with her.** It must be present and it must be prominent.

**States to draw:**
| State | What the designer draws |
|---|---|
| default | **All four hero states**, each in both directions and both themes. That is the bulk of this frame's work. |
| empty | No shift recorded today — `caregiver.shift.emptyToday`, a calm prompt with the start button below it. **Not** a warning, **not** amber, **not** an alert. A worker who has not clocked in is not in violation of anything. |
| loading | `Skeleton` on the hero and the segment rows; the primary button renders immediately. |
| error | A failed mutation surfaces `caregiver.shift.saveFailed` as an `accessibilityRole="alert"` row and the state **does not silently revert** — the standing law: every mutation must surface its failure, never revert silently. Draw the row and the unchanged state together. |
| validation error | Correcting a time so the end precedes the start → `FormField error` row with `caregiver.shift.endBeforeStart` on the corrected `TimeField`. |
| read-only / permission-denied | A past, closed day: segments render with no edit affordance. Draw the affordance as **absent**, not disabled. |
| confirm sheet | «إنهاء المناوبة» is a session-ending mutation and the standing law requires exactly one of the three sanctioned confirm patterns. Use pattern 3 — the Dar bottom-sheet confirm — with `caregiver.shift.confirmEndTitle` / `caregiver.shift.confirmEndBody`. Note the body explicitly promises she can correct it later; that promise must be true in the build. |

**Reuse these existing components:** `FigmaScreen`, `FigmaHeader` · `Surface` (`card`, `padded={0}`) · `StatusBadge` · `Button` · `FigmaFooterPrimaryButton` · `TimeField` (`src/components/time-field.tsx:53` — labeled trigger → `PickerSheet` with hour/minute/period `WheelColumn`s, displays 12-hour Arabic, stores 24-hour `HH:MM`. **It reads the AM/PM labels itself from `pickers.am` / `pickers.pm` via `useTranslation` (`time-field.tsx:70-71`); there are no AM/PM label props — its full prop set is `label`, `value`, `onChange`, `error`, `placeholder`, `disabled`, `clearable`, `minuteStep`, `accessibilityLabel`.**) · `DateField` · `ItemActions` · `Skeleton` · `FigmaMutedNote` · `LtrText` / `isolateLtr`.
**NOT reusable — local code that will be re-implemented:** the `BottomSheet` + `SheetButton` confirm chrome (`figma-tasks.tsx:331,366`) — **local to that file, not an export** · the Pulse share pill (`figma-pulse.tsx:90-106`, `:178-187`) — **local to that file, not an export**.
**GENUINELY NEW — no component exists:** the shift state hero · an elapsed-duration or total-duration display · the segment row (a time *range* row) · a duration input, if a correction should be expressible as "6 hours" rather than two clock times (there is no duration field — only `DateField`, `TimeField`, `DateTimeField`).
**RTL / LTR notes:** Every clock time, every duration, and the total are LTR-isolated. **Warning for the LTR draw:** `TimeField`'s picker column order is reversed on `I18nManager.isRTL` (`src/components/date-field.tsx:133` does the same for date), and with the `forceRTL` constant unfixed that flag stays `true` even in Tagalog — so the wheel columns would render in Arabic order inside an LTR app. Draw the correct LTR column order and mark it as a fix requirement.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.shift.title` | المناوبة | Shift |
| `caregiver.shift.start` | بدء المناوبة | Start shift |
| `caregiver.shift.end` | إنهاء المناوبة | End shift |
| `caregiver.shift.restStart` | بدء الراحة | Start rest |
| `caregiver.shift.restEnd` | إنهاء الراحة | End rest |
| `caregiver.shift.notStarted` | لم تبدأ المناوبة بعد | Shift not started yet |
| `caregiver.shift.onShiftSince` | المناوبة جارية منذ {{time}} | On shift since {{time}} |
| `caregiver.shift.onRestSince` | راحة منذ {{time}} | On rest since {{time}} |
| `caregiver.shift.endedAt` | انتهت المناوبة الساعة {{time}} | Shift ended at {{time}} |
| `caregiver.shift.total` | المجموع: {{value}} | Total: {{value}} |
| `caregiver.shift.emptyToday` | لم تُسجَّل مناوبة اليوم بعد | No shift recorded today yet |
| `caregiver.shift.confirmEndTitle` | إنهاء المناوبة؟ | End the shift? |
| `caregiver.shift.confirmEndBody` | سيُسجَّل وقت الانتهاء الآن، ويمكنك تصحيحه لاحقًا من هذه الصفحة. | The end time will be recorded now. You can correct it later from this page. |
| `caregiver.shift.saveFailed` | تعذّر حفظ المناوبة. تحقّق من الاتصال وحاول مجددًا. | Couldn't save the shift. Check your connection and try again. |
| `caregiver.shift.endBeforeStart` | وقت الانتهاء قبل وقت البدء. | The end time is before the start time. |
| `caregiver.shift.ownRecord` | هذا السجلّ لك. يمكنك تصحيحه ومشاركته في أي وقت. | This log is yours. You can correct it and share it at any time. |
| `caregiver.shift.exportOwn` | حفظ نسخة من سجلّي | Save a copy of my log |

*(`{{time}}` and `{{value}}` follow the repo convention: they are **pre-formatted, already-bidi-isolated strings** produced in JS before interpolation — never raw numbers or `Date` objects. Precedent: `src/features/invitations/invitations-list.tsx:138`.)*

---

### C1-9 · ما تراه العائلة عنّي / What the family sees about me — the transparency screen
**Governing report:** new — Milestone 7 (plan §6 C1). This screen is the design constraint made literal.
**Purpose:** Show the worker, in her own language, the exact record the family holds about her — and the explicit list of what is never collected.
**Target language(s):** Tagalog LTR + Arabic RTL, both themes. **If only one worker frame can be drawn in all four artboards, it is this one.**
**Entry point:** The «أنا» destination in the worker bottom bar. One tap from the home. It must never be buried in a settings menu.
**Header chrome:** **The worker band variant defined in C1-6** — `band` fill, own top safe-area inset, 24/800 `bandInk` title, no circle switcher, no bell, no gold badge, no emergency square — with `title` = `caregiver.transparency.title`. Not `FigmaHeader`, not `FigmaTabBand`; the same new worker band component as C1-6 and C1-10, used consistently across all three.

**Content blocks, in order:**
1. **Lead line** — `caregiver.transparency.lead` at 16/700, immediately under the band, above everything else.
2. **The family's view of her, rendered identically.** Not a paraphrase, not a summary of a summary — **the same block set as C1-3**: the counts card, the seven-day `DoseBeadStrip` rows, the task rows, and the shift rows, with the same numbers and the same `StatusBadge` labels. A worker shown the family's phone must recognise her own screen instantly. Draw them as a visual echo and say so on the frame.
3. **NEW — «ما لا يسجّله التطبيق» card.** The same four rows as C1-1 block 5 and C1-5 step 4 — hand-composed rows, each an `<Icon name="shield" />` (existing registry entry) + text, location first. These are not `FigmaListRow` rows. Statuses are never colour-only; each row is icon + text.
4. **NEW — «من يمكنه الاطلاع» card.** The circle members who can open her summary, **by name** via `memberDisplayName()` (`display-name.ts:27`) and by role label. `FigmaListRow` with `avatarText` handles the row shape (40dp letter avatar + 16/800 title + 14/600 subtitle). These rows are **not tappable**, and `FigmaListRow` renders its trailing `ChevronLeft` only when `onPress` is passed (`figma-list-row.tsx:68-73`) — so omitting `onPress` correctly yields a chevron-free, non-navigable row. **No email addresses** — the worker does not need them and the family did not consent to sharing them.
5. **«سجلّاتي»** — her shift log (→ C1-8) and the photos she attached, with the `caregiver.shift.exportOwn` share affordance repeated here, at the same canonical Pulse share-pill spec given in C1-3 and C1-8 (**local to `figma-pulse.tsx`, not an export; it will be re-implemented**).
6. **«تغيير لغتي»** — a `FigmaListRow` → the C1-5 language list. `FigmaListRow` takes `iconName: IconName`; pass the existing registry entry **`settings`** (`ionicons:settings-outline`, currently unreferenced but existing). Include the relaunch warning state.
7. **Sign out** — per the standing law, guarded by `confirmAction()` (`src/utils/confirm.ts:16`), mirroring the family Account tab at `src/app/(app)/(tabs)/account.tsx:61-73`. Restrained danger tone, with the existing `signOut` registry icon.

**States to draw:**
| State | What the designer draws |
|---|---|
| default | A worker with a week of records. Both directions, both themes. |
| empty | A new worker with nothing recorded — `EmptyState` with `iconName="success"` (the existing registry entry), which the component renders as a circle `GlyphChip` in the fixed `success` tone: the green `ok` check on the `tok` tint. **`EmptyState` has no `tone` prop** — `title`, `subtitle`, `icon`, `iconName` are its only four. Copy = `caregiver.transparency.empty`. **Never gold** (gold is claim + one-time warnings only). The "not recorded" card and the "who can see" card stay visible — they are the point of the screen and must render even with zero data. |
| loading | `SkeletonList` on the summary blocks; the static cards (blocks 3 and 4) render immediately from local data. |
| error | The bordered Dar error card + retry pill (inline idiom, not an export) on the summary block only. Blocks 3 and 4 must never fail — they are static copy plus the local roster. |
| validation error | n/a — no input. |
| read-only / permission-denied | n/a — this screen is about her, and she can always see it. |
| confirm sheet | `confirmAction()` for sign-out: `account.confirmSignOutTitle` / `account.confirmSignOutMessage`. |

**Reuse these existing components:** `FigmaScreen` · `Surface` · `SectionHeader` · `FigmaListRow` (with `avatarText`, and with `iconName="settings"` on the language row) · `DoseBeadStrip` · `StatusBadge` · `StatTile` (`dashboard-tile.tsx:94` — the real export; note its required `iconName` and `onPress`) · `EmptyState`, `SkeletonList` · `GlyphChip` · `Icon` (existing registry names `shield`, `signOut`, `settings`, `success`) · `confirmAction()` (`src/utils/confirm.ts:16`) · `memberDisplayName()` (`display-name.ts:27`) · `isolateLtr` / `LtrText`.
**NOT reusable — local code that will be re-implemented:** the Pulse share pill (`figma-pulse.tsx:90-106`, `:178-187`) — **local to that file, not an export** · the bordered error card + retry pill (`figma-tasks.tsx:274-283`) · everything C1-3 listed under the same heading.
**GENUINELY NEW — no component exists:** the icon-list "not recorded" card (same gap as C1-1) · the "who can see this" roster card is close to `FigmaListRow` but needs an explicit no-email variant · everything C1-3 flagged as new (stepper, shift row, duration) recurs here.
**RTL / LTR notes:** Identical to C1-3 for the summary blocks. Member names may mix scripts (an Arabic family name in a Tagalog UI) — each name is its own direction run, and `memberDisplayName()`'s output (which may resolve to an email local-part) should be treated as **untrusted direction**, not assumed LTR or RTL.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.transparency.title` | ما تراه العائلة عنّي | What the family sees about me |
| `caregiver.transparency.lead` | هذا كل ما تراه العائلة. لا شيء غيره. | This is everything the family sees. Nothing more. |
| `caregiver.transparency.notRecordedTitle` | ما لا يسجّله التطبيق | What the app does not record |
| `caregiver.transparency.whoCanSeeTitle` | من يمكنه الاطلاع | Who can see this |
| `caregiver.transparency.myRecordsTitle` | سجلّاتي | My records |
| `caregiver.transparency.empty` | لا سجلّات بعد — سيظهر عملك هنا. | No records yet — your work will appear here. |

*(The `caregiver.invite.notRecorded.*` leaves are reused verbatim here. One string, two audiences, identical wording — that identity is itself the argument that this is coordination and not surveillance, and it should not be paraphrased for either side.)*

---

### C1-10 · لا شيء اليوم / Worker empty state
**Governing report:** `15-design-system-core.md` (frame 7d, system states) for the empty archetype; the composition is new — Milestone 7.
**Purpose:** Tell a worker with nothing scheduled that this is normal, without implying she has no value and without implying she has the day off.
**Target language(s):** Tagalog LTR + Arabic RTL, both themes.
**Entry point:** C1-6 when the day has no doses and no tasks.
**Header chrome:** The worker band defined in C1-6, unchanged.

**Content blocks, in order:**
1. **The band stays.** Recipient name, LTR date, shift chip.
2. **The shift control stays.** A worker with no scheduled care may still be on shift and must still be able to start, rest, and end. **This is the reason C1-10 is a composed frame and not a standalone empty card.**
3. **`EmptyState`** (`src/components/states.tsx:52`) in place of blocks 3–5 of C1-6: one `Surface` card, a circle `GlyphChip` at `size="lg"` holding the green `ok` check, a 20/800 title, a 16/600 subtitle. Pass `iconName="success"` — the existing registry entry (`ionicons:checkmark-circle`). **`EmptyState` exposes no `tone` prop**; the chip's `success` tone and `circle` shape are fixed inside the component (`states.tsx:68-72`). **Green, never gold** — the M6 law retargeted empty/celebration from gold to a calm green `tok`+`ok` check.
4. **The bottom bar stays** — «أنا» must remain reachable.

**Two variants, both required:**

| Variant | Title | Subtitle |
|---|---|---|
| **Nothing scheduled** | `caregiver.worker.emptyTitle` | `caregiver.worker.emptySubtitle` |
| **Everything done** | `caregiver.worker.allDoneTitle` | `caregiver.worker.allDoneSubtitle` |

**Copy guardrails for this frame specifically:**
- **Never** «لا عمل لديك» / "you have no work" — that reads as a judgement on her worth.
- **Never** «استمتع بيومك» / "enjoy your day off" — she may not have one, and the app cannot know.
- **Never** a completion reward. No streak, no score, no points, no badge, no confetti, no "great job", no exclamation mark, no emoji. Completion is acknowledged as a quiet fact, exactly as the family side does with «اكتملت جرعات اليوم». The no-gamification law applies to the worker shell in full.

**States to draw:**
| State | What the designer draws |
|---|---|
| default | Both variants above, both directions, both themes — eight artboards. |
| empty | This *is* the empty state; the composed frame is the deliverable. |
| loading | n/a — the empty is only known after loading resolves. Draw the C1-6 skeleton instead. |
| error | n/a — an error is a different frame (C1-6's error card). An empty must never be reachable from a failed load; that confusion is the classic bug and the frames must make the two visually unmistakable. |
| validation error | n/a. |
| read-only / permission-denied | n/a. |
| confirm sheet | n/a — except the shift-end confirm, which remains reachable from block 2. |

**Reuse these existing components:** `EmptyState` (`src/components/states.tsx:52`, with `iconName="success"`) · `Surface` · `GlyphChip` (circle shape, `success` tone — as rendered inside `EmptyState`) · `FigmaScreen` with the worker band · `Icon` (existing registry name `success`).
**NOT reusable:** the worker shift control and bottom bar are the **new** components defined in C1-6, not existing exports.
**GENUINELY NEW — no component exists:** none for the card itself — `EmptyState` covers it exactly. The **composition** (band + shift control + empty + bar) is new, and that composition is what must be drawn.
**RTL / LTR notes:** `EmptyState` is centered and therefore direction-neutral, but the band's LTR date and the shift control's LTR time still flip position between the two artboard sets. Draw both.
**Copy notes:**

| Key | ar | en |
|---|---|---|
| `caregiver.worker.emptyTitle` | لا شيء مجدول اليوم | Nothing scheduled today |
| `caregiver.worker.emptySubtitle` | يمكن تسجيل المناوبة من الأعلى. | The shift can still be recorded above. |
| `caregiver.worker.allDoneTitle` | اكتمل كل شيء لليوم | Everything for today is done |
| `caregiver.worker.allDoneSubtitle` | لا مهام متبقّية. | Nothing left for today. |

---

### Cross-cutting notes the designer must carry across all ten frames

**The complete "no component exists" list for C1**, consolidated so nothing is missed:

| Job | Status | Where it bites in C1 |
|---|---|---|
| Image / thumbnail / photo | **NONE.** Zero `<Image>` in any feature; `expo-image` only in an unused splash leftover. | C1-4a, C1-7 — the largest new surface in the section |
| Photo avatar | **NONE.** Letter avatar only (`GlyphChip glyph` + `shape="circle"`, `FigmaListRow avatarText`, `initialFor()`). No image-backed avatar, no fallback chain, no presence badge. | C1-2, C1-3, C1-9 |
| Camera / capture UI | **NONE.** No `expo-camera`; A5 installs `expo-image-picker`, so capture is the OS sheet. **And no camera glyph** — the 52-entry registry has none and `Camera` is not in the in-use lucide set; a new `camera` → ionicons `camera-outline` entry is required. | C1-4a empty, C1-7 |
| Full-screen image viewer / lightbox | **NONE.** Its chrome is specified in C1-4a block 2 (scrim + contained image + one `close` square); it is not `FigmaBottomSheet` / `FormModal` / `PickerSheet`. | C1-4a |
| Language picker | **NONE.** `i18n.changeLanguage` = 0 occurrences repo-wide. | C1-5, C1-9 |
| Search field | **NONE.** One bare unstyled `TextInput` inside `TimezonePicker`. Decided: the language list has none. | C1-5 |
| Progress bar | **NONE.** `SkeletonList` only borrows `accessibilityRole="progressbar"`. `DoseBeadStrip` is discrete beads. | C1-7 upload state (decided: inline alert line + dimmed thumbnail) |
| Toast / snackbar | **NONE.** Feedback is an inline `accessibilityRole="alert"` line or a bottom-anchored sheet. | C1-5, C1-7, C1-8 |
| Chart / sparkline | **NONE**, deliberately. Do not introduce one. | C1-3 |
| Stepper (+/−) | **NONE.** Hand-rolled twice already. | C1-3 week selector |
| Calendar month / week / range view | **NONE.** `DateField` is a 3-column scroll wheel. | C1-3 |
| Duration / elapsed display | **NONE.** | C1-3, C1-4b, C1-8 |
| Filter / scope pill | **NO shared component** — inline only at `figma-tasks.tsx:243-268`. | C1-6 (deliberately omitted from the worker shell) |
| Badge / count primitive | **NONE.** The «أنت» badge and the gold notification badge are both local styles. Decided: the caregiver chip borrows the «أنت» style, never the gold one. | C1-2 |
| Divider primitive | **NONE.** Every screen writes its own 2px rule. | all group cards |
| Tooltip / popover, accordion / expander | **NONE.** | none needed — do not invent one |
| Attachment row, document card, PDF preview | **NONE.** | out of C1 scope; flagged so nothing is assumed |
| Pull-to-refresh | **Not wired anywhere.** `Screen` accepts `refreshControl`; no screen passes one; `FigmaScreen` has no such prop. Decided: none in the worker shell. | C1-6 |
| Multi-select / checkbox row | Only `WeekdaySelector`. | none needed |
| 4th app tab | `FigmaTabBar`'s `TAB_META` is a closed 3-entry map returning `null` for unknown routes; 3 short labels are already flagged for 200%-font-scale QA. | C1-3 entry (use an Explore row, not a tab) and C1-6 (the worker bar is new) |

**Icon-slot rule that governs every frame above.** `GlyphChip`, `FigmaListRow`, `EmptyState`, `StatusBadge` and `Button` all take `iconName?: IconName` — a **semantic name from `src/constants/icons.ts`**, never a lucide component. The registry has 52 entries and 19 are currently unreferenced; an unreferenced entry is still an **existing** entry and needs no migration. Where a frame above specifies a lucide glyph (`Check`, `X`, `Share2`, `HandHelping`, `ChevronLeft`/`ChevronRight`), the element carrying it is explicitly **hand-composed** and is not one of those five components. The only genuinely new registry entry C1 requires is **`camera` → ionicons `camera-outline`**.

**Two implementation laws the designer's annotations must not violate:**
1. **Never a function-form `Pressable` style.** Under this project's NativeWind setup, `style={({ pressed }) => …}` is silently dropped on Android and the control collapses to borderless text. Press feedback comes from `android_ripple`, never a `pressed` callback. Every new worker button and row in this section must be annotated accordingly.
2. **One token system.** `src/constants/theme.ts` is the only source of colour, type, spacing, radius, border width, and touch target. Radii are 8 / 6 / 4 / 999 / 16 and nothing else. Borders are 2px, or 1.5px on small status pills and tiny badges. `CardShadow` is a deliberate no-op — flat elevation everywhere, depth from the border. Do not derive a new colour, invent a radius, or re-pair a text-on-fill combination; the palette is AA-verified in both themes at the fixed pairings (`primary`+`onPrimary` · `band`+`bandInk` · `goldFill`+`goldInk` · a `dangerSolid` fill → `onError` text · each tint fill with its matching Fg or `text`). Gold (`goldFill`/`goldInk`, and the `accentBg`/`accentSolid`/`accentFg` aliases — including `GlyphChip tone="accent"`) appears **only** on an available-to-claim surface or a one-time/irreversible warning. In C1 that is exactly one place: C1-1's `invitations.warning` disclaimer.


---
