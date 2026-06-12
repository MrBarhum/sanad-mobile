import { Alert, Platform } from 'react-native';

export type ConfirmCopy = { title: string; message: string; confirm: string; cancel: string };

/**
 * Cross-platform "discard unsaved changes?" confirmation. Calls `onConfirm` only
 * when the user chooses to discard. On web it uses `window.confirm`; on native it
 * uses `Alert` with a destructive confirm. Used by the in-screen modals (which
 * the navigation guard can't intercept) to protect against losing edits on close.
 */
export function confirmDiscard(copy: ConfirmCopy, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${copy.title}\n\n${copy.message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(copy.title, copy.message, [
    { text: copy.cancel, style: 'cancel' },
    { text: copy.confirm, style: 'destructive', onPress: onConfirm },
  ]);
}
