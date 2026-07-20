# Sanad — Full Product & UI Report (for Design)

**Prepared:** 2026‑07‑18 · **Source:** `milestone-5-redesign` branch, read directly from code (no changes made).
**Audience:** the product designer who will redraw Sanad professionally. This report describes **what exists today** — every screen, sub‑screen, button, form, state, flow, and shared component — so you can recreate it faithfully and then improve it. Nothing here prescribes a new design; it is a complete inventory of the current one.

---

## 1. What Sanad is

**Sanad (سند — "support")** is an **Arabic‑first, right‑to‑left, gender‑neutral mobile app that lets a family and their helpers coordinate the care of an elderly or dependent loved one together.** It is not a single‑user health tracker — it is a **shared care circle**: several people (adult children, siblings, a spouse, a hired nurse) all see the same medications, tasks, appointments, visits, vitals and daily logs for **one care recipient**, and split the work between them.

**Core promises the design must protect:**
- **Calm, never alarming.** This is a stressful life situation. The tone is "دفء عائلي هادئ" — calm family warmth. No guilt, no alarm‑red, no gamification (no streaks/points/scores), no exclamation marks or emoji in core UI.
- **Built for older eyes and tired hands.** 14 pt is the absolute text floor (body 16), 48 dp minimum touch targets, strong contrast, status is **never** color‑only (always icon **+** text).
- **Everyone sees everything; roles gate who can change it.** Any active member can *view* all of the circle's operational data. A **role** (manager vs collaborator) plus row‑level security decides who can *edit*. Lists offer a **"مهامي / كل المهام" (mine / all)** scope toggle so a collaborator isn't overwhelmed.
- **Bilingual, RTL‑native.** Every string exists in Arabic **and** English at exact key parity. Arabic is the primary/default. Layout mirrors for RTL.

### Personas
| Persona | Role | Needs from the UI |
|---|---|---|
| **Primary organizer** (e.g. eldest daughter) | Circle **manager** | Create the circle, invite others, assign work, edit anything, manage the recipient's medical profile. |
| **Helping family member** | **Collaborator** | See what's due, claim/complete their share, log doses & notes. Defaults to the "mine" scope. |
| **Hired caregiver / nurse** | Collaborator | Same as above; fast dose logging and daily logs on shift. |
| **The care recipient** | (not a user) | Spoken of only with dignity — «الشخص الذي تعتني به» / «الشخص الذي يتلقّى الرعاية» — never a cold clinical label. |

---

## 2. How to read this report

The report is split into a master index (this file) plus one deep‑dive section per product domain. Each section documents every screen top‑to‑bottom: layout, every interactive control with its Arabic + English label, all states (loading / empty / error / populated), all forms and validation, the shared components used, and the end‑to‑end workflows.

| # | Section file | Covers |
|---|---|---|
| 00 | `00-README.md` (this file) | Product overview, navigation map, design‑system quick reference, global patterns |
| 01 | `01-auth-and-onboarding.md` | Sign‑in / sign‑up / forgot & reset password, the no‑circle gate, create a circle, join a circle, circle switcher |
| 02 | `02-navigation-and-home.md` | App shell, bottom tab bar, the **Home / Today** tab (dose ring, quick actions, today's doses & tasks) |
| 03 | `03-explore-and-account.md` | The **Explore** feature directory + the **Account** tab (profile, circles, settings, sign‑out) |
| 04 | `04-medications.md` | Medication list / detail, schedules, **dose logging & correction**, add/edit medication & schedule |
| 05 | `05-tasks.md` | Care tasks — list, detail, complete/cancel, assignment, priority & status |
| 06 | `06-appointments.md` | Appointments — list, detail, add/edit |
| 07 | `07-visits.md` | Family visits — list, detail, add/edit |
| 08 | `08-vitals.md` | Vital readings — every reading type, units, list, detail, add/edit |
| 09 | `09-daily-logs.md` | Daily care logs — every log category, list, detail, add/edit |
| 10 | `10-members-and-invitations.md` | Circle members, roles & capabilities, invite a member, pending invitations |
| 11 | `11-claiming.md` | Available‑to‑claim, the inline "أنا متكفّل" claim, mine/all scope, assignment picker |
| 12 | `12-emergency-doctors-recipient.md` | Emergency card, emergency contacts, doctors, care‑recipient profile |
| 13 | `13-pulse.md` | **The Pulse** — the shared care‑activity feed / weekly share |
| 14 | `14-notifications.md` | Notifications inbox, reminder settings & catalog, push‑permission status |
| 15 | `15-design-system-core.md` | Tokens (color/type/spacing), icon system, core primitives (Button, Surface, GlyphChip, …) |
| 16 | `16-design-system-forms.md` | Forms, bottom‑sheets, pickers, date/time fields, list chrome |
| 17 | `17-copy-and-voice.md` | Copy voice, terminology glossary, i18n namespace map, key parity |
| 18 | `18-data-model.md` | Backend data model — entities, fields, enums, background jobs (what each screen is backed by) |

---

## 3. Platform & technical context (so estimates are realistic)

- **Framework:** Expo (SDK 56) / React Native, **Expo Router** file‑based routing. Runs on **iOS, Android, and Web** (web has a few `.web.tsx` variants — e.g. the tab bar floats at the top on web).
- **Language & direction:** **Arabic‑first, RTL.** English is a full peer at exact i18n key parity. One typeface only: **IBM Plex Sans Arabic** (carries both Arabic and Latin).
- **Theming:** full **light and dark** modes as equal peers (follows the OS). Every color is a semantic token; there is no hardcoded hex in screens.
- **Backend:** Supabase (Postgres + Auth + row‑level security + Edge Functions for reminders/notifications). See §18.
- **Scale:** ~46 route screens, ~46 shared components, ~20 feature domains, ~30.5k lines of TypeScript/TSX, ~1,250 translation keys per locale.

---

## 4. Navigation architecture & full sitemap

The app is a **stack of stacks**. The root decides *signed‑out vs signed‑in*; the signed‑in area is a **native stack** that hosts the **bottom‑tab group** and pushes full‑screen detail screens over it.

```
Root Stack  (headerless; brand splash overlay; deep‑link "pending join" replay)
│
├─ (auth)              ← shown when there is NO session
│   ├─ /sign-in
│   ├─ /sign-up
│   └─ /forgot-password
├─ /reset-password     ← top‑level deep‑link target (from the reset e‑mail)
│
└─ (app)               ← SESSION GUARD: no session → redirect to /sign-in
    │                     hosts a headless NotificationObserver (tap routing, token refresh)
    │                     every feature center is wrapped in a CircleGate (ensures an active circle)
    │
    ├─ (tabs)          ← custom bottom tab bar (Home · Explore · Account)
    │   ├─ / (index)                 →  HOME / TODAY   (§02)
    │   ├─ /explore                  →  feature directory (§03)
    │   └─ /account                  →  profile · circles · settings · sign‑out (§03)
    │
    ├─ /medications  → /medications/[id]   → /medications/new        (§04)
    ├─ /tasks        → /tasks/[id]         → /tasks/new              (§05)
    ├─ /appointments → /appointments/[id]  → /appointments/new       (§06)
    ├─ /visits       → /visits/[id]        → /visits/new             (§07)
    ├─ /vitals       → /vitals/[id]        → /vitals/new             (§08)
    ├─ /daily-logs   → /daily-logs/[id]    → /daily-logs/new         (§09)
    │
    ├─ /circle-members  (own headerless stack)                       (§10)
    │   ├─ /circle-members            → members list
    │   ├─ /circle-members/invitations→ pending invitations
    │   └─ /circle-members/invite     → invite a member
    │
    ├─ /available-to-claim   → unassigned open work to claim         (§11)
    ├─ /pulse                → the shared care‑activity feed          (§13)
    ├─ /notifications        → in‑app notifications inbox             (§14)
    ├─ /notification-settings→ reminder categories & quiet hours      (§14)
    ├─ /recipient-profile    → the care recipient's profile           (§12)
    ├─ /emergency-card       → at‑a‑glance critical info              (§12)
    ├─ /emergency-contacts   → manage emergency contacts              (§12)
    ├─ /join-circle          → enter an invite code                   (§01)
    └─ /doctors              → doctors directory                      (§12)
```

**Detail (`/[id]`) and `/new` screens push full‑screen** over the tab bar with a themed header + back button. The `(app)` stack anchors back‑navigation to `(tabs)`, so even a deep link straight into a detail screen has **Home** to return to.

### The three tabs (bottom bar — `FigmaTabBar`)
Custom bar; a **teal active pill (44×28)** sits behind a 20 px [lucide] icon (stroke 2.5 active / 2 idle) with the label under it (semibold active / regular idle), a hairline top border on the card background. RTL mirrors the row, so **Home sits on the right**.

| Order (LTR listing) | Route | Icon | Arabic label | English label |
|---|---|---|---|---|
| 1 | `index` | Home | **الرئيسية** | Home |
| 2 | `explore` | Compass | **استكشاف** | Explore |
| 3 | `account` | User | **الحساب** | Account |

---

## 5. Canonical feature order (used everywhere)

Home quick‑actions, the Explore directory, and in‑list grouping all order features the same way:

> **medications → tasks → appointments → vitals → visits → daily logs → doctors → members**

Within a list, what needs attention floats up first, then chronological: **tasks** = overdue → priority (urgent→low) → due date/time; **doses** = unlogged first, then time order.

---

## 6. Global UI patterns (recur across many screens)

These appear again and again; the designer should treat them as reusable system behaviors, not per‑screen inventions.

- **Mine / All scope toggle** — «مهامي / كل المهام». The system posture is that *everyone can see all* of the circle's data, and a member's **role** only decides what defaults into focus — never what they may view. Where this surfaces as a **visible** segmented toggle today: it currently ships on the **Tasks** list (§05), where collaborators default to **mine** and managers to **all**. Other operational lists scope **implicitly** (no drawn toggle): medications' *Today* view, appointments and visits filter by role/assignment; vitals and daily logs always show the whole circle's data. A redesign could unify this into one consistent toggle, but the current build does not draw it everywhere.
- **Inline claim** — «أنا متكفّل» ("I'll take care of it"). Unassigned open work shows an inline claim affordance for any claim‑capable member. (See §11.)
- **Three sanctioned confirmation patterns** — a one‑tap action that mutates data or ends a session is **always** guarded by exactly one of:
  1. **`confirmAction()`** — a lightweight cross‑platform prompt (sign‑out, claim, medication/schedule activate·deactivate).
  2. **Inline two‑step confirm** — the delete rows (tap delete → confirm in place).
  3. **Bottom‑sheet confirm** — task complete/cancel and dose‑status correction.
  Nothing destructive fires silently, and every mutation that fails **surfaces an alert message** (never a silent revert).
- **Four list/screen states** — every list has: a **loading** skeleton, an **empty state** (one card + the feature's icon + a warm title/subtitle — an empty day is framed as *good news*: «يوم هادئ»), an **error** state (a bespoke card that says what happened + what to do, using «تعذّر…» never «فشل»), and the **populated** state.
- **Status is icon + text, never color alone** — every status pill pairs a semantic icon with its label.

---

## 7. Design‑system quick reference

Full details in §15 and §16. This is the at‑a‑glance token table (single source: `src/constants/theme.ts`). Visual direction: **"Warm Care OS"** — warm‑neutral canvases (never flat white / pure black), one confident **teal** brand, a **soft sand/gold** accent used only for celebratory & empty moments, and a 5‑step per‑feature category tint ramp. Identity comes from **typography + warmth**, not gradients or heavy shadows.

### Color — semantic tokens (light / dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `text` | `#1A1714` | `#EDE8DF` | Primary text |
| `textSecondary` | `#6B6258` | `#ACA89D` | Secondary text |
| `textMuted` | `#6D6760` | `#908981` | Metadata / timestamps only (never body) |
| `background` | `#F7F3EE` | `#0F0E0C` | App canvas (warm porcelain / warm graphite) |
| `backgroundElement` | `#FFFFFF` | `#1A1916` | Card / panel surface |
| `backgroundSunken` | `#EDE8DF` | `#26231E` | Recessed wells & input fields |
| `backgroundSelected` | `#E4DDCE` | `#322E27` | Pressed / selected fill, grab handles |
| `border` | `#E1DDD8` | `#2E2A24` | Hairline card border (both themes) |
| `divider` | `#ECE7DF` | `#211F1B` | Row separators inside a surface |
| **`primary`** | **`#2A7F71`** | **`#4BA898`** | Brand teal (buttons, active) |
| `primaryPressed` | `#256F63` | `#3E9384` | Pressed brand |
| `onPrimary` | `#FFFFFF` | `#0F0E0C` | Text on the teal fill |
| `primaryBg` / `primaryText` | `#EAF3F1` / `#1F6E60` | `#1C2D29` / `#7AC8BA` | Tinted teal surface / brand text |
| `accentFg` / `accentBg` | `#8A5A17` / `#F4E9D5` | `#DDAF63` / `#34291A` | Warm sand accent (highlight/today) |
| `accentSolid` / `onAccent` | `#C8904A` / `#2A1D05` | `#C8904A` / `#0F0E0C` | Gold fill — **celebration & empty states only** |
| `successFg` / `successBg` | `#1F7A4D` / `#E4F1EA` | `#5AAE85` / `#16291F` | Success |
| `warningFg` / `warningBg` | `#9A5B00` / `#F6EBD7` | `#D9A24A` / `#332813` | **Amber** caution (never the gold) |
| `errorFg` / `errorBg` | `#B5403F` / `#F7E5E3` | `#E07A78` / `#3A1E1C` | Danger text/badge |
| `dangerSolid` / `onError` | `#C45050` / `#FFFFFF` | `#C45050` / `#FFFFFF` | **Restrained** danger fill (not alarm‑red) |
| `infoFg` / `infoBg` | `#3E6FA0` / `#E7EEF7` | `#7FA8D8` / `#1B2738` | Info |
| `overlay` | `rgba(26,23,20,.45)` | `rgba(0,0,0,.55)` | Modal scrim |
| **Category ramp** (feature icon chips) | blue `#5A8ABF` · purple `#8B6FA8` · green `#4A9A75` · gold `#BA8645` · teal `#2E8A7B` | blue `#6A9ACC` · purple `#9B7FC0` · green `#5AAE85` · gold `#C8904A` · teal `#4BA898` | Per‑feature identity tint |

### Type scale — `Type.*` presets (IBM Plex Sans Arabic; **14 is the floor**, body 16, Arabic line‑heights ≥1.5×)
| Preset | Size / line‑height | Weight | Use |
|---|---|---|---|
| `caption` | 14 / 22 | Regular | Metadata, timestamps, hints, pill & chip labels (the floor) |
| `captionStrong` | 14 / 22 | SemiBold | Field labels, eyebrows, active tab |
| `body` | 16 / 26 | Regular | Default reading text |
| `bodyStrong` | 16 / 26 | SemiBold | Emphasized body, row values, button label, links |
| `cardTitle` | 18 / 28 | SemiBold | List‑row & card titles |
| `sectionTitle` | 20 / 30 | Bold | Section headings |
| `subtitle` | 22 / 32 | Bold | Sub‑hero, large single stats |
| `hero` | 26 / 38 | Bold | Screen hero heading |
| `display` | 30 / 42 | Bold | Greeting / dashboard hero |
| `displayXL` | 34 / 46 | Bold | Reserved (unused) |
| `code` | 14 / 21 | Mono | Invite codes / IDs (still ≥14) |

### Spacing, radius, sizing
- **Spacing (4‑pt):** `half 2 · one 4 · two 8 · three 16 · four 24 · five 32 · section 40 · six 64`.
- **Radius:** `sm 8 · md 12 · lg 16 · card 20 · xl 24 · pill 999`.
- **Icon glyph size:** `sm 16 · md 20 · lg 28 · xl 40`. **Icon‑chip diameter:** `xs 28 · sm 36 · md 40 · lg 44 · xl 48`.
- **Touch target:** `min 48 · comfortable 52`. **Gutter:** 20. **Max width:** content 720 / form 480.
- **Elevation ruling:** a card has a **hairline border in BOTH themes**; a **whisper‑soft shadow sits on top in LIGHT mode only** (opacity ≤ 0.07). Dark mode uses lifted background + border, no shadow. Tinted/sunken surfaces stay flat.

### Icon system
One centralized `<Icon>` component maps **semantic names** (e.g. `medication`, `appointment`, `dailyLog`, `vital`, `member`, `doctor`, `notification`, `success`, `error`, `add`, `signOut`, `activity`) to vector glyphs (Ionicons / MaterialCommunityIcons; lucide in a few Figma‑era chrome pieces). Screens pass a semantic name, never a resolved color. Full name list in §15.

---

## 8. Copy voice — «دفء عائلي هادئ» (calm family warmth)

Full guide + glossary in §17. The rules every string obeys:
- **Simple Modern Standard Arabic, no dialect, gender‑neutral** (so a daughter, son, or nurse all read naturally). Short sentences.
- **Never guilt or alarm.** A missed dose is a *fact to act on* — «جرعة فائتة» / «لم تُسجّل بعد», never blame. An empty day is *good news* — «يوم هادئ» / «كل شيء على ما يُرام».
- **Errors say what happened + what to do**, no codes: «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» Use «تعذّر…», never «فشل»/«خطأ».
- **Celebration stays quiet** — «تم حفظ التغييرات» / «اكتملت جرعات اليوم». **No exclamation marks, no emoji** anywhere in core UI (both locales are at zero — keep them there).
- **The care recipient is always spoken of with dignity** — «الشخص الذي تعتني به» / «الشخص الذي يتلقّى الرعاية» ("the person you care for" / "the person receiving care"), never a cold or clinical label.
- **Canonical terms (one per concept):** task open = **«مفتوحة»** · medication active/inactive = **«فعّال» / «غير فعّال»** · no‑assignee = the shared `assignment.none` copy · member name always via `memberDisplayName()`.

### i18n namespaces (34 top‑level, ar/en at exact parity)
`appName · loading · retry · error · common · validation · home · careCircle · circleSwitcher · circleMembers · invitations · joinCircle · recipientProfile · emergencyContacts · doctors · emergencyCard · medications · assignment · claiming · tasks · appointments · visits · dailyLogs · vitals · pickers · explore · tabs · auth · account · circleTimezone · pulse · notifications · notificationSettings · figma`

---

## 9. Standing design rulings (the "Milestone 5" laws)

The current design is governed by a short set of settled rules. A redesign should keep the *intent* even if it changes the look:
1. **One token system** — `theme.ts` is the single source; one typeface (IBM Plex Sans Arabic).
2. **Type floor = 14**, body 16, Arabic line‑heights ≥1.5×.
3. **Danger is calm + restrained + iconed** — never alarm‑red. Gold accent is for celebration/empty only; caution is amber.
4. **Care is not a game** — no streaks/scores/points/leaderboards. Completion is a quiet moment of care.
5. **One `Surface` card primitive** — hairline border both themes, soft shadow light‑only.
6. **One component per job** — Card→`Surface`; text field→`FormField`; single‑choice→`OptionSelect`; icon chip→`GlyphChip`; empty→`EmptyState`; toggle→`FigmaSwitch` (never the platform Switch).
7. **One sheet chrome** (centered card, grab handle) across `FormModal` / `PickerSheet` / `FigmaBottomSheet`; **one back affordance** (44 dp round pill + arrow).
8. **Every mutation confirms + surfaces failure** (the three sanctioned patterns in §6).

---

---

## 10. Coverage, provenance & redesign flags

**How this was produced.** Every section was read directly from the current `milestone-5-redesign` source — routes, feature code, shared components, and the real `ar.json` / `en.json` copy — then cross‑checked by a completeness audit against the full inventory. **No source files were changed.** Coverage confirmed by the audit:
- **All 46 route screens** documented (every `index / [id] / new / _layout` across medications, tasks, appointments, visits, vitals, daily‑logs; the whole `circle-members` group; all standalone `(app)` screens; the auth group; root layout; reset‑password).
- **All 33 shared components** on the checklist documented (§15 core primitives, §16 forms/sheets/pickers, plus tab‑bar & dose ring in §02, auth‑field in §01, contact‑card in §12).
- **All 20 cross‑cutting workflows** covered with explicit step lists.

**Redesign flags — small inconsistencies in the *current build* worth resolving in the redesign (not report errors):**
1. **Scope toggle isn't drawn everywhere.** The visible «مهامي / كل المهام» toggle currently ships only on **Tasks**; other lists scope implicitly by role or show all (see §6, §05). Consider unifying.
2. **Copy drift between canonical and `figma.*` keys.** Some empty‑states and status labels exist in two namespaces; the shipping screen renders the `figma.*` one while the canonical twin is dead copy (e.g. `figma.medications.inactive` English says **"Stopped"** vs canonical **"Inactive"**). Reconcile onto one key — details and the full list in **§17**.
3. **Visits icon is inconsistent by surface** — the Home quick‑action uses a "green invite" glyph while Explore / the claim card / the visit card use a "member/users" glyph (see §02, §07, §11). Pick one.
4. **Two unused scaffolds** exist and are intentionally *not* fully specced: `dashboard-tile.tsx` (Home re‑implements its own stat tiles inline) and `external-link.tsx` (leftover Expo template, zero usages). Safe to ignore or delete in a redesign.

---

*Sections 01–18 follow, each self‑contained. Read §15/§16 first if you are rebuilding the design system, or §04 first if you want the hardest screen (medications & dose logging).*
