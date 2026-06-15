# Sanad Mobile — Figma Design Brief (Master)

> Part of the **Sanad Mobile Figma handoff package**. This is the master brief: the product, the people, the principles, the mobile frame rules, the information architecture, the home direction, the full visual system, and the language/copy rules. It is written so a human product designer **and** Figma AI can both work from it directly.
>
> **Sibling docs (cross-referenced throughout, never duplicated):**
> - `sanad-mobile-screen-inventory.md` — every screen (full per-screen template), the interaction inventory, the Figma frame set, and data states.
> - `sanad-mobile-component-inventory.md` — every component (purpose, props/variants, Figma variants, accessibility) and the design-system primitives.
> - `sanad-mobile-figma-ai-master-prompt.md` — one standalone paste-ready prompt for Figma / Figma Make / Figma AI.
> - `sanad-mobile-design-acceptance-criteria.md` — how future engineering safely implements the approved Figma design.
>
> **Source of truth for tokens:** `src/constants/theme.ts`. Every value in §8 mirrors it exactly. If a value here ever disagrees with that file, the file wins — and this brief should be corrected.

---

## 1. Product overview

**Sanad** (سند — "support") is an **Arabic-first, RTL mobile app for family care coordination for older adults**. Its single core promise:

> **"Know what your parent needs today, and know whether it got done."**

Sanad is built for two people at once: the **stressed, mostly-untrained family caregiver** (usually an adult child) coordinating care for an elderly parent who is **aging in place at home**, and the **older adult** themselves (reduced vision, reduced dexterity, lower tech confidence). It is not a clinical tool, not an EMR, and not a telehealth product. It is the calm shared place where a family keeps one another honest about care.

The product earns its keep on a handful of jobs, in priority order:

1. **The medication daily loop and its VISIBLE closure.** Each scheduled dose for today can be marked **given / postponed / missed** (أُعطيت / مؤجَّلة / لم تُعطَ). The whole point is the family can glance and *know the loop is closed* — this is the heartbeat of the app and the source of the signature **Today Care Ring** (§7).
2. **One shared truth for the family care circle.** Everyone in a circle sees the same medications, tasks, appointments, visits, logs, vitals, doctors and emergency info — no "did you call the doctor?" guessing.
3. **One-tap emergency access and one-tap calling.** A read-only **emergency card** a caregiver can hand to a stranger/first responder, plus one-tap `tel:` calling for doctors and emergency contacts.
4. **Calm restraint over feature breadth.** Sanad has ~13 feature areas; the strategic risk is *too many concepts at once*. The home must be **Today-first** and feature navigation must be **demoted**.

**Caregiver-stress context.** The primary user is tired, often mid-task (in a pharmacy, in a waiting room, between work calls), frequently on a phone one-handed. They are not "engaged users" — they are people under load who need an answer in two seconds and then to leave. Every screen is designed to reduce, not add, cognitive load.

**Older-adult accessibility is the product, not a feature.** Large touch targets, large readable type, strong contrast, status that is never color-only, visible text labels over bare icons, confirm-and-undo on anything destructive, an always-obvious way home. (Full rules in §9.)

**Calm trust.** Sanad handles sensitive health information for someone's parent. It must feel trustworthy, warm and unhurried — restraint *is* the trust signal. It never shouts, never gamifies, never decorates for its own sake.

**Emergency always reachable.** From the home surface, emergency access is one tap away and visually distinct — but it is a calm affordance, never a panic-red wall.

**Arabic-RTL-first.** Arabic is the source language and the default layout direction. English is a faithful mirror, not the origin. RTL, bidi isolation of LTR runs, and Western digits are baked in (§9, §10).

---

## 2. Target users

### 2.1 Primary — the stressed family caregiver

Typically an **adult son or daughter** (30s–50s), often juggling their own job and family while coordinating a parent's care, sometimes alongside siblings and a hired caregiver.

- **Goals:** Make sure today's medications happened. See what's due (tasks, appointments, visits). Keep siblings/caregivers on the same page. Reach a doctor or emergency contact fast. Keep the parent's critical info in one place for emergencies.
- **Context:** On a phone, one-handed, interrupted, often in a hurry or under stress. Frequently checking *between* other tasks ("did Mum get her evening pills?"). May be the only "tech person" in the family setting it up for less-confident relatives.
- **Constraints:** Limited time and patience. Not medically trained — must never be asked to interpret clinical data. Anxious about getting care wrong, so blame-y or alarmist UI backfires.
- **What makes them abandon a care app:** It feels like *more work* (data entry with no payoff); it's cluttered and they can't find the one thing they need; it nags or guilt-trips; it looks cheap/untrustworthy with sensitive data; it pretends to give medical advice and they stop trusting it; it's confusing in Arabic (broken RTL, mixed-up numbers, mojibake).

### 2.2 Secondary — the older adult (care recipient / elder member)

The parent being cared for may also open the app (e.g. to see their own day, or as a `remote_member`/elder role).

- **Goals:** Understand what's happening today without help. Feel supported, not surveilled or judged.
- **Context:** Reduced vision and dexterity; lower tech confidence; smaller effective reach and slower, less precise taps. Reads Arabic comfortably; struggles with tiny text and dense screens.
- **Constraints:** Needs large targets, large type, high contrast, simple flows, generous spacing, and plain calm language. Mis-taps must be forgiving (confirm + undo).
- **What makes them abandon:** Anything small, dense, fast-moving, or that makes them feel watched/judged about their health.

**Design implication:** the *intersection* of these two users — calm, large, legible, Arabic-native, forgiving, never clinical — is the design target. When in doubt, optimise for the more constrained user.

---

## 3. UX principles

A strict priority order resolves every trade-off. When two pulls conflict, the earlier one wins:

> **Clarity → Calm → Trust → Accessibility.**

1. **Clarity first.** The user should know, instantly, *what matters now* and *whether it got done*. One glance answers the core promise. Ambiguity is the enemy.
2. **Calm second.** No clutter, no noise, no urgency theatre. Generous whitespace, few elements per screen, soft warm surfaces. The premium feeling comes from what we leave out.
3. **Trust third.** Honest copy, no fake data, no overpromising, sensible defaults, visible safety boundaries. It must feel like software a family can rely on with a parent's wellbeing.
4. **Accessibility fourth — but non-negotiable as a floor.** It ranks below clarity/calm/trust only in tie-breaks; it is never *sacrificed*. Large targets, large type, strong contrast, never-color-only status.

Operating principles that flow from the above:

- **One job per element.** A card, button, row or tile does exactly one thing. If a tile means two things, split it or cut one.
- **Hierarchy by size / weight / whitespace — not by boxes.** Importance is shown by scale, weight and breathing room, **not** by wrapping everything in another bordered rectangle. A page of equal-weight boxes has no hierarchy. (This is the specific failure mode of the rejected home — §4.)
- **Accent = meaning.** The warm **sand** accent means **"today / now / attention."** It is never decoration. If sand appears, it is pointing at something that matters today.
- **Restraint is the premium signal.** Fewer, more confident elements read as higher quality than many small ones. Whitespace is a feature, not wasted space.
- **Consistency is the brand.** Sanad's identity is the *system* — one type family, one blue, one accent, one card language, one icon set — applied with discipline. Repetition of the system, not novelty, is what makes it feel designed.
- **Today-first.** The home leads with today and demotes feature navigation. Browsing all 13 areas is a secondary, quiet affordance, never the first thing the eye lands on.

---

## 4. Design goal for Figma

The approved design **must feel:**

- **Premium** — confident, considered, high-quality; the restraint reads as expensive.
- **Warm** — porcelain/graphite surfaces and a sand accent; human, never sterile.
- **Calm** — uncrowded, unhurried, one clear focus per screen.
- **Modern-mobile** — a native Android app home, designed for the thumb. **NOT a web dashboard / admin panel.**
- **Arabic-native** — RTL by design, not a flipped LTR layout; Arabic typography breathes.
- **Trustworthy** — honest, safe, sensible; safe with a parent's health data.
- **Older-adult accessible** — large, legible, forgiving, high-contrast.

It must **NOT** be:

- **Clinical / cold** — no hospital-EMR aesthetic, no medical alarm colors, no charts that imply diagnosis.
- **Childish** — no cartoon mascots, no playful gamification, no confetti.
- **Generic AI-template** — no "SaaS card-grid" look, no rows of identical rounded rectangles.
- **A long list of rectangles** — no stacked-report feel.

### 4.1 The NEGATIVE example (explicitly: what NOT to ship)

There is a **current, uncommitted Today-first home that the product owner has REJECTED.** Treat it as the canonical anti-pattern. Its concrete faults — to design *against* — were:

- **Too list-like** — reads as a long stack of stacked rectangles, like a report, not a modern app home.
- **Too crowded** — a Today hero, then a 2×2 quick-tile grid, then a 6-tile "All care sections" grid, then a 4-tile "Care team" grid = **four stacked grids of near-identical generic blocks** under one hero (~15 tap targets on a single scroll).
- **Weak hierarchy** — every tile used the same `DashboardTile` (icon chip + chevron + title + meta, ~48% width, 116dp tall), so **nothing leads**; the eye gets no anchor after the hero.
- **Generic / templated** — an "AI SaaS card grid" feel; not premium, not warm, not distinctly Sanad.
- **Redundant** — medications, tasks and appointments each appeared **twice** (as a Today tile *and* a care-section tile), navigating to the same route.
- **Report-style metadata** — tiles emitted bullet-count strings ("Today's doses: 5 • Given: 2 • Remaining: 3") that stack into a dashboard-report aesthetic at odds with a calm Arabic home.
- **Emergency demoted to a peer tile** — a safety-critical action sat as one more 48%-wide tile in a grid.

**The new home must instead:** present **one clear hero**, give **generous breathing room**, **demote** feature navigation to a small quiet set, keep **emergency one tap away and visually distinct**, and **never** be a wall of identical rectangles. (Full home direction in §7.)

---

## 5. Mobile frame requirements

- **Platform:** **Android-first.** Design and review on Android frames first; iOS is a faithful follow.
- **Primary target device:** **Samsung Galaxy S24 Ultra**, ~6.8", ~1440 × 3120 px, 19.5:9. Design the canonical frames here.
- **Responsive down to smaller Android phones** — layouts must not break or crowd on a ~360–390dp-wide phone. The hero stays single-column; 2-column tiles reflow gracefully; nothing is clipped (content uses full width minus gutters; text wraps).
- **RTL by default.** Every frame is laid out **right-to-left**. Lead the eye from the right. Directional icons mirror (only `chevron` is directional — it flips). Do not hand-mirror layouts that auto-mirror; design in RTL natively.
- **Dark mode FIRST, then light.** Author the canonical frames in **"Warm graphite" dark**, then produce the **"Warm porcelain" light** variant. Both are full peers — dark is not an afterthought, light is not the only "real" one.
- **Safe areas + chrome.** Respect the Android status bar / notch top inset and the bottom navigation bar. Account for the **bottom tab bar** (Home / Explore / Account). Tab screens have **no native header**, so their content must clear the top safe-area inset itself; pushed detail screens sit under a native themed header.
- **One-handed thumb reach.** Primary actions live **low, within the thumb arc** — the natural bottom third of a large phone. The top of a 6.8" screen is out of easy reach; don't put the day's main action up there. Destructive actions stay out of the sticky footer.
- **Minimums (older-adult floors — enforce on every frame):**
  - **Touch targets:** ≥ **48dp**; comfortable **52dp**; **primary actions ≥ 56dp**; spaced **≥ 8dp** apart.
  - **Body text:** ≥ **17sp** wherever possible (raise the historical 16 floor to **17**); **never below 14sp**.
  - **Contrast:** ≥ **4.5:1** for text, ≥ **3:1** for large text/UI; status is **icon + text + color**, never color alone.
  - **Max content width** 720dp (browsing/lists), **max form width** 480dp — caps for tablet/web; on a phone, content is full width minus the **20dp gutter** (review suggests 24dp; recommend 24).

---

## 6. Information architecture (summary)

Sanad is an authenticated app behind sign-in, organized around a **care circle** (the family group caring for one recipient). Full per-screen detail lives in **`sanad-mobile-screen-inventory.md`**; this is the orienting map only.

**Top-level shell:**

- **Auth stack** — Sign in, Sign up.
- **Circle gate / onboarding** — if the user belongs to no circle, the home shows a **create-circle onboarding** (name the circle + the care recipient) or **join with an invitation code**. A splash/loading state covers font/session resolution.
- **Authenticated app** with a **bottom tab bar:** **Home**, **Explore** (a "coming soon" placeholder), **Account**.
- **Pushed detail stacks** over the tabs: medications, tasks, appointments, visits, daily-logs, vitals (each `index / new / [id]`); doctors; emergency-card; emergency-contacts; recipient-profile; notifications; notification-settings; circle-members (`index / invite / invitations`); join-circle.

That is **~33 route screens** (excluding layout files), plus the onboarding-gate and splash states.

**The Today-first hierarchy (the home's job):**

1. **Today** — the medication dose loop (the **Today Care Ring**), the single most relevant **next action**, and a light read of what else is due today.
2. **Emergency** — always one tap away, visually distinct.
3. **Everything else** — the ~13 feature areas and the care team — reachable but **demoted** into a small, quiet, secondary set. Browsing is never the first thing the eye meets.

This ordering is the whole point of the redesign: lead with *today and whether it got done*, then make the rest available without competing for attention.

---

## 7. Home design direction

Request **2–3 premium alternatives**, then recommend **one**. All options share the same non-negotiables (below). Lean toward **Option 1 or 2** for the calmest hierarchy.

### Option 1 — Today-first hero (RECOMMENDED)
A **care-recipient context card** (who today is about) → the signature **Today Care Ring** (the dose loop) → a **single strong "next action" card** (the most relevant thing to do now). Below that, a **small, quiet set** of secondary features. One unmistakable focal point; everything else recedes.

### Option 2 — Calm timeline / daily schedule
One strong **"now" card** anchored on a vertical **day timeline** (a calm agenda of today's doses/tasks/appointments in time order), with compact secondary tiles beneath. Reads like a serene daily plan.

### Option 3 — Family care command center
A top **daily status**, the **next action**, a **family handoff strip** ("who is on duty"), and a **compact feature grid**. Richest of the three — only choose if the family-coordination story must lead; higher crowding risk, so keep it disciplined.

### Recommendation & rationale
**Adopt Option 1 (Today-first hero), optionally borrowing Option 2's time-ordering for the "what else is due today" read.** Rationale:

- It produces the **single clear hero** the rejected design lacked, and the **strongest size/weight hierarchy** (ring + one next-action, not a grid of equals).
- It maps directly onto the core promise — *what's needed today, and whether it got done* — with the **Today Care Ring** as the answer-at-a-glance.
- It is the calmest and least crowded; it makes **demoting feature navigation** natural rather than forced.
- It best fits one-handed older-adult use: one focal action, large, low on the screen.

### Home must-haves (apply to whichever option is chosen)
- **Today-first**; feature navigation **demoted** to a small quiet set.
- **Emergency one tap away** and visually **distinct** (not a peer tile in a routine grid).
- **No long stacked list of rectangles; not crowded;** generous breathing room.
- **2-column tiles only where they genuinely help;** a **single-column hero** wherever readability needs it.
- **No fake medical status**, no health color-coding, no over-decoration.
- **No redundant duplication** — a feature appears in *one* place on the home, not twice.

### The signature element — the **Today Care Ring**
Sanad's one distinctive, ownable motif. It visualizes **today's medication dose loop** as **given-of-total** — a calm, worded progress indicator, **never color-only**, and it **never implies a health judgment** (it reflects *recorded dose completion*, a task loop — not whether the person is well). It is built from plain shapes + tokens + the icon set (no SVG/animation needed) and has four states:

| State | Condition | Ring treatment | Inside the ring | Worded caption (example) |
|---|---|---|---|---|
| **Loading** | data loading | neutral border on sunken | medication icon | "جارٍ تحميل جرعات اليوم…" |
| **Empty** | no doses scheduled today | neutral border on sunken | medication icon | "لا جرعات مجدولة اليوم" |
| **Progress** | some given, some left | **sand** accent ring | the count "given/total" | "{{given}} من {{total}} جرعة اليوم" |
| **Complete** | all of today's doses given | **success** ring | success check icon | "اكتملت جرعات اليوم" |

A short **segment strip** (one segment per dose, ≤8; proportional above 8) reinforces progress for sighted users. The ring + strip are **decorative for assistive tech** (`accessibilityElementsHidden`); the surrounding card carries the spoken label ("Today's care loop: {{given}} of {{total}} doses given"). The caption **always states the meaning in words**, so the ring never relies on color alone. Component-level specs live in **`sanad-mobile-component-inventory.md`**.

---

## 8. Visual style system

**Direction: "Warm Care OS"** — warm porcelain/graphite surfaces (never flat white / pure black), **one** confident brand blue, a **sand** accent that means *today/now/attention*, and restraint as the premium signal. Identity comes from **typography + warm neutrals + disciplined accent use**, not from gradients, heavy shadows or decoration. Component-level detail (props, variants, Figma variants) is in **`sanad-mobile-component-inventory.md`**; the values below are the design-token foundation.

### 8.1 Color — Light ("Warm porcelain")

| Role | Token | Hex |
|---|---|---|
| Text | `text` | `#1D1B16` |
| Text secondary | `textSecondary` | `#5C594F` |
| Text muted (metadata only) | `textMuted` | `#767266` |
| App background | `background` | `#F6F4EF` |
| Card / element | `backgroundElement` | `#FFFFFF` |
| Selected surface | `backgroundSelected` | `#ECE9E1` |
| Sunken well (inside cards) | `backgroundSunken` | `#F3F1EB` |
| Border (hairline) | `border` | `#E2DFD6` |
| Divider (row separator) | `divider` | `#ECE9E2` |
| Brand primary | `primary` | `#1B5FBE` |
| Primary pressed | `primaryPressed` | `#164E9D` |
| On primary | `onPrimary` | `#FFFFFF` |
| Primary tint surface | `primaryBg` | `#E8EFFA` |
| Brand text on canvas | `primaryText` | `#17549F` |
| Accent foreground (sand) | `accentFg` | `#8A5A17` |
| Accent tint surface | `accentBg` | `#F5EBD8` |
| Accent solid (today/now fill) | `accentSolid` | `#B97A1E` |
| Accent text/eyebrow | `accentText` | `#7A4E12` |
| On accent | `onAccent` | `#FFFFFF` |
| Success fg / bg | `successFg` / `successBg` | `#1A7A43` / `#E3F2E7` |
| Warning fg / bg | `warningFg` / `warningBg` | `#9A5B00` / `#F8EDD8` |
| Error fg / bg | `errorFg` / `errorBg` | `#BE2E2E` / `#FAE7E4` |
| Info fg / bg | `infoFg` / `infoBg` | `#17549F` / `#E8EFFA` |
| Danger solid (destructive fill; bell-badge red) | `dangerSolid` | `#D92D20` |
| Modal scrim | `overlay` | `rgba(29,27,22,0.45)` |

### 8.2 Color — Dark ("Warm graphite", a full peer — NOT pure black)

| Role | Token | Hex |
|---|---|---|
| Text | `text` | `#F4F2EC` |
| Text secondary | `textSecondary` | `#ACA89D` |
| Text muted | `textMuted` | `#8B877C` |
| App background | `background` | `#151412` |
| Card / element | `backgroundElement` | `#201F1B` |
| Selected surface | `backgroundSelected` | `#2C2A25` |
| Sunken well | `backgroundSunken` | `#1B1A17` |
| Border (hairline) | `border` | `#353329` |
| Divider | `divider` | `#272520` |
| Brand primary | `primary` | `#2F6FD0` |
| Primary pressed | `primaryPressed` | `#275FB4` |
| Primary tint surface | `primaryBg` | `#1D2B42` |
| Brand text | `primaryText` | `#96BEF5` |
| Accent foreground (sand) | `accentFg` | `#DDAF63` |
| Accent tint surface | `accentBg` | `#352A17` |
| Accent solid | `accentSolid` | `#C8923C` |
| Accent text | `accentText` | `#E2B872` |
| On accent | `onAccent` | `#1A1408` |
| Success fg / bg | `successFg` / `successBg` | `#4DC07D` / `#152F20` |
| Warning fg / bg | `warningFg` / `warningBg` | `#E2A23E` / `#332813` |
| Error fg / bg | `errorFg` / `errorBg` | `#EF6F6B` / `#3A1D1B` |
| Info fg / bg | `infoFg` / `infoBg` | `#96BEF5` / `#1D2B42` |
| Danger solid | `dangerSolid` | `#E5564D` |
| Second surface lift | `backgroundRaised` | `#26241F` |
| Modal scrim | `overlay` | `rgba(0,0,0,0.55)` |

**Color usage rules:**
- **Blue is the one brand color.** Use `primary` for the main action, `primaryBg`/`primaryText` for tinted chips/links/info.
- **Sand is reserved for "today / now / attention"** — the care ring in progress, today's anchor chips, "today" eyebrows. Never decorative, never a second brand color.
- **Semantic colors carry status, never health judgment.** Success/warning/error tones describe *recorded states* (dose given/postponed/missed, task done/cancelled) — **never** whether a vital is "good/bad."
- **Status is always icon + text + color** — never any one alone.

### 8.3 Typography

**One family: IBM Plex Sans Arabic** (Regular / Medium / SemiBold / Bold) carries **both Arabic and Latin**, so mixed content (medication names, emails, times) stays harmonious.

| Token | Size / line-height / weight | Use |
|---|---|---|
| `display` | 34 / 46 / 700 | reserved hero numerics |
| `title` | 30 / 42 / 700 | screen heading |
| `subtitle` | 22 / 32 / 700 | major sub-heading |
| `sectionTitle` | 19 / 30 / 700 | section header |
| `cardTitle` | 17 / 27 / 600 | card/row title |
| `body` (default) | 16 / 26 / 400 | body text — **raise floor to 17 (see below)** |
| `link` | 15 / 28 / 500 | inline link |
| `small` | 14 / 22 / 400 | metadata, captions |
| `smallBold` | 14 / 22 / 600 | emphasised metadata/labels |
| `eyebrow` | 13 / 18 / 600, +0.5 letter-spacing | overline — **LATIN ONLY** |
| `code` | 13 mono | codes/ids |

- **Body floor → 17sp.** The review recommends raising base body from 16 → **17**; **recommend the 17 floor in Figma** for older-adult readability. Never go below **14sp**.
- **Never apply letter-spacing to Arabic** — it breaks Arabic letter-joining. The `eyebrow` overline (with +0.5 tracking) is **Latin-only**; use a normal SemiBold label for Arabic eyebrows.
- Line-heights are generous (~1.5×) for Arabic comfort.

### 8.4 Icons

- One centralized **`<Icon>`** component; icons are referenced **by meaning, never by a raw glyph.** Default family **Ionicons**; **MaterialCommunityIcons** only for `medication` (pill), `doctor`, and `vital` (heart-pulse).
- **Semantic names:** `chevron` (the ONLY directional icon — mirrors in RTL), `add`, `close`, `dot`, `success`, `warning`, `error`, `info`, `clock`, `calendar`, `medication`, `task`, `appointment`, `visit`, `dailyLog`, `vital`, `doctor`, `emergency`, `member`, `profile`, `notification`, `settings`, `system`, `call`.
- **Sizes (dp):** sm 16, md 20, lg 28, xl 40 (xl reserved for the home hero).
- **Never use raw Unicode symbol literals as iconography** (that was the historical mojibake bug). Icons are decorative-by-default for assistive tech unless given a label.

### 8.5 Surfaces / cards

- **One card language** ("Surface"): warm card fill (`backgroundElement`), hairline `border`, **card radius 20**, comfortable interior padding. Optionally pressable.
- **Light mode** separates a card from canvas with a **whisper-soft shadow** (see §8.8) plus the warm fill.
- **Dark mode** separates surfaces by **lifted background + hairline border — never shadow** (shadows smear on dark). A second lift uses `backgroundRaised`.
- Tones: `card`, `sunken` (recessed wells inside cards), `selected`, plus tinted `primary / accent / success / warning / error / info` for status surfaces.

### 8.6 Grid & spacing

**4-pt scale:** half 2, one 4, two 8, three 16, four 24, five 32, **section 40**, six 64.
- **Phone gutter 20** (review suggests **24** — recommend 24).
- Between-card rhythm ~16 (`three`); between-section rhythm ~24–40 (`four`–`section`).
- **Max content width 720**, **max form width 480** (tablet/web caps).
- 2-column tiles use ~48% width with a comfortable gap, and only where they genuinely help.

### 8.7 Radius

sm 8 · md 12 · lg 16 · **card 20** (standard panel) · xl 24 · **pill 999** (chips/badges/buttons-as-pills where used). Keep radii consistent — card 20 is the house panel radius.

### 8.8 Shadows / elevation (LIGHT-ONLY)

- **Light:** one whisper-soft card shadow — `0 2 10 rgba(40,36,26,0.06)`, **opacity ≤ 0.07**. Depth should be *felt, not seen*.
- **Dark:** **no shadows.** Separate surfaces by lifted background + hairline border only.

### 8.9 Status colors (the never-color-only rule)

Every status is **icon + text + color**:
- **success** (e.g. dose given, task completed) → success tone + success/check icon + label.
- **warning** (e.g. postponed) → warning tone + clock icon + label.
- **error** (e.g. missed, cancelled) → error tone + cross icon + label.
- **info** (e.g. scheduled, planned, neutral) → info tone + info/dot icon + label.
- **neutral** → muted tone + dot + label.

These describe **recorded states**, never health judgments.

### 8.10 Buttons

- **Primary** — confident brand-blue fill, `onPrimary` text; the main action; height ≥ **56dp** for primary.
- **Secondary** — quiet outlined/tinted button for supporting actions.
- **Danger** — soft error-tinted fill + strong error text; **deliberately distinct from primary/save**; destructive actions only, and isolated from save areas. Destructive actions use a **two-step inline confirm** (not a system alert) and live away from the sticky save footer.
- **Plain** — minimal text button.
- All buttons: visible **text label** (icon-only is reserved for genuinely secondary affordances and always carries an accessibility label), `loading` shows a spinner and disables, touch-target floor enforced.

### 8.11 Form fields

- Labeled themed input, **focus ring = brand 2dp border**, error border `errorFg`, inline error text below (role alert + live region).
- **No hardcoded text-align** — direction follows RTL automatically; Arabic aligns to start (right).
- Min height = comfortable touch target (52dp); multiline grows.
- **Pickers, not typing,** for dates/times (wheel sheets): dates `YYYY-MM-DD`, times 24-hour `HH:MM`.

### 8.12 Chips / badges

- **OptionSelect chips** (single-choice segmented): selected = brand tint + brand border + **leading check icon + bold** (never color alone); ≥ 48dp; wrap; RTL-safe.
- **StatusBadge** (pill): tinted bg + tone icon + always-present text label.
- **GlyphChip** (identity anchor): soft tinted circle holding an icon or a letterform avatar.
- **Today anchor chip** (date/time): bold LTR-isolated time on an accent background — the scannable anchor of a row/timeline.

### 8.13 Bottom tab bar

- Three tabs: **Home / Explore / Account** (RTL order). Active tab = **brand-tinted pill** behind the icon + brand-colored label; inactive = secondary text tint.
- Background = app `background`; respects the Android nav bar.
- **Known gap to fix in design:** the **Account** tab currently reuses the Home icon as a placeholder — design a dedicated Account/profile tab icon.

### 8.14 Notification badge

- A **labeled notification pill** (deliberately not an icon-only bell — clearer for older users), with the unread count inside.
- Badge fill is a **fixed saturated red `#D92D20`** with white text (an intentional non-token constant so the count stays high-contrast in both themes); shows `99+` above 99. The label switches by count for screen readers ("Open notifications" vs "Open notifications, {{count}} unread").

### 8.15 Calendar / time chips

- Dates render `YYYY-MM-DD`; human dates via long format (e.g. "الأحد، 15 يونيو") with **Western digits**.
- Times render 24-hour `HH:MM`, **no AM/PM**, **LTR-isolated** so they don't reorder inside Arabic. A "when" chip (bold, LTR, on accent) is the scannable anchor for tasks/appointments/visits/timeline rows.

### 8.16 The care-loop signature element

See §7 — the **Today Care Ring** is the one ownable motif. Reserve `accentSolid` (sand) for its *progress* state and `successFg` for *complete*; never color it by health. Component spec in **`sanad-mobile-component-inventory.md`**.

---

## 9. Cross-cutting rules

### 9.1 Arabic RTL rules
- **Arabic-first, RTL by default** on every frame; design natively RTL, don't flip an LTR comp.
- **Mirror directional icons** — only `chevron` is directional (it flips to point "back" in RTL). All other icons are non-directional.
- **Isolate LTR runs** with bidi isolation (LRI…PDI): phone numbers, times, dose strengths ("500 mg"), emails, English drug names, invitation codes, IANA timezones, IDs. **Never force a whole container LTR** — isolate the run only.
- **Western Arabic digits (0–9)** consistently for times, doses, phones, dates, counts and codes. (The lone exception in current copy — an Eastern-Arabic ٦ in the auth password hint — is an inconsistency to standardize to Latin.)
- Use **logical layout** (row + gap, symmetric padding) so mirroring is automatic; no hardcoded left/right.

### 9.2 Accessibility rules
- **Touch targets ≥ 48dp** (primary ≥ 56dp), **≥ 8dp apart**.
- **Body text ≥ 17sp where possible; never below 14sp.**
- **Contrast ≥ 4.5:1** (≥ 3:1 large).
- **Status = icon + text + color** — never color-only, never glyph-only.
- **Visible text labels** preferred over icon-only controls; any icon-only control carries an accessibility label.
- **Confirm + undo destructive actions** (two-step inline confirm; reversible where possible).
- **Always a clear way back / home;** anchor deep links so back returns to Home.
- **TalkBack labels + sane RTL focus order;** decorative shapes hidden from assistive tech; errors use alert + polite live region; **respect reduced motion** (the signature ring uses no animation by design).

### 9.3 Medical-safety boundaries
Sanad **organizes and reminds; it does NOT give medical judgment.**
- **Never diagnose, interpret, or label** anything normal / abnormal / good / bad / healthy.
- **Never color-code vitals or doses by health.** Vitals = **value + unit + optional neutral trend only** (and the app explicitly does not interpret values).
- **Dose status is neutral and factual** — given / postponed / **missed** ("لم تُعطَ" = "was not given," not "you failed").
- **Never claim guaranteed emergency response or guaranteed notification delivery;** never imply Sanad replaces a doctor, pharmacist, or emergency service.
- Each health surface carries a calm **"family-entered, for organizing/tracking only, not medical advice"** disclaimer (see §10).
- **Notifications honesty:** local reminders are **not** guaranteed delivery; clearly distinguish a *test* notification from a *real* reminder from *remote push*. Conservative defaults + Quiet Hours; human toggles; push-token/channel mechanics hidden behind "Advanced"; preserve explicit opt-in and channel-before-permission on Android. Quiet-hours copy must stay honest ("normal reminders are delivered after quiet hours end; emergency alerts may still arrive").

---

## 10. Copy & language

**Principles:**
- **Arabic-first** — Arabic is the source; English is a faithful mirror. Both are key-for-key identical in structure.
- **Calm and plain** — short, warm, non-alarmist, non-blaming. Address the caregiver as a trusted partner, not a patient or a child.
- **No medical judgment** — never "normal/abnormal/high/low/danger" for vitals; describe states, not diagnoses.
- **No developer terms** — no tokens, channels, push IDs, enums, or raw error codes surfaced to users; phrase config/build problems in human language.
- **No notification guarantees** — reminders are best-effort; tests are local-only; never promise delivery or response.
- **Visible labels** — every status/control has a text label, not just an icon or color.
- **Western digits** for times/doses/phones/dates/counts; **isolate LTR runs** (times, phones, "500 mg", emails, English drug names, codes).
- **Honest, specific disclaimers** on every health surface (above) — vitals carries the strongest ("…and the app does not interpret the values").

**Sample copy (real, from the codebase — Arabic is the source):**

| Context | Arabic | English |
|---|---|---|
| App name | سند | Sanad |
| Core greeting (home) | أهلاً بك في سند | Welcome to Sanad |
| Today block title | اليوم | Today |
| Care ring (progress) | {{given}} من {{total}} جرعة اليوم | {{given}} of {{total}} doses today |
| Care ring (complete) | اكتملت جرعات اليوم | Today's doses are complete |
| Care ring (none) | لا جرعات مجدولة اليوم | No doses scheduled today |
| Next dose label | الجرعة القادمة | Next dose |
| Dose status — given | أُعطيت | Given |
| Dose status — postponed | مؤجَّلة | Postponed |
| Dose status — missed | لم تُعطَ | Missed |
| Medications disclaimer | يسجّل التطبيق مواعيد الأدوية التي تُدخلها العائلة وتذكيرات بها فقط، ولا يقدّم أي نصيحة طبية. | The app only records the medication schedules and reminders your family enters. It does not provide medical advice. |
| Vitals disclaimer (strongest) | قياسات تُدخلها العائلة للحفظ والمتابعة فقط، وليست تشخيصًا أو نصيحة طبية، ولا يُفسّر التطبيق القيم. | Readings entered by the family for recording and tracking only. They are not a diagnosis or medical advice, and the app does not interpret the values. |
| Emergency card disclaimer | هذه المعلومات مُدخلة من العائلة للعرض فقط، وليست نصيحة أو تشخيصًا طبيًا. | This information is entered by the family for reference only and is not medical advice or diagnosis. |
| Quiet-hours honesty | يمكن أن تمتد ساعات الهدوء بعد منتصف الليل. تُسلّم التذكيرات العادية بعد انتهاء ساعات الهدوء؛ وقد تصل تنبيهات الطوارئ رغم ذلك. | Quiet hours can cross midnight. Normal reminders are delivered after quiet hours end; emergency alerts may still arrive. |
| Push privacy | ترتبط الإشعارات بحسابك على هذا الجهاز فقط. لا نشارك رمز جهازك ولا نُضمّن أي تفاصيل صحية حسّاسة فيها. | Notifications are tied to your account on this device only. We never share your device token or include sensitive health details in them. |
| Invitation security warning | أي شخص يملك هذا الرمز يمكنه الانضمام إلى الدائرة والاطّلاع على معلومات رعاية حسّاسة. شاركه فقط مع من تثق بهم. | Anyone with this code can join the circle and see sensitive care information. Share it only with people you trust. |
| Emergency card title | بطاقة الطوارئ | Emergency card |
| Call action | اتصال | Call |
| Common — retry | إعادة المحاولة | Retry |
| Read-only notice | للعرض فقط — لا تملك صلاحية التعديل | View only — you don't have permission to edit |

For the full copy reference and the complete per-screen string set, see **`sanad-mobile-screen-inventory.md`** (and the project locale files `src/locales/ar.json` / `en.json`).

---

### Document map (handoff package)
- **This file** — master brief (product, users, principles, frames, IA, home direction, visual system, language).
- `sanad-mobile-screen-inventory.md` — every screen, interactions, frame set, data states.
- `sanad-mobile-component-inventory.md` — every component and primitive, with variants + accessibility.
- `sanad-mobile-figma-ai-master-prompt.md` — paste-ready Figma AI prompt.
- `sanad-mobile-design-acceptance-criteria.md` — safe implementation criteria for engineering.
