# Form CTAs rendered in the body (drop the FigmaFormScreen `footer` prop path)

**Date:** 2026-06-19
**Type:** Architecture change for the shared form shell. Edit only — **no commit, no stage.**
**Decision:** Stop routing form submit CTAs through `FigmaFormScreen`'s `footer` prop. Render each primary CTA **directly as the final child inside the form body** (the ScrollView content), which is the region empirically proven to render on the Android device.

## Why the `footer` prop was abandoned for form CTAs

Runtime probes on the Android dev client established:
- The device receives the latest JS bundle, and `/tasks/new` mounts `TaskForm`.
- A temporary marker placed **inside the TaskForm body** appeared on device → **body/ScrollView content is visible.**
- CTA markers passed through the `FigmaFormScreen` **`footer` prop did not appear** — in **every** arrangement tried: footer inside the `KeyboardAvoidingView`, footer as a root sibling after the `KeyboardAvoidingView`, and footer rendered inside the ScrollView via the prop.

Since the `footer` prop path is unreliable on this device but **body content is reliably visible**, the pragmatic, low-risk fix is to put the CTA where content is proven to render: inline in the form body as the last visible child. No more fighting pinned/sticky/KAV footer layout. Trade-off (accepted per task): on long forms the user scrolls to the bottom to reach the CTA.

## What changed — CTA now rendered inside the visible form body

For every `FigmaFormScreen`-based form, the `footer={…}` prop was removed and the **same CTA block** (the `FigmaFooterPrimaryButton`, plus its inline submit-error / save-status text where present) is now the **final child of the screen body**, inside the ScrollView content:

```jsx
<FigmaFormScreen title={…} onBack={…}>
  …form cards / fields…

  {/* Primary CTA — rendered directly in the body, NOT via the footer prop */}
  <View style={styles.footer}>
    {submitError ? <Text …>{submitError}</Text> : null}
    <FigmaFooterPrimaryButton label={t('…add')} onPress={onSubmit} loading={submitting} />
  </View>
</FigmaFormScreen>
```

Requirement coverage:
- **CTA is the final body child** — placed after the last card/field (after the destructive delete card in the two editors, matching the prior bottom-of-screen placement).
- **Spacing above** — the ScrollView content container's `gap: Spacing.three` (16) separates the CTA from the card above.
- **Spacing below / Android nav-safe-area** — `FigmaFormScreen`'s ScrollView `contentContainerStyle` now adds `paddingBottom: insets.bottom + Spacing.four`, so the body CTA clears the gesture/navigation bar at the bottom of the scroll.
- **Full-width** — the CTA `View` stretches (column `alignItems:'stretch'`); `FigmaFooterPrimaryButton` is `width:'100%'`.
- **Part of the normal ScrollView content** — yes; it is a sibling of the form cards.

### Button visual & behavior — unchanged
`FigmaFooterPrimaryButton` is **kept as-is** (no rename, no new component, no new colors): the filled Sanad-teal, ≈56dp, rounded rectangle with a high-contrast `theme.onPrimary` Cairo-bold label. It takes no `disabled`/`variant`/`style` prop, so:
- CTA is always a visible filled teal rectangle (no faint/disabled/text-only state for validation-incomplete forms).
- It is pressable when idle; pressing an incomplete form runs the caller's `onSubmit`, which validates and shows inline field errors instead of submitting.
- `loading`/`submitting` shows a spinner and blocks double-submit.

### FigmaFormScreen `footer` prop — kept, not deleted
The optional `footer?` prop and its render block remain in `FigmaFormScreen` (now unused by these forms). Per the task, it is **not deleted yet** — TypeScript does not flag an unused optional prop, so removal isn't "proven safe" by the compiler. The shared change to `FigmaFormScreen` this task is only the ScrollView `paddingBottom` safe-area addition.

### Add Doctor / FormModal — untouched
`FormModal` (used by Add/Edit Doctor and Emergency Contact) does **not** use the `FigmaFormScreen` footer prop — it already renders `FigmaFooterPrimaryButton` inside its own modal ScrollView body. There is no device evidence it is invisible, and the task says not to change modal behavior unless it uses the same invisible footer path. **Left unchanged.**

## Exact files changed
**Forms — `footer` prop removed; CTA moved into the body (final child):**
1. `src/features/tasks/task-form.tsx` — CTA `t('tasks.add')` after the Notes card.
2. `src/features/appointments/appointment-form.tsx` — CTA `t('appointments.add')` after the fields.
3. `src/features/visits/visit-form.tsx` — CTA `t('visits.add')` after the visit card.
4. `src/features/vitals/vital-form.tsx` — CTA `t('vitals.add')` after the fields.
5. `src/features/daily-logs/log-form.tsx` — CTA `t('dailyLogs.add')` after the fields.
6. `src/features/medications/medication-form.tsx` — CTA `t('medications.add')` after the Notes card.
7. `src/features/invitations/invite-form.tsx` — CTA `t('invitations.create')` after the error block (the `/circle-members/invite` screen).
8. `src/features/daily-logs/log-editor.tsx` — Save CTA `t('common.saveChanges')` after the delete card (ported daily-log edit screen).
9. `src/features/vitals/vital-editor.tsx` — Save CTA `t('common.saveChanges')` after the delete card (ported vital edit screen).

**Shared shell:**
10. `src/components/figma/figma-form-screen.tsx` — ScrollView `contentContainerStyle` now adds `paddingBottom: insets.bottom + Spacing.four`; the `footer` prop/render block is retained (now unused).

**Not changed:** `src/components/figma/figma-footer-primary-button.tsx` (absent from the diff), `src/components/form-modal.tsx`, route files, backend, hooks, schemas, navigation, pickers, chips, role cards, the Figma MCP audit report, EAS, dependencies.

## Confirmations
- **CTAs render inside the visible form body** — confirmed: `git grep -n "footer={" -- <the 9 forms>` → **exit 1 (no matches)**; each form now contains a body `FigmaFooterPrimaryButton` after its last card/field.
- **No temporary markers remain** — `git grep -nE "CTA_RUNTIME_TEST_123|TASK_FORM_BODY_RUNTIME_TEST_456|FF1FA2" -- src` → **exit 1 (no matches)**.
- **`/tasks/new` should show "إضافة مهمة"** as a filled green button after the last form card (the Notes card), inside the scroll content — scroll to the bottom to reach it.
- **Other form screens use the same body-rendered CTA pattern** — medication/appointment/visit/vital/daily-log add screens, the invite screen, and the ported vital/daily-log edit screens all now render their CTA inline in the body via the unchanged `FigmaFooterPrimaryButton`.

## Validation results
| Check | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run check:mojibake` | **clean** — 260 active files, no mojibake |
| `git -c core.autocrlf=false diff --check` | **exit 0** |
| marker sweep (`git grep -E` of the 3 temp tokens) | **exit 1** — none present |
| `footer={` sweep over the 9 forms | **exit 1** — none remain |

## Git state
Not committed, not staged, no `git add`, no reset/restore/clean. Working tree only; the sole file added by this task (besides the edits) is this report.
