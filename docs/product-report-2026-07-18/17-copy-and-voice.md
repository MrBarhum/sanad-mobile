# Copy, Voice & Terminology (i18n)

This section is the reference for every word the Sanad app puts on screen. Unlike the other sections it is not organized by screen — it is organized by *language system*, because copy in Sanad is fully i18n-driven: **no Arabic (or English) string is hardcoded in a component**; every user-facing word resolves through a translation key against `src/locales/ar.json` and `src/locales/en.json`. Both files are kept at **exact key parity** (identical key trees, one value per language) so any key that exists in Arabic exists in English and vice-versa. Arabic is the primary, default, and design-driving language (the app boots in Arabic and forces RTL layout regardless of device locale — `src/i18n/index.ts:24`, `src/i18n/rtl.ts:7`); English is the loaded fallback (`fallbackLng: 'en'`, `src/i18n/index.ts:30`) and a future switch target. A redesigner and copywriter must treat the Arabic column as the source of truth and the English column as its faithful mirror. Everything below documents the *voice* those strings speak in, the *canonical terminology* they must never deviate from, the *tone rules* that govern them, and the *namespace map* that shows where each concept's copy lives.

---

## 1. The copy voice — «دفء عائلي هادئ» (calm family warmth)

Every string, in both locales, speaks in one deliberate voice. This is a settled Milestone-5 standing decision, not a style suggestion. The five pillars:

1. **Simple Modern Standard Arabic — no dialect.** Short sentences. The Arabic is *fuṣḥā* kept plain and readable for older adults and non-expert family members. There is no Gulf/Levantine/Egyptian colloquialism anywhere in the UI copy. (Dialect appears only as *content* the family types — e.g. the recipient-profile field «اللهجة» / "Dialect", `recipientProfile.fields.dialect`.)
2. **Gender-neutral.** Arabic is heavily gendered, so the copy leans on *maṣdar* (verbal-noun) and neutral constructions so a daughter, son, wife, or a hired nurse all read naturally. Examples: buttons are nouns not commands where possible («تسجيل» = "logging/record", `careCircle.dashboard.today.logAction`; «إضافة مهمة» = "Add task", `tasks.add`), confirmations use neutral phrasing («هل تريد تعليم هذه المهمة كمُنجَزة؟», `tasks.confirmCompleteBody`).
3. **Never guilt or alarm.** A missed dose is a *fact to act on*, not a failure. The app says «جرعة فائتة» ("Missed dose", `notifications.types.medication_missed`) and «لم تُسجّل بعد» ("Not logged yet", `careCircle.dashboard.today.doseUnlogged`) — never blame, never «فاتتك». An empty day is framed as *good news*: «يوم هادئ» ("A calm day"), «كل شيء تحت السيطرة» ("everything's under control"), «كل شيء على ما يُرام» ("everything's in order").
4. **Errors say what happened + what to do — no codes, no jargon.** The canonical error shape is «تعذّر [الفعل]. تحقّق من الاتصال وحاول مجددًا.» / "Couldn't [verb]. Check your connection and try again." The verb is always **«تعذّر»** ("could not / was unable"), **never «فشل» ("failed") or «خطأ» ("error")**.
5. **Celebration stays quiet.** Completion is acknowledged with a plain, warm statement — «تم حفظ التغييرات» ("Changes saved"), «اكتملت جرعات اليوم» ("Today's doses are complete") — never a reward, score, or fanfare. **No exclamation marks and no emojis anywhere in core UI copy** — both `ar.json` and `en.json` currently sit at zero of each; keep them there.

A sixth, cross-cutting rule: **the care recipient is always spoken of with dignity** — «الشخص الذي تعتني به» / «الشخص الذي يتلقّى الرعاية» ("the person you care for" / "the person receiving care"), never a cold or clinical label like "patient" or «المريض».

**North-star string** (the tone exemplar every other string is measured against): `pulse.shareEmpty` — Arabic **«يوم هادئ، لا جديد يُذكر اليوم.»**, English **"A calm day — nothing to report today."** Calm, warm, unalarmed, no punctuation drama.

**The meaning-safety exception.** When a warmer wording would risk changing *meaning* — a medical/legal disclaimer, a canonical status enum, a precise field label, or a password rule — the copy is left literal and flagged rather than softened. Do not "warm up": the disclaimers (`medications.disclaimer`, `vitals.disclaimer`, `dailyLogs.disclaimer`, `emergencyCard.disclaimer`), the status enum labels (§3), or the password rule «يجب أن تتكوّن كلمة المرور من ٦ أحرف على الأقل» (`auth.errors.password`).

---

## 2. `memberDisplayName()` — how a person's name is rendered

There is **one** function that turns a member's stored identity into a display string, and it is used by the roster, the assignment pickers, and the Care Pulse feed so a member reads with the same name everywhere (`src/features/circle-members/display-name.ts`).

The resolution chain is:

```
real full name (trimmed)  →  email local-part (text before "@")  →  a neutral fallback the caller passes
```

Rules a designer/copywriter must respect:

- **Never a bare generic word when any identity exists.** The neutral fallback («عضو» / "Member", from `circleMembers.unnamed` or `assignment.unknownMember`) is only reached for a legacy account with neither name nor email — sign-up now requires a name, so it is rare.
- **Never a raw email inline.** Only the *local-part* (before the `@`) is ever shown, so broadcast surfaces (the Pulse feed, share text) don't leak addresses. Email visibility is also gated server-side (`list_circle_members` masks the email column for non-managers/non-self).
- The current user renders as «أنت» / "You" (`circleMembers.you`), and self-assignment as «أنا» / "Me" (`assignment.me`) or «معيّن لي» / "Assigned to you" (`assignment.assignedToMe`).
- A member who has left the circle renders as «عضو سابق» / "Former member" (`assignment.inactiveMember`).

---

## 3. Terminology glossary — the canonical enums

One term per concept, in **every** namespace including `figma.*`. These are settled; do not reintroduce a synonym. Where the `figma.*` namespace historically drifted, the canonical value and the (still-present) figma value are both shown so a redesigner can spot and collapse the duplicate.

### Task status (`tasks.status.*`)
| Concept | Arabic (canonical) | English | Note |
|---|---|---|---|
| open | **«مفتوحة»** | "Open" | **Not «معلقة»** ("pending/suspended"). This is the canonical open-status word. |
| completed | «منجزة» | "Completed" | |
| cancelled | «ملغاة» | "Cancelled" | |

`figma.tasks.tabs` mirrors these as tab labels: today «اليوم»/"Today", open **«مفتوحة»**/"Open", done «مكتملة»/"Done".

### Medication / schedule active state (`medications.*`)
| Concept | Arabic (canonical) | English | Note |
|---|---|---|---|
| medication active | **«فعّال»** | "Active" | `medications.activeLabel` = «الدواء فعّال». **Not «نشط»**. |
| medication inactive | **«غير فعّال»** | "Inactive" | `medications.inactiveLabel`. **Not «موقوف»**. |
| schedule active | «فعّال» | "Active" | `medications.scheduleActiveLabel` |
| schedule stopped | «موقوف» | "Stopped" | `medications.scheduleStoppedLabel` — note the *schedule* label legitimately uses «موقوف»/"Stopped" as its own state. |

> **Redesigner flag:** `figma.medications.active` = «فعّال» / "Active" agrees, but `figma.medications.inactive` = «غير فعّال» / **"Stopped"** — the English there says "Stopped" while the canonical `medications.inactiveLabel` English is "Inactive". This is a residual figma-namespace drift to reconcile toward the canonical "Inactive".

### Dose status (`medications.status.*`)
| Arabic | English |
|---|---|
| «أُعطيت» | "Given" |
| «لم تُعطَ» | "Missed" |
| «مؤجَّلة» | "Postponed" |

### Assignment vocabulary (`assignment.*`)
| Key | Arabic | English | Use |
|---|---|---|---|
| `assignment.none` | **«غير محدد»** | "Unassigned" | The **shared** "no assignee" copy in every picker. Don't reintroduce per-feature variants. |
| `assignment.label` | «تعيين إلى» | "Assign to" | Picker field label |
| `assignment.me` | «أنا» | "Me" | |
| `assignment.assignedToMe` | «معيّن لي» | "Assigned to you" | |
| `assignment.unassigned` | «غير مسند» | "Unassigned" | |
| `assignment.responsible` | «المسؤول» | "Responsible" | |
| `assignment.inactiveMember` | «عضو سابق» | "Former member" | |
| `assignment.unknownMember` | «عضو» | "Member" | The `memberDisplayName` fallback |
| `assignment.nameWithRole` | «{{name}} - {{role}}» | "{{name}} - {{role}}" | |

> Note the per-feature "unassigned" duplicates that also exist — `tasks.unassigned` = «غير مُسندة» / "Unassigned" (feminine, agreeing with «مهمة») — these are grammatical-agreement variants for a specific noun, distinct from the shared `assignment.none`. The picker's *none* option always uses `assignment.none`.

### The claim ("أنا متكفّل") vocabulary (`claiming.*`)
| Key | Arabic | English |
|---|---|---|
| `claiming.cta` | **«أنا متكفّل»** | "I'll take it" |
| `claiming.ctaHint` | «تكفّل بهذا العنصر ليصبح من مسؤوليتك» | "Take responsibility for this item" |
| `claiming.title` / `entryTitle` | «متاح للتكفّل» | "Available to claim" |
| `claiming.confirmTitle` | «التكفّل بهذا العنصر؟» | "Take responsibility for this?" |
| `claiming.confirmMessage` | «سيصبح «{{title}}» من مسؤوليتك.» | "\"{{title}}\" will become your responsibility." |
| `claiming.claimSuccess` | «تم التكفّل بهذا العنصر» | "You've taken responsibility for this item" |
| `claiming.alreadyClaimed` | «تم التكفّل بهذا العنصر من شخص آخر» | "Someone else already claimed this item" |

### "Mine / all" scope toggle (`figma.tasks.scope.*`)
| Arabic | English |
|---|---|
| «مهامي» | "My tasks" |
| «كل المهام» | "All tasks" |

### Roles (`circleMembers.roles.*`) — canonical role names
| Key | Arabic | English |
|---|---|---|
| `admin` | «مشرف» | "Administrator" |
| `primary_caregiver` | «مقدّم الرعاية الأساسي» | "Primary caregiver" |
| `family_member` | «فرد من العائلة» | "Family member" |
| `caregiver` | «مقدّم رعاية» | "Caregiver" (not yet assignable) |
| `remote_member` | «عضو عن بُعد» | "Remote member" |
| `elder` | «الشخص الذي تتم رعايته» | "Care recipient" (not yet assignable) |

> The `figma.members.legend` uses a *simplified 3-tier* vocabulary for a legend — «مسؤول»/"Manager", «محرر»/"Editor", «مشاهد»/"Viewer" — which is a display grouping, not the canonical role enum above. Don't confuse the two.

### The care recipient — dignified references
| Where | Arabic | English |
|---|---|---|
| `careCircle.dashboard.recipientLabel` | «الشخص الذي تعتني به» | "Person you care for" |
| `emergencyCard.recipientLabel` | «الشخص الذي تعتني به» | "Person you care for" |
| `circleMembers.roleDescriptions.elder` | «الشخص الذي يتلقّى الرعاية.» | "The person receiving care." |
| `careCircle.onboarding.subtitle` | «ابدأ بإضافة الشخص الذي تعتني به» | "Start by adding the person you care for" |

---

## 4. Tone rules in practice — the recurring copy shapes

These are the concrete, repeatable string templates. A redesigner adding a new screen should reuse these shapes verbatim.

### 4.1 The error shape — «تعذّر … . تحقّق من الاتصال وحاول مجددًا.»
Nearly every load/save error follows: `تعذّر [الفعل]. تحقّق من الاتصال وحاول مجددًا.` The verb is **always «تعذّر»**. Sample instances (all parallel in English as "Couldn't … . Check your connection and try again."):

| Key | Arabic |
|---|---|
| `error` (root, generic) | «تعذّر إتمام العملية. تحقّق من الاتصال وحاول مجددًا.» |
| `medications.loadError` | «تعذّر تحميل الأدوية. تحقّق من الاتصال وحاول مجددًا.» |
| `medications.saveFailed` | «تعذّر الحفظ. تحقّق من الاتصال وحاول مجددًا.» |
| `tasks.loadError` | «تعذّر تحميل المهام. تحقّق من الاتصال وحاول مجددًا.» |
| `careCircle.dashboard.today.logFailed` | «تعذّر تسجيل الجرعة. تحقّق من الاتصال وحاول مجددًا.» |
| `claiming.claimFailed` | «تعذّر التكفّل بهذا العنصر. تحقّق من الاتصال وحاول مجددًا.» |

A "not found" variant softens with a reassuring cause: `medications.notFound` = «تعذّر العثور على هذا الدواء. ربما حُذف.» / "Couldn't find this medication. It may have been removed."

> **Copywriter flag — English wording drift.** The Arabic error verb is uniformly «تعذّر». The English side mixes three openers: "Couldn't…" (medications, tasks, appointments, visits), "We couldn't…" (recipientProfile, doctors, emergencyContacts, circleMembers, invitations), and "Could not…" (auth, account, pulse, notificationSettings). All are on-voice, but a redesign is a chance to standardize the English opener.

### 4.2 The empty-state shape — a calm, "good news" framing
Empty states never read as a lack; they read as calm or as an invitation. Each feature ships a title + subtitle pair. Quote both locales:

> **Which key actually renders (accuracy note):** the table below lists *all* empty‑state copy that exists in the locale files, but for some lists **two** competing keys exist — a canonical one (`tasks.noTodayTitle`, `appointments.noTodayTitle`, `visits.noUpcomingTitle`, `doctors.emptyTitle`, …) **and** a `figma.*` one (`figma.tasks.empty`/`emptyMine`, `figma.appointments.emptyUpcoming`, `figma.visits.emptyUpcoming`, `figma.doctors.emptyTitle`). Per the feature sections (§05–§12), the **shipping screens currently render the `figma.*` variant**, and several of the canonical `*.noTodayTitle`/`emptyTitle` keys are **dead copy** left over from the pre‑Figma build. A redesigner/copywriter should **reconcile each pair onto one key** and delete the unused twin — do not spec both.

| Key | Arabic title / subtitle | English title / subtitle |
|---|---|---|
| `tasks.noTodayTitle` / `noTodaySubtitle` | «يوم هادئ» / «لا مهام مستحقّة اليوم — كل شيء تحت السيطرة.» | "A calm day" / "No tasks due today — everything's under control." |
| `tasks.noOpenTitle` / `noOpenSubtitle` | «لا مهام مفتوحة حاليًا» / «لا مهام بانتظار الإنجاز الآن. أضف مهمة عند الحاجة.» | "No open tasks right now" / "No tasks waiting to be done right now. Add one whenever you need." |
| `medications.noDosesTitle` / `noDosesSubtitle` | «لا جرعات اليوم» / «يوم هادئ — لا مواعيد دواء مجدولة لهذا اليوم» | "No doses today" / "A calm day — no medication times scheduled for today" |
| `medications.noMedsTitle` / `noMedsSubtitle` | «لا أدوية بعد» / «يمكن إضافة دواء وموعده للبدء» | "No medications yet" / "Add a medication and its schedule to get started" |
| `appointments.noTodayTitle` / `noTodaySubtitle` | «لا مواعيد اليوم» / «لا مواعيد مجدولة اليوم — يوم هادئ.» | "No appointments today" / "Nothing scheduled today — a calm day." |
| `visits.noUpcomingTitle` / `noUpcomingSubtitle` | «لا زيارات قادمة» / «يمكن إضافة زيارة قادمة عند التخطيط لها» | "No upcoming visits" / "Add an upcoming visit whenever you plan one" |
| `vitals.noTodayTitle` / `noTodaySubtitle` | «لا قياسات اليوم» / «يمكن إضافة قياس جديد عند توفّره» | "No readings today" / "Add a new reading when you have one" |
| `dailyLogs.noTodayTitle` / `noTodaySubtitle` | «لا سجلات لهذا اليوم» / «يمكن إضافة سجل لمتابعة حال اليوم» | "No logs for today" / "Add a log to note how today is going" |
| `doctors.emptyTitle` / `emptySubtitle` | «لا أطباء بعد» / «يمكن إضافة طبيب لتظهر عيادته ورقمه هنا عند الحاجة.» | "No doctors yet" / "Add a doctor to keep their clinic and number close at hand." |
| `emergencyContacts.emptyTitle` / `emptySubtitle` | «لا جهات اتصال بعد» / «يمكن إضافة جهة اتصال للطوارئ لتكون في متناولك عند الحاجة.» | "No contacts yet" / "Add an emergency contact so it's ready when you need it." |
| `invitations.emptyTitle` / `emptySubtitle` | «لا دعوات بعد» / «يمكن إنشاء دعوة لانضمام فرد من العائلة أو مقدّم رعاية إلى الدائرة.» | "No invitations yet" / "Create an invitation to bring a family member or caregiver into the circle." |
| `notifications.emptyTitle` / `emptySubtitle` | «لا توجد إشعارات» / «ستظهر هنا التذكيرات والتحديثات.» | "No notifications" / "Reminders and updates will appear here." |
| `pulse.empty` | «يوم هادئ — لا جديد حتى الآن» | "A calm day — nothing new yet" |
| `claiming.empty` | «لا عناصر بانتظار من يتكفّل بها الآن» | "Nothing is waiting for someone to take it on right now" |
| `figma.tasks.empty` / `emptyMine` | «لا مهام الآن — كل شيء على ما يُرام» / «لا مهام مُسندة إليك حالياً» | "No tasks right now — everything's in order" / "No tasks assigned to you right now" |
| `figma.appointments.emptyUpcoming` | «لا مواعيد قادمة — الجدول خالٍ الآن» | "No upcoming appointments — the calendar is clear for now" |
| `figma.visits.emptyUpcoming` | «لا زيارات قادمة — لا شيء مُخطَّط بعد» | "No upcoming visits — nothing planned yet" |

Notice the recurring softeners: «بعد» / "yet" (nothing wrong, just not *yet*), «يوم هادئ» / "a calm day", and the invitation «يمكن إضافة…» / "Add … whenever you need".

### 4.3 The quiet-celebration shape
| Key | Arabic | English |
|---|---|---|
| `medications.saved` / `tasks.saved` / etc. | «تم حفظ التغييرات» | "Changes saved" |
| `careCircle.dashboard.today.loopAllDone` | «اكتملت جرعات اليوم» | "Today's doses are complete" |
| `figma.medications` doses done (`careCircle...tileMedsDone`) | «اكتملت» | "All done" |
| `careCircle.dashboard.today.allDosesGiven` | «جميع الجرعات أُعطيت» | "All doses given" |
| `circleMembers.roleSaved` | «تم تحديث الدور» | "Role updated" |
| `joinCircle.successTitle` / `successSubtitle` | «تم انضمامك» / «انضممت إلى دائرة الرعاية وتم اختيارها الآن.» | "You're in" / "You've joined the care circle and it's now selected." |

No exclamation marks, no emoji, no "Congratulations!". Just a plain fact of care completed.

### 4.4 The confirmation-copy shape
Mutations are guarded by one of three sanctioned patterns (see the project's confirmation-pattern decision). The copy always poses a neutral question (title) + a plain consequence (body). Samples:

| Key | Arabic | English |
|---|---|---|
| `tasks.confirmCompleteTitle` / `Body` | «تأكيد إنجاز المهمة؟» / «هل تريد تعليم هذه المهمة كمُنجَزة؟» | "Mark task complete?" / "Mark this task as completed?" |
| `tasks.confirmUnableTitle` / `Body` | «تأكيد تعذّر إنجاز المهمة؟» / «هل تريد تسجيل هذه المهمة كمتعذّرة الإنجاز؟» | "Mark task as not completed?" / "Record this task as not completed?" |
| `medications.confirmDeactivateTitle` / `Message` | «إيقاف الدواء؟» / «ستتوقّف تذكيرات هذا الدواء حتى تعيد تفعيله.» | "Deactivate medication?" / "Reminders for this medication will stop until you reactivate it." |
| `account.confirmSignOutTitle` / `Message` | «تسجيل الخروج؟» / «سيتوقّف هذا الجهاز عن تلقّي التذكيرات حتى تسجّل الدخول مجدداً.» | "Sign out?" / "This device will stop receiving reminders until you sign in again." |
| `circleMembers.leaveConfirmTitle` / `Body` | «مغادرة الدائرة» / «لن تعود ترى بيانات هذه الدائرة بعد مغادرتها. يمكن لأحد المديرين دعوتك مجدّدًا.» | "Leave circle" / "You'll no longer see this circle's data after leaving. A manager can invite you again." |
| `common.unsavedTitle` / `unsavedMessage` | «تغييرات غير محفوظة» / «لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟» | "Unsaved changes" / "You have unsaved changes. Leave without saving?" |

Note the destructive-but-reversible framing: leaving/removing always adds «يمكن … دعوتك/دعوته مجدّدًا» ("can invite you/them again"), so no action reads as permanent doom.

### 4.5 The permission / read-only shape
Gating copy states the fact plainly without scolding:

| Key | Arabic | English |
|---|---|---|
| `medications.readOnly` (and per-feature `readOnly`) | «للعرض فقط — لا تملك صلاحية التعديل» | "View only — you don't have permission to edit" |
| `medications.managersOnly` | «إضافة الأدوية متاحة للمشرف ومقدّم الرعاية الأساسي فقط» | "Only the admin and primary caregiver can add medications" |
| `tasks.managersOnly` | «إضافة المهام متاحة للمشرف ومقدّم الرعاية الأساسي فقط» | "Only the admin and primary caregiver can add tasks" |
| `tasks.statusOnly` | «يمكنك تحديث حالة المهمة فقط» | "You can update the task status only" |
| `visits.cannotAdd` | «تسجيل الزيارات متاح لأعضاء دائرة الرعاية النشطين» | "Recording visits is available to active care circle members" |
| `claiming.notAllowed` | «التكفّل غير متاح لدورك» | "Claiming isn't available for your role" |
| `invitations.managersOnly` | «إدارة الدعوات متاحة للمشرف ومقدّم الرعاية الأساسي فقط» | "Only the admin and primary caregiver can manage invitations" |
| `circleMembers.errors.notAllowed` | «لا تملك صلاحية تنفيذ هذا الإجراء.» | "You don't have permission to do that." |

### 4.6 The medical/legal disclaimer shape (meaning-locked — do NOT warm)
These are deliberately literal and cautious; they cap medico-legal exposure and must not be softened or shortened.

| Key | Arabic | English |
|---|---|---|
| `medications.disclaimer` | «يسجّل التطبيق مواعيد الأدوية التي تُدخلها العائلة وتذكيرات بها فقط، ولا يقدّم أي نصيحة طبية.» | "The app only records the medication schedules and reminders your family enters. It does not provide medical advice." |
| `vitals.disclaimer` | «قياسات تُدخلها العائلة للحفظ والمتابعة فقط، وليست تشخيصًا أو نصيحة طبية، ولا يُفسّر التطبيق القيم.» | "Readings entered by the family for recording and tracking only. They are not a diagnosis or medical advice, and the app does not interpret the values." |
| `dailyLogs.disclaimer` | «ملاحظات يومية تُدخلها العائلة لمتابعة الحالة فقط، وليست تشخيصًا أو نصيحة طبية.» | "Daily observations recorded by the family to follow the condition only. They are not a diagnosis or medical advice." |
| `emergencyCard.disclaimer` | «هذه المعلومات مُدخلة من العائلة للعرض فقط، وليست نصيحة أو تشخيصًا طبيًا.» | "This information is entered by the family for reference only and is not medical advice or diagnosis." |
| `tasks.disclaimer` | «تنظيم وتنسيق مهام الرعاية بين أفراد العائلة فقط، دون أي نصيحة طبية.» | "For organizing and coordinating care tasks among the family only. It does not provide medical advice." |
| `appointments.disclaimer` | «تنظيم مواعيد الرعاية وتنسيقها بين أفراد العائلة فقط، دون أي نصيحة طبية.» | "For organizing and coordinating care appointments among the family only. It does not provide medical advice." |
| `visits.disclaimer` | «تنظيم زيارات العائلة وتنسيقها فقط، دون أي نصيحة طبية.» | "For organizing and coordinating family visits only. It does not provide medical advice." |
| `figma.emergency.viewOnly` | «للاطلاع فقط — ليست خدمة طوارئ» | "For reference only — not an emergency service" |

### 4.7 The security-warning shape (invitations / join)
Warnings about sharing a sensitive invite code are direct but not alarmist:

| Key | Arabic | English |
|---|---|---|
| `invitations.warning` | «أي شخص يملك هذا الرمز يمكنه الانضمام إلى الدائرة والاطّلاع على معلومات رعاية حسّاسة. شاركه فقط مع من تثق بهم.» | "Anyone with this code can join the circle and see sensitive care information. Share it only with people you trust." |
| `invitations.codeOnceWarning` | «يظهر هذا الرمز الآن فقط ولا يمكن استرجاعه لاحقًا. إذا فُقد، ألغِ الدعوة وأنشئ واحدة جديدة.» | "This code is shown only now and can't be retrieved later. If it's lost, revoke it and create a new one." |
| `joinCircle.warning` | «أدخل فقط رمزًا استلمته من شخص تثق به. فهو يمنح الوصول إلى معلومات رعاية حسّاسة.» | "Only enter a code you received from someone you trust. It gives access to sensitive care information." |

---

## 5. i18n namespace map

`ar.json` and `en.json` share one flat set of top-level namespaces (plus four root-level keys). Every namespace covers one feature/domain. The table below lists every top-level namespace, what it covers, and where in this report suite the matching screens are documented.

| Namespace | Covers | Related report section |
|---|---|---|
| *(root)* `appName`, `loading`, `retry`, `error` | Brand name «سند»/"Sanad", global spinner «جارٍ التحميل…»/"Loading…", global retry, generic error. | all |
| `common` | Shared button/label atoms: edit, details, delete, call, confirmDelete, cancel, save, saveChanges, close, back, add, ok, yes, no, and the unsaved-changes guard (unsavedTitle/Message, discardChanges, keepEditing). | all |
| `validation` | Generic field validation fallbacks: tooLong, generic. | forms everywhere |
| `home` | Home landing greeting/tagline + three placeholder feature cards (careCircle, tasks, reminders), comingSoon. | 02-navigation-and-home |
| `careCircle` | The largest namespace. Onboarding (create circle), the dashboard (section cards for all features), and the rich `today` block (care-loop ring, next dose, today's appointment/tasks tiles, emergency preview, quick actions). Also `manageTitle`, `careTeamTitle`, `quickAccessTitle`. | 02, 12 |
| `circleSwitcher` | Circle switch sheet: switch, chooseTitle, current. | 02 / 10 |
| `circleMembers` | Member roster, role labels + descriptions, role-change flow, capabilities (can/cannot lists per role), remove/leave/make-owner confirmations, member status. | 10-members-and-invitations |
| `invitations` | Create/share/revoke invite codes, WhatsApp + generic share messages, invite status enum, managersOnly gate. | 10 |
| `joinCircle` | Join-by-code screen: fields, submit, warning, success, and the full error enum (required/alreadyMember/expired/revoked/used/invalid/generic). | 01 / 10 |
| `recipientProfile` | Care-recipient profile form: personal + medical sections, fields, placeholders, save/read-only states. | 12-emergency-doctors-recipient |
| `emergencyContacts` | Emergency contact list + add/edit form, primaryBadge. | 12 |
| `doctors` | Doctors list + add/edit form. | 12 |
| `emergencyCard` | Read-only emergency card: recipient, medical, contacts, doctors sections + disclaimer. | 12 |
| `medications` | Medications list, today's doses, add/edit medication + dose-schedule sub-forms, activate/deactivate confirmations, dose-status enum, weekday names (long + short), weekly summary. | 04-medications |
| `assignment` | Shared assignment vocabulary (responsible, none, me, assignedToMe, inactiveMember, unassigned, nameWithRole). | 05, 11 |
| `claiming` | The "available to claim" surface + «أنا متكفّل» CTA, confirm, success/already-claimed/failed, section labels. | 11-claiming |
| `tasks` | Tasks list (today/open/done), add/edit form, complete/cancel confirmations, category/priority/status enums, summary. | 05-tasks |
| `appointments` | Appointments list (today/upcoming), add/edit form, complete/cancel, type + status enums, summary. | 06-appointments |
| `visits` | Family visits list (today/upcoming/recent), add/edit, link-to-member/self, status enum. | 07-visits |
| `dailyLogs` | Daily observation logs: add/edit form with mood/sleep/appetite/hydration/pain/mobility enums + notes, summary, disclaimer. | 09-daily-logs |
| `vitals` | Vital readings list + add/edit, measurement-type enum, BP systolic/diastolic vs single-value fields. | 08-vitals |
| `pickers` | Shared date/time picker chrome: setDate/setTime, year/month/day/hour/minute/period, am/pm, done, clear. | forms everywhere |
| `explore` | Explore tab: title/subtitle + three "coming soon" cards (guides, resources, community). | 03-explore-and-account |
| `tabs` | Bottom-tab labels: home, explore, account. | 02 |
| `auth` | Sign-in/up, forgot/reset password, field labels + placeholders, show/hide password, brand, full error enum. | 01-auth-and-onboarding |
| `account` | Account tab: signed-in identity, edit name, circles section, notifications section, join-another, sign-out + confirm. | 03 |
| `circleTimezone` | Care-circle timezone screen + picker: explain, manager-only, IANA field, device shortcut, confirm-change, search. | 03 / settings |
| `pulse` | Care Pulse activity feed: title/subtitle, section, share (header/empty), empty, load error, per-event templates (dose/task/appointment/visit/vital/log/member events). | 02 (pulse) |
| `notifications` | Notification center: open/mark-read, empty, enable prompt, action buttons (done/snooze), notification type labels, filters. | notifications |
| `notificationSettings` | Full settings screen: missed-dose grace stepper, scope (global/circle), 9 toggle rows, quiet hours, timezone, on-device test, push-enable explain/privacy/results. | notifications settings |
| `figma` | **Legacy/parallel namespace** from the Figma redesign era, still live for some redesigned screens (explore grid, account version, medications summary tabs, emergency card, notifications, tasks tabs+scope, appointments tabs, vitals, doctors, members legend, dailylogs, visits tabs). Contains a few terminology drifts flagged in §3. A redesigner should plan to fold canonical concepts here back onto the primary namespaces. | multiple |

### Key parity
Both files are **1445 lines** and structurally identical; every documented key resolves in both locales. Arabic is authoritative; English mirrors it 1:1. Any redesign that adds a string **must** add the same key path to both files (the standing decision calls this "exact key parity"). Interpolation tokens (`{{name}}`, `{{count}}`, `{{given}}`, `{{total}}`, `{{time}}`, `{{tz}}`, `{{status}}`, `{{title}}`, `{{actor}}`, `{{vital}}`, `{{day}}`, `{{from}}`, `{{to}}`, …) are identical across locales and must be preserved verbatim.

---

## 6. Shared / common strings quick reference

The atoms a redesigner will place most often, from `common.*`, root, and `pickers.*`:

| Key | Arabic | English |
|---|---|---|
| `appName` | «سند» | "Sanad" |
| `loading` | «جارٍ التحميل…» | "Loading…" |
| `retry` | «إعادة المحاولة» | "Retry" |
| `error` | «تعذّر إتمام العملية. تحقّق من الاتصال وحاول مجددًا.» | "Couldn't complete that. Check your connection and try again." |
| `common.save` | «حفظ» | "Save" |
| `common.saveChanges` | «حفظ التغييرات» | "Save changes" |
| `common.cancel` | «إلغاء» | "Cancel" |
| `common.delete` | «حذف» | "Delete" |
| `common.confirmDelete` | «تأكيد الحذف» | "Confirm delete" |
| `common.edit` | «تعديل» | "Edit" |
| `common.details` | «التفاصيل» | "Details" |
| `common.call` | «اتصال» | "Call" |
| `common.close` | «إغلاق» | "Close" |
| `common.back` | «رجوع» | "Back" |
| `common.add` | «إضافة» | "Add" |
| `common.ok` | «حسنًا» | "OK" |
| `common.yes` / `common.no` | «نعم» / «لا» | "Yes" / "No" |
| `common.unsavedTitle` | «تغييرات غير محفوظة» | "Unsaved changes" |
| `common.unsavedMessage` | «لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟» | "You have unsaved changes. Leave without saving?" |
| `common.discardChanges` | «تجاهل التغييرات» | "Discard changes" |
| `common.keepEditing` | «متابعة التعديل» | "Keep editing" |
| `validation.tooLong` | «النص طويل جدًا» | "This text is too long" |
| `validation.generic` | «قيمة غير صحيحة» | "Invalid value" |
| `pickers.done` | «تم» | "Done" |
| `pickers.clear` | «مسح» | "Clear" |
| `pickers.setDate` / `setTime` | «اختر التاريخ» / «اختر الوقت» | "Choose date" / "Choose time" |
| `pickers.am` / `pm` | «صباحًا» / «مساءً» | "AM" / "PM" |

Note that the two "confirm delete" phrasings differ by feature: the generic `common.confirmDelete` = «تأكيد الحذف», while specific rows use their own verb (`circleMembers.confirmRemove` = «تأكيد الإزالة» / "Confirm removal", `invitations.confirmRevoke` = «تأكيد الإلغاء» / "Confirm revoke"). This is deliberate — the confirm verb matches the row's action verb.

---

## Workflows

These are copywriting/localization workflows a redesigner or copywriter follows when touching Sanad's language layer.

### Workflow A — Add a new user-facing string
1. Identify the feature namespace it belongs to (§5). Reuse an existing sub-key pattern (`fields`, `placeholders`, `errors`, `status`, `summary`) rather than inventing a new shape.
2. Write the **Arabic** value first, in the calm-family-warmth voice (§1): Simple MSA, gender-neutral, short, no exclamation, no emoji.
3. Add the **exact same key path** to `en.json` with a faithful English mirror. Both files must stay at exact key parity — a key in one but not the other is a defect.
4. If it's an error, use the «تعذّر … . تحقّق من الاتصال وحاول مجددًا.» shape (§4.1). If an empty state, use the "good news / بعد / يوم هادئ" shape (§4.2). If a confirmation, use the neutral-question + plain-consequence shape (§4.4).
5. Preserve interpolation tokens identically across locales.
6. Reference the key in the component via the i18n `t()` function — **never** hardcode the Arabic/English literal in the component.

### Workflow B — Add or change a status/enum label
1. Check the glossary (§3) first. If the concept already has a canonical term (task open = «مفتوحة», medication active = «فعّال», no-assignee = `assignment.none`), reuse it — do **not** introduce a synonym («معلقة», «نشط», «موقوف» for a medication, a per-feature "none").
2. Status is never color-only in the UI — the label always pairs with an icon (see the design-system sections). The copy layer only owns the text.
3. If the concept is genuinely new, add it under the feature's `status`/`type`/`category` sub-object in both locales, and add it to this glossary.

### Workflow C — Render a member's name
1. Never write the name literal. Call `memberDisplayName(member, fallback)` (§2).
2. Pass a neutral fallback from i18n (`circleMembers.unnamed` = «عضو», or `assignment.unknownMember`). Never pass a hardcoded «عضو».
3. Never surface a raw email — the helper already reduces to the local-part; broadcast surfaces (Pulse, share text) rely on that.
4. For the current user use «أنت»/`circleMembers.you`; for self-assignment «أنا»/`assignment.me`.

### Workflow D — Write a destructive/mutating confirmation
1. Pick the sanctioned confirmation pattern for the action class (confirmAction prompt / inline two-step / bottom-sheet confirm — per the project confirmation-pattern decision).
2. Title = a neutral question («إيقاف الدواء؟», «تسجيل الخروج؟»). Body = the plain consequence, and where the action is reversible, add the reassurance («يمكن دعوتك مجدّدًا», «حتى تعيد تفعيله»).
3. Never use «فشل» or «خطأ»; on failure surface a «تعذّر …» alert (`accessibilityRole="alert"`) — never revert silently.
4. Mirror the title + body into `en.json`.

### Workflow E — Localize a disclaimer or password/meaning-locked rule
1. Do **not** apply the warmth transform. These strings are meaning-locked (§4.6, §1 exception).
2. Keep the literal, cautious wording; if a warmer phrasing risks changing medical/legal meaning or a precise rule, leave it and flag it in the session report rather than guessing.
3. Still ensure ar/en parity and identical tokens.

### Workflow F — Audit ar/en parity before shipping copy
1. Confirm both files have identical key trees (they are currently 1445 lines each, structurally mirrored).
2. Confirm every `{{token}}` present in the Arabic value is present in the English value and vice-versa.
3. Confirm no exclamation marks or emoji were introduced in either locale (both are currently at zero).
4. Reconcile any `figma.*` term against its canonical primary-namespace equivalent (§3 flags: `figma.medications.inactive` English "Stopped" vs canonical "Inactive"); prefer folding onto the canonical key.
