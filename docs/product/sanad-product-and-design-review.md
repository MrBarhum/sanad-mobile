# Sanad Mobile — Independent Product, UX & Visual Design Review

*Prepared as an external product/design review. No code was run, no backend touched, no secrets requested. This is opinion + market grounding + a design direction you can hand to Claude Code.*

---

## 0. Headline (the honest version)

Sanad is aimed at a real, growing, underserved market, and your instinct that "the Arab world has nothing here" is correct. That is the opportunity. But right now the **biggest risk to Sanad is not missing features — it is having too many.**

The app already has 13+ feature areas (medications, tasks, appointments, visits, daily logs, vitals, doctors, emergency, care circle, members, invitations, notifications, account). For a non-technical Arabic-speaking family caring for an elderly parent under stress, that is a lot of separate concepts to learn. The global research is brutal on this point: **a median of ~70% of health-app users abandon within the first weeks, and the #1 reason caregivers quit these tools is that they are confusing, not that they lack features.** So the strategic move is not "add more." It is "make the first 30 seconds obviously useful, and make the daily loop dead simple."

Three decisions will matter more than anything else:

1. **The dashboard must be "today-first," not "navigation-first."** A grid of 13 feature buttons is the failure mode. The home screen should answer one question: *"What does my dad need right now, and did it get done?"*
2. **The medication loop must close visibly.** The single most-wanted thing in this category is: *the caregiver wants to know whether the dose was actually taken* — and if it wasn't, someone gets nudged. You have `given / postponed / missed` already. The win is surfacing that to the whole family in a feed, plus a missed-dose escalation.
3. **Kill the decorative-glyph approach permanently.** The mojibake bug isn't a one-off encoding accident — it's a symptom of using raw Unicode symbol literals as your icon system. The durable fix is a real vector icon set plus text labels. (Correction: despite earlier wording, `@expo/vector-icons` is **not** bundled by Expo in this repo — install it with `npx expo install @expo/vector-icons`.) Details in §5.

Everything below expands on this.

---

## 1. Market & user research synthesis

### 1.1 The market is real and the timing is good

- Family caregiving is exploding. In the US, the 2025 AARP / National Alliance for Caregiving report counts ~63 million family caregivers (≈1 in 4 adults), up ~20 million since 2015. Only ~11% received any formal training, ~1 in 4 provide 40+ hours/week, and nearly half report financial strain. The takeaway: **most caregivers are untrained, overloaded, and improvising** — which is exactly who needs a simple coordination tool.
- The Gulf angle is even stronger for you. Saudi seniors (60+) are ~1.3M today (~5% of the population) and are projected to exceed 10M by 2050. Vision 2030 explicitly includes elderly-care transformation (the 2023 "Elderly Care Strategy," the 2025 "Jam AI" elderly-health initiative), and there is a structural shortage of trained caregivers (tens of thousands short).
- Culturally, the Arab/Gulf default is **aging in place at home, cared for by family**, reinforced by religious and social norms, with home care being the largest and fastest-growing segment and institutional care carrying stigma. That means the caregiver in this region is almost always a *family member*, not a hired professional. **Sanad is built for exactly that person, in their language.** This is a genuine moat: cultural relevance is one of the documented reasons people abandon Western tools, and you remove that friction by default.

For you specifically: this overlaps your Vision 2030 work. There is a plausible B2G / B2B2C story later (Ministry / health-cluster / charity distribution), but don't let that distort the consumer product now — win the family first.

### 1.2 Who else exists (and the cautionary tale)

The Western category splits into three buckets:

- **Coordination / "care circle"**: Lotsa Helping Hands, Caring Village, ianacare, Carely, CircleOf. Shared calendar, task sign-up, secure messaging, contact lists.
- **Medication-first**: Medisafe, MyTherapy, Dosecast, CareZone. Reminders, dose logging, adherence tracking, refill alerts; MyTherapy wraps vitals/symptoms around the reminder; CareZone scanned labels into refills.
- **Safety / monitoring**: Life360 (location, geofencing, "circles," emergency alerts), medical-alert devices.

The cautionary tale you should internalize: **CareZone was beloved and still died.** Walmart acquired its tech for ~$200M in 2020 and folded it in; the standalone app effectively went away, stranding families who had years of meds and notes in it. Google Health died the same way a decade earlier. The lesson for Sanad isn't "don't build it" — it's **data ownership and continuity are part of the product**. Let families export their data. Don't make the app a black box they can't leave. Trust is the currency here.

### 1.3 What caregivers actually value (synthesis)

Across the reviews and the academic literature, the same handful of things come up again and again:

1. **Loop closure** — "did the dose/visit/task actually happen?" Caregivers repeatedly say the apps fail to tell them whether the person acted on the plan. Closing this loop visibly is the killer feature.
2. **One shared calendar / one shared truth** — everyone sees the same schedule and updates, no phone-tag.
3. **Simplicity for non-tech users** — large text, simple navigation, text labels over icons, minimal steps.
4. **Notification restraint** — overloaded caregivers explicitly ask apps to *stop* over-notifying. More pings = uninstall.
5. **Communication** — a lightweight family message/activity surface so updates live in one place.
6. **Caregiver self/coordination** — handoff between siblings ("who's on duty"), and acknowledgment that the caregiver is a stressed human too.
7. **Reliability & data trust** — it must work, the data must be obviously correct, and it should be cheap or free at the core.

### 1.4 Why people abandon (so we design against it)

Documented abandonment drivers, mapped to a Sanad design rule:

| Abandonment driver (from research) | Sanad design response |
|---|---|
| ~70% quit in the first weeks; sharp early drop-off | Deliver value in the first session: 3-step setup, then an obviously-useful "Today" screen |
| Confusing interfaces / too complex for non-tech users | Today-first home, text labels, fewer top-level concepts, generous targets |
| Notification overload | Conservative defaults, batched/quiet hours on by default, one clear daily digest option |
| Subscription as a barrier | Free, fully-usable core; monetize later via optional/family/premium, never gate the medication loop |
| Limited cultural relevance | Arabic-first, RTL-native, local norms — your built-in advantage |
| Distrust in data accuracy/reliability | Show source/time of every entry, work offline, never silently lose data, allow export |
| No support / can't recover | Clear empty states, undo on destructive actions, plain-language help |

---

## 2. Product & UX review (Deliverable 1)

### Q1 — Is Sanad's product model clear?

Mostly, but two concepts will confuse non-technical Arabic users:

- **"Care circle"** is borrowed from Western apps (Life360 "circles," Lotsa "communities"). The *idea* is right, but the *word* isn't self-explanatory in Arabic. Lead with the relationship, not the abstraction: the user is "taking care of [Dad]," and other people are "family helping with [Dad]." Consider naming the unit after the cared-for person ("دائرة رعاية والدي" / "مجموعة العناية بوالدي") rather than a generic "circle." The mental model should be *a person you care for*, with *people who help* and *things to track* hanging off them.
- **Owner vs. role** is a system concept. Users understand "who can do what" in human terms ("can edit," "can only view," "can also invite"). Express permissions as plain capabilities, never as DB roles.

### Q2 — Is the feature structure too broad?

**Yes, at the top level.** Six of your areas are essentially "a list of timestamped entries with a form": appointments, visits, daily logs, vitals, tasks, medications. To the builder these are distinct tables. To a tired daughter at 11pm they blur together. Two consolidations I'd push for:

- **Merge "Visits" into "Appointments"** (or into a single "Schedule"). The distinction (family visit vs. clinic appointment) is a *type/tag*, not a separate top-level feature. Right now you're paying a navigation tax for a taxonomy only you care about.
- **Fold "Daily logs" into a single activity/notes stream** rather than a separate destination. Logging should feel like jotting a quick note in context, not visiting a "module."

Keep the *data* if you want — just stop making the user navigate six parallel silos.

### Q3 — Navigation-first or today-first?

**Today-first, decisively.** Reasoning:

- Your user opens the app with a job in mind ("did Mom get her morning pills? what's on today?"), not to browse features.
- A nav grid forces the user to translate their need into your taxonomy and then drill in. A today view answers the need immediately.
- Every senior-UX guideline converges on *simplify* + *reduce steps to value*. A today view is the most direct possible step-to-value.

Concretely, the home screen should be roughly: **a greeting + the cared-for person**, then **"Today" = the next few things (doses due, today's appointment, open tasks) each with a one-tap action**, then **a recent activity strip ("Ahmad gave the 8:00 dose — 20 min ago")**, and only *then*, lower down or behind a secondary tab, the full feature list / management screens. Navigation still exists — it's just demoted below the daily loop.

### Q4 — UX risks for older adults & family caregivers

1. **Cognitive load** from too many concepts (see Q2).
2. **Icon-only actions** — older users frequently can't decode unlabeled icons; the research explicitly says prioritize text labels. (Also the source of your mojibake pain.)
3. **Color-only status** — red/green alone fails for low-vision and color-blind users; status needs icon + text + color.
4. **Small targets / tight spacing** — reduced dexterity means mis-taps; primary actions especially must be large and spaced.
5. **Destructive actions without guardrails** — deleting a medication or removing a member needs confirmation + undo.
6. **Reminder over-promising** — if a family relies on Sanad for a critical dose and a notification silently fails, that's a trust (and safety) breach. Be explicit about what reminders can and cannot guarantee.
7. **RTL + mixed content breakage** — phone numbers, times, dose strengths, English drug names inside Arabic sentences are where layouts crack.
8. **Onboarding cliff** — if the empty app doesn't guide the first setup, non-tech users bounce.

### Q5 — What to simplify

- Collapse the six "list+form" areas conceptually (Q2).
- Reduce the dashboard to the daily loop (Q3).
- Reduce notification settings to a few human choices ("Remind me about: medications / appointments / tasks" + "Quiet hours"), hide the technical push/token mechanics behind an "Advanced" disclosure.
- Reduce per-screen actions to one obvious primary + at most one secondary.

### Q6 — What to emphasize

- The **medication daily loop** and its **visible closure** (given/postponed/missed → family feed → missed-dose nudge). This is your wedge.
- The **emergency card** — it's high-value, high-trust, and a great "show a stranger/doctor" moment. Make it reachable in one tap and legible under stress.
- **One-tap call** to doctors/emergency contacts — concrete, obviously useful, very senior-friendly.
- **Arabic-first warmth** — your differentiation. Don't bury it.

### Q7 — Top 10 UI/UX issues to audit after the mojibake fix

1. **Today view exists and leads** — home is the daily loop, not a feature grid.
2. **Every status uses icon + text + color**, never color alone; never a bare glyph.
3. **Touch targets ≥48dp** (primary ≥56dp), ≥8dp apart, tested with a real thumb.
4. **Body text ≥17sp**, scales with the OS font setting up to ~200% without clipping.
5. **Contrast ≥4.5:1** for text (≥3:1 large); re-check the brand blue on porcelain (blue desaturates for older eyes).
6. **RTL integrity** end-to-end; LTR runs (phones, times, codes, English drug names) isolated and not breaking line flow; directional icons mirror.
7. **Destructive actions** confirm + undo; no silent data loss.
8. **Empty states** instruct and invite action (not blank, not mood).
9. **Forms**: labels above fields, visible errors in plain Arabic, sane keyboard types, no clipping behind the keyboard.
10. **Reminder honesty**: copy makes clear local reminders ≠ guaranteed delivery, and distinguishes "test notification" from real reminders.

### Q8 — What to test on the S24 Ultra next

- Full pass in **Arabic + RTL + dark mode** for *every* screen after the glyph fix (no mojibake anywhere, including feeds, chips, chevrons, status marks).
- **Font scaling** at 130% and ~200% — does anything clip or overlap?
- **Thumb-reach** on a 6.8" display — are primary actions reachable one-handed, bottom-anchored?
- **One-tap call** actually dials from doctor + emergency cards.
- **Keyboard behavior** on every form (does the primary button stay reachable? does the field scroll into view?).
- **Date/time pickers** still render (guard against regressing the earlier fix).
- **Notification copy** reads correctly and the local-test vs real-reminder distinction is clear.
- **TalkBack** sanity pass on the home screen and the medication action buttons (labels announced, focus order sane).

---

## 3. Feature recommendations (your "add / edit / remove" ask)

Prioritized. "Now" = before more breadth; "Next" = after the core loop is solid; "Later" = roadmap.

### ADD — high value, research-backed

| Feature | Why | Priority |
|---|---|---|
| **"Today" home view** | The single biggest UX lever (Q3). Doses due + today's schedule + open tasks, each one-tap. | Now |
| **Visible activity feed / loop closure** | "Ahmad gave the 8:00 dose — 20 min ago." The #1 thing caregivers want is to *know it happened*. Turns silent logging into shared peace of mind. | Now |
| **Missed-dose / overdue nudge to family** | If a dose is marked missed (or goes unacknowledged past a window), gently notify the circle. This is the category's killer feature — and the reason a family keeps the app. | Next |
| **Unified Schedule (merge visits+appointments)** | Removes a whole navigation silo; one calendar = one truth. | Now |
| **Caregiver handoff / "who's on duty"** | Siblings rotating care need to see who's covering. Directly addresses coordination + caregiver burden. | Next |
| **"Claim a task" model** | ianacare/Lotsa pattern: post a need ("pharmacy run Thursday"), a family member claims it. Lighter and more social than hard assignment. | Next |
| **Medication photo + plain identity** | A photo of the actual pill/box reduces "is this the right one?" confusion. *Identity only — never interpretation.* | Next |
| **Adherence summary you can show the doctor** | A simple, read-only "last 30 days" view to hand to a physician. High trust, high utility, fits the emergency-card philosophy. | Next |
| **"Running low / refill" tracking** | Caregivers consistently want refill awareness. Even a manual "X days left" beats nothing. | Next |
| **Voice input for logging & reminders** | Repeatedly cited as a senior + busy-caregiver win; Arabic voice is a strong differentiator. | Later |
| **Accessibility/Large-text mode** | An in-app "bigger text + higher contrast" switch on top of OS scaling. Directly serves your audience. | Next |
| **Offline-first reliability + data export** | Works without signal; never loses an entry; lets families leave with their data (the CareZone lesson). Trust = retention. | Next |
| **Guided 3-step first-run setup** | "Add the person you care for → add one medication → invite one family member." Beats the empty-app cliff. | Now |

### KEEP & EMPHASIZE

- Medications with `given / postponed / missed` — good bones; just surface them in the feed and make the actions unmistakable (label + icon + color, big targets).
- Emergency card + one-tap call — keep, make it one tap from home, legible under stress.
- Doctors with one-tap call + LTR phone — keep; this is exactly right for the audience.
- Care circle concept — keep, but rename/explain in human terms (Q1).
- Local notifications + explicit opt-in + channel-before-permission — keep; the discipline here is correct.

### CUT, MERGE, or DEFER

- **Visits as a separate area** → merge into Schedule.
- **Daily logs as a separate destination** → fold into the activity/notes stream.
- **Vitals** → either defer, or keep *minimal and strictly non-diagnostic* (record + unit + trend line, zero interpretation, zero normal/abnormal coloring). Don't let it become a mini-EMR.
- **Over-granular notification settings** → reduce to a few human toggles + Quiet Hours; hide push/token mechanics under "Advanced."
- **Anything that adds taps before value** on the home screen → demote below the daily loop.

### RESEQUENCE

The handover's roadmap front-loads remote push (Edge Functions, cron). I'd flip it: **nail the today-first UI, the loop closure, simplicity, reliability, and onboarding first** (all client-side, all within your stated constraints), *then* invest in server-side remote reminders. A simple app people actually use beats a feature-complete app they abandon in week two.

---

## 4. Visual design critique (Deliverable 2)

### Q1 — Is "Warm Care OS" the right direction?

Warmth is the right *intent* for this subject — a care app for older adults should feel calm and human, not clinical and cold. So directionally, yes.

**But one honest caution:** "warm porcelain / graphite + sand accent" sits very close to the current generic AI-design default (warm cream background + high-contrast display + warm accent). It risks reading as "templated calm app" rather than "Sanad." Warmth here is justified by the subject (so it's not a lazy default), but you should **spend your one bold/distinctive move on something specifically Sanad** — a signature element that embodies *family care, in Arabic* — and keep everything else quiet and disciplined around it. Don't let the palette alone carry the identity.

### Q2 — Warmer, more clinical, more neutral, or more modern?

Aim for **"calm competence"**: warm and human in tone, but disciplined and precise in execution. Concretely: warm neutral surfaces, *restrained* accent usage (accent = "now / today / needs attention," not decoration), generous spacing, strong type hierarchy. Avoid both extremes — not clinical-cold, not soft-and-mushy. Premium in this category comes from *restraint and legibility*, not from gradients or flourish.

### Q3 — Is IBM Plex Sans Arabic a good choice?

Yes — it's a strong, legible, open-source family with genuine Arabic design (not a Latin font with bolted-on Arabic), and it pairs cleanly across Arabic/Latin. Caveats: lock a clear type scale, use weight deliberately (regular/medium for body, a heavier weight only for headings), and make sure your *bundled* weights actually cover what you use (missing weights silently fall back and break the look). It satisfies the "sans-serif, legible for older eyes" requirement well.

### Q4 — Decorative glyph chips, initials, or a proper icon set?

**A proper vector icon set + text labels. Decisively. Never decorative Unicode literals.** This is the root cause of your mojibake bug (§5) *and* an accessibility problem (older users struggle to decode bare icons; the research says prioritize text labels). Two acceptable patterns:

1. **Vector icons from a real library, always paired with a text label** for anything actionable or status-bearing.
2. **Localized initial-letter chips** (e.g., a circle with "د" for doctor) where a tiny label-glyph is genuinely enough.

What you must stop doing is embedding raw symbol characters (✅ › ● ™ " ") as your iconography — they are fragile to encoding and illegible when they break.

### Q5 — Visual principles that should govern all cards / forms / lists

- **One job per element.** A card shows one thing clearly; a button does one action named for what happens.
- **Hierarchy by size + weight + space, not by boxes and lines.** Let whitespace and type scale do the work; avoid heavy borders and nested cards.
- **Status = icon + text + color, every time.** Never color alone, never glyph alone.
- **Labels above inputs**, errors in plain Arabic right where the problem is, generous field height.
- **Lists scan top-to-bottom** with the most important info first in the reading direction (RTL).
- **Touch first.** Everything tappable is obviously tappable and big enough for an imprecise thumb.
- **Consistency is the brand.** Same action = same word + same icon everywhere; same spacing rhythm everywhere.

### Q6 — Premium without sacrificing readability

Premium = **precision + restraint + consistency**, not visual richness. Tight, consistent spacing scale; a real type scale; one disciplined accent; high contrast; smooth-but-minimal motion (a gentle transition, not scattered animation — over-animation reads as AI-generated). Readability is non-negotiable and *is* the premium signal for this audience: a calm, perfectly legible screen feels more expensive than a busy "designed" one.

### Q7 — What should never be allowed in the design system

- Raw Unicode symbol literals as icons (the mojibake source).
- Color-only status; icon-only primary actions.
- Body text below ~14sp; primary touch targets below 48dp.
- Contrast below WCAG AA.
- Text baked into images (kills RTL, scaling, and localization).
- Random gradients, decorative flourishes, trendy gimmicks, childish colors.
- Web/desktop layouts squeezed into mobile.
- Clinical coldness *or* over-soft mushiness.
- Any medical interpretation in the UI (normal/abnormal, "good/bad" values).

---

## 5. The mojibake bug — the real lesson (and the durable fix)

**What you're seeing:** `â€º âœ… â— â„¢ â€œ â€‌` is the classic signature of UTF-8 bytes being decoded as Windows-1252 (a Windows/PowerShell encoding accident). Decoded, those are: `›` (chevron), `✅` (check), `●` (bullet), `™`, and the smart quotes `" "`. So the corruption is happening to **decorative symbol characters embedded directly in source files.**

**Why a find-and-replace alone isn't the fix:** if you just repair the broken bytes, you've kept the fragile system that produced them. The next Windows line-ending conversion or file rewrite re-breaks it. You're treating the symptom.

**The durable fix (within your constraints — no native rebuild; one approved icon dependency, `@expo/vector-icons`):**

1. **Stop using raw symbol literals as iconography.** Replace them with a vector icon component.
2. **Use `@expo/vector-icons`.** **Install it with `npx expo install @expo/vector-icons` — in this repo it is *not* bundled by Expo and must be installed explicitly.** It is the one approved icon dependency for Sanad; it is JS + bundled-font based and loads through the already-installed `expo-font` path, so it does **not** require a native rebuild in the current development build. Pick one icon family (Sanad uses Ionicons by default, with MaterialCommunityIcons for a few care-domain icons) and use it consistently. (If you ever want `lucide-react-native`, note it pulls in `react-native-svg` — a new dependency that needs your explicit approval, even though Expo provides the native side.)
3. **Wrap icons in a single `Icon` component** so the whole app references named icons (`<Icon name="check" …/>`), never literal characters. One place to swap families, one place to enforce size/color tokens, and accessibility labels live there too.
4. **For the few places a character is genuinely fine** (e.g., an Arabic initial in a chip), centralize those strings in one constants module and ensure that file is UTF-8.
5. **Lock encoding at the repo level:** add an `.editorconfig` enforcing `charset = utf-8` and `end_of_line = lf`, and make sure `.gitattributes` normalizes line endings so Windows tooling can't silently re-corrupt files. Keep the `git diff --check` discipline you already have.
6. **Preserve** Arabic text, RTL, the date/time picker fixes, and notification behavior throughout — the fix is *swap icons + lock encoding*, not a redesign.

Net: after this, "broken glyph" becomes structurally impossible, and you simultaneously fix an accessibility problem (icons now carry labels).

---

## 6. Compact post-fix audit checklist

```
[ ] No mojibake anywhere (feeds, chips, chevrons, status, every screen, AR/RTL/dark)
[ ] Icons come from one vector set via a single <Icon> component (no literals)
[ ] Home = "Today" daily loop; feature grid demoted
[ ] Every status = icon + text + color
[ ] Touch targets ≥48dp (primary ≥56dp), ≥8dp apart
[ ] Body ≥17sp; scales to ~200% without clipping
[ ] Contrast ≥4.5:1 (≥3:1 large); brand blue re-checked on porcelain
[ ] RTL intact end-to-end; LTR runs isolated; directional icons mirrored
[ ] Destructive actions confirm + undo
[ ] Empty states instruct + invite
[ ] Forms: labels above, plain-Arabic errors, right keyboards, no keyboard clipping
[ ] Reminder copy honest (local ≠ guaranteed; test vs real reminder distinct)
[ ] tsc --noEmit clean; expo-doctor clean; git diff --check clean
```

---

## 7. Suggested re-sequenced roadmap

1. **Phase A — Stabilize & simplify (client-only, no backend):** mojibake/icon fix + encoding lock; today-first home; merge visits→schedule; fold daily logs into activity stream; status pattern (icon+text+color) everywhere; accessibility pass (sizes, contrast, scaling); 3-step onboarding.
2. **Phase B — The loop:** visible activity feed; medication loop closure surfaced to the family; honest reminder copy; large-text/accessibility mode; offline reliability + data export.
3. **Phase C — Coordination & trust:** missed-dose/overdue nudge; handoff / "who's on duty"; claim-a-task; adherence summary for the doctor; refill awareness; medication photo (identity only).
4. **Phase D — Server & scale (carefully reviewed):** remote push (Edge Functions, cron) end-to-end; then production build & store readiness; voice input; B2G/health-cluster exploration.

The throughline: **earn daily use with a simple, trustworthy core before adding breadth or backend complexity.**

---

*End of review. Companion deliverable: a project-local Claude Code skill (`SKILL.md`) that encodes these design rules so future Code sessions improve Sanad without regressing Arabic/RTL/accessibility, and without touching backend or breaking the constraints in your handover.*
