# Fix `FigmaFooterPrimaryButton` — plain Pressable implementation

**Date:** 2026-06-19
**Type:** Component fix + revert of the runtime test. Edit only — **no commit, no stage.**

## Root-cause conclusion from the raw Pressable test
A bare React Native `Pressable` placed directly after the Notes card in `/tasks/new` **rendered correctly on Android**, while the previous `FigmaFooterPrimaryButton` in the *same* visible body location **did not appear**. That isolates the failure to the **`FigmaFooterPrimaryButton` implementation itself** — not `FigmaFormScreen`, not Metro/cache, not the route, not MCP.

Comparing the two, the previous implementation carried several extras the proven raw button did not:
- a **function-form `style={({ pressed }) => [...]}`**,
- **`overflow: 'hidden'`** on the Pressable,
- **`numberOfLines={1}`** on the label,
- a custom **`fontFamily: FigmaFont.bold`** (Cairo) instead of a plain numeric `fontWeight`.

Any/all of these distinguished the broken button from the proven raw one. The fix removes all of them and renders the exact plain-Pressable shape proven to display on device.

## Exact files changed
1. **`src/components/figma/figma-footer-primary-button.tsx`** — reimplemented as a plain `Pressable` mirroring the proven raw button. *(This file is **untracked** (`??`), so it appears in `git status` but not in `git diff` vs HEAD; its full new content is included below.)*
2. **`src/features/tasks/task-form.tsx`** — removed the temporary raw test button and restored the real `FigmaFooterPrimaryButton` CTA in the body.

No other files were modified by this task. (Other `M` entries in `git status` are pre-existing working-tree changes from earlier steps.)

## Confirmation: `FigmaFooterPrimaryButton` now uses a plain Pressable
New implementation (full file):

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

type FigmaFooterPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  accessibilityHint?: string;
};

export function FigmaFooterPrimaryButton({ label, onPress, loading = false, accessibilityHint }: FigmaFooterPrimaryButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}
      style={[styles.button, { backgroundColor: theme.primary }]}>
      {loading ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : (
        <Text style={[styles.label, { color: theme.onPrimary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 64,
    borderRadius: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
```

- **Plain object `style`** (no function form), **no `overflow:'hidden'`**, **no `numberOfLines`**, **no custom `fontFamily`** — exactly the proven raw shape.
- **Style values per spec:** `backgroundColor: theme.primary` (Sanad teal — `#4BA898` dark / `#2E8A7B` light), `minHeight: 64`, `borderRadius: 18`, `paddingHorizontal: 20`, `alignItems:'center'`, `justifyContent:'center'`, `width:'100%'`; label `color: theme.onPrimary` (#FFFFFF on the teal), `fontSize: 16`, `fontWeight: '800'`, `textAlign:'center'`.
- **Spacing:** the component adds **no** `marginTop`/`marginBottom` — spacing stays at the call sites (the forms render it after the last card; `FigmaFormScreen`'s ScrollView provides the bottom safe-area padding). This keeps the shared button spacing-neutral.
- **Public props preserved:** `label`, `onPress`, `loading`, `accessibilityHint`; plus `accessibilityRole`/`accessibilityLabel`/`accessibilityState` as before. No prop signature change, so all existing call sites compile unchanged (`tsc` exit 0).
- **Loading:** `loading` shows a high-contrast `ActivityIndicator` (`theme.onPrimary`) and sets `disabled={loading}` to block double-submit.
- **No disabled/faint state for validation-incomplete forms:** the button never greys; `disabled` is driven only by `loading`. Validation stays in each caller's submit handler.

## Confirmation: `/tasks/new` no longer contains the raw test button
- `git grep -nE "RAW_GREEN_TASK_BUTTON_VISIBLE_TEST|CTA_RUNTIME_TEST_123|TASK_FORM_BODY_RUNTIME_TEST_456|FF1FA2" -- src` → **exit 1 (no matches)**.
- The temporary `<Pressable>`, its `RAW_GREEN_TASK_BUTTON_VISIBLE_TEST` text, the `#4BA898` literal, and the temporary `Pressable` import were all removed from `task-form.tsx`.

## Confirmation: `/tasks/new` uses `FigmaFooterPrimaryButton` with `label={t('tasks.add')}`
The CTA is restored as **direct body content** (the last child after the Notes card, not via the `FigmaFormScreen` footer prop):

```jsx
      </FigmaFormCard>   {/* Notes card */}

      {/* Primary CTA — rendered directly in the body … */}
      <View style={styles.footer}>
        {submitError ? (<Text style={[styles.footerError, { color: theme.errorFg }]} …>{submitError}</Text>) : null}
        <FigmaFooterPrimaryButton label={t('tasks.add')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
```

`FigmaFooterPrimaryButton` is re-imported; the temporary `Pressable` import was dropped; the `styles.footer`/`styles.footerError` entries were restored. `task-form.tsx` now matches the other body-rendered forms exactly.

## Confirmation: other form CTAs benefit from the same fixed component
All other add/edit forms already render `FigmaFooterPrimaryButton` in their body (from the prior body-CTA change): `medication-form`, `appointment-form`, `visit-form`, `vital-form`, `log-form`, `invite-form`, and the ported `vital-editor` / `log-editor`. Because only the **shared component implementation** changed, every one of those CTAs now renders as the proven plain-Pressable teal button — no per-screen edits needed.

## Validation results
| Check | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run check:mojibake` | **clean** — 260 active files, no mojibake |
| `git -c core.autocrlf=false diff --check` | **exit 0** |
| temp-marker sweep (`git grep -E` of the 4 tokens) | **exit 1** — none present |

## Git state
Not committed, not staged, no `git add`, no reset/restore/clean. Working tree only; the sole file added by this task (besides the edits) is this report. `figma-footer-primary-button.tsx` remains untracked (a new file from earlier work) — it will be included whenever these changes are eventually staged/committed by you.
