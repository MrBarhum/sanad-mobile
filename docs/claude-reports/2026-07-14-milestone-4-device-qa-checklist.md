# Milestone 4 — Device QA Checklist (additive)

On-device verification for what code + typecheck can't prove. Run after the runbook is applied. Prefer a real Android device (Samsung) + at least one second device for role/notification tests. This is **additive** to prior phase QA — it only covers Milestone 4 surfaces.

## A1 — Visibility & roles
- [ ] Tasks list shows the **«مهامي / كل المهام»** toggle; collaborator defaults to "mine", manager to "all"; toggling reveals the full circle list.
- [ ] An unassigned open task shows **«أنا متكفّل»** for a claim-capable member; tapping confirms, then the task becomes "assigned to me"; a second device claiming first shows the "already claimed" sheet.
- [ ] Create-task and edit-task assignee pickers offer the **same** members (active doers), one «أنا» chip, one «no assignee» label.

## A2 — Names
- [ ] Sign-up requires a name; the name shows in Account and across the roster/pickers/Pulse.
- [ ] Account name edit persists after reload; a member without a name shows their email local-part (never a bare «عضو»).

## A3 — Dose correction
- [ ] A logged dose (Home + meds Today) reopens via **«تعديل الحالة»**; changing the status asks to confirm; the new status persists.

## A4 — Confirms + errors
- [ ] Confirm prompts appear for: sign-out, claim, medication activate/deactivate, schedule activate/deactivate.
- [ ] With the network off, medication toggle/delete, schedule actions, and daily-log/vital delete each show an error (no silent revert).

## A5 — Readability
- [ ] A long medication name wraps to two lines and never truncates (Home doses, meds Today + list); dosage sits on its own line.

## A6 — Password reset (end-to-end — the key runtime unknown)
- [ ] Sign-in → «نسيت كلمة المرور؟» → enter email → confirmation shown.
- [ ] The recovery email link opens the app at `/reset-password` (deep link delivered) — test **cold start** and **app already open**.
- [ ] Setting a new password succeeds and you can sign in with it.
- [ ] Expired/garbled link → the "invalid link" state with a "request new link" action.
- [ ] Web (if hosted): the same flow via the web redirect URL.

## A7 — Ordering
- [ ] Home quick-actions read meds → tasks → appointments → vitals → visits → logs → doctors → members (RTL: meds top-right).
- [ ] An urgent/overdue task sorts above calmer ones; unlogged doses lead the dose lists.

## A8 — i18n / terminology
- [ ] Notification action buttons + snooze/done confirmations render Arabic from i18n (no mojibake).
- [ ] Task "open" reads «مفتوحة» and medication active reads «فعّال» everywhere.

## A9 — Correctness
- [ ] Cancelling a task records who cancelled it (verify `cancelled_by` in the row); reopen clears it.
- [ ] Marking one emergency contact primary demotes the previous primary (only one primary remains).

## B1 — Care Pulse
- [ ] `/pulse` lists recent events with the right icon, resolved actor name, and bidi time; tapping a row deep-links to the source item.
- [ ] Home shows the 5-item Pulse strip + «عرض الكل»; empty/quiet circle shows nothing on Home (no error).
- [ ] Load-more fetches older events.
- [ ] Before the migration is applied, `/pulse` shows the "not enabled" message (not a crash).

## B2 — Daily digest (needs the function deployed + cron scheduled)
- [ ] A **remote member with the daily summary enabled** receives ONE push at ~20:00 **their local time**; tapping opens `/pulse`.
- [ ] Re-running the function the same day does not double-send (dedupe).
- [ ] A non-remote member and an opted-out remote member receive nothing.
- [ ] A calm day still yields the gentle "nothing to report" digest.

## B3 — Missed-dose escalation (needs the function deployed + cron scheduled)
- [ ] Managers see the grace stepper on notification-settings; non-managers don't; the value persists.
- [ ] With grace = G: the **responsible** person gets the "not recorded" alert ~G min after a skipped dose; **managers** get the tier-3 alert ~2×G min after (assigned med only).
- [ ] Logging the dose before the threshold suppresses the alert (no false positive).
- [ ] `missed_dose_alerts` off / quiet hours are respected.

## B4 — WhatsApp invites + share
- [ ] Invite "created" screen: **«مشاركة عبر واتساب»** opens WhatsApp pre-filled with the Arabic message + code + link; with WhatsApp uninstalled it falls back to the OS share sheet; copy-code still works.
- [ ] Tapping the invite link on a device with the app opens `/join-circle` with the code pre-filled.
- [ ] «مشاركة ملخص اليوم» (on `/pulse` and Home) opens the share sheet with today's summary text.

## B5 — Bell badge
- [ ] With unread notifications, the Home bell shows the count ("9+" past 9); reading them clears it; the a11y label announces the count.

## Cross-cutting
- [ ] RTL + Arabic render correctly on all new surfaces (Pulse, forgot/reset password, grace stepper).
- [ ] No mojibake anywhere in the new UI.
- [ ] Light + dark mode both legible on the new surfaces.
