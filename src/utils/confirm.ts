import { Alert, Platform } from 'react-native';

export type ConfirmCopy = { title: string; message: string; confirm: string; cancel: string };

/**
 * Cross-platform confirmation prompt — the single canonical way to guard a
 * one-tap action that mutates data or ends a session (sign-out, claim, activate /
 * deactivate a medication or schedule). On web it uses `window.confirm`; on native
 * a two-button `Alert`. `onConfirm` runs only when the user accepts. Set
 * `destructive` for actions that remove or stop something (red confirm on iOS).
 *
 * Inline two-step confirms (the delete rows) and the bottom-sheet confirms (task
 * complete/cancel, dose correction) are the OTHER sanctioned patterns; this one is
 * for lightweight single-tap guards where a full sheet would be heavy.
 */
export function confirmAction(
  copy: ConfirmCopy,
  onConfirm: () => void,
  opts?: { destructive?: boolean },
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${copy.title}\n\n${copy.message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(copy.title, copy.message, [
    { text: copy.cancel, style: 'cancel' },
    {
      text: copy.confirm,
      style: opts?.destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

/**
 * "Discard unsaved changes?" — a destructive {@link confirmAction} used by the
 * in-screen modals (which the navigation guard can't intercept) to protect
 * against losing edits on close.
 */
export function confirmDiscard(copy: ConfirmCopy, onConfirm: () => void): void {
  confirmAction(copy, onConfirm, { destructive: true });
}
