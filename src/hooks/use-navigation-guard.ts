import { useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { useConfirm } from '@/providers';

type GuardCopy = { title: string; message: string; confirm: string; cancel: string };

/** Minimal slice of the React Navigation prop we use — `beforeRemove` isn't on
 * the default expo-router `useNavigation()` type, so we narrow to what we call. */
type RemovableNavigation = {
  addListener: (
    type: 'beforeRemove',
    callback: (event: { preventDefault: () => void; data: { action: unknown } }) => void,
  ) => () => void;
  dispatch: (action: unknown) => void;
};

/**
 * Confirms before a screen is popped while `enabled` is true — used to protect
 * forms that have unsaved changes. It intercepts the navigator's `beforeRemove`
 * event (hardware/gesture/header back), so the user can choose to stay. A no-op
 * when `enabled` is false, so normal back navigation is untouched on clean forms.
 *
 * This used to hand-roll its own `Alert.alert` / `window.confirm` pair — a second,
 * independent copy of the prompt that `confirmDiscard` was already showing, with the
 * identical `common.unsavedTitle` / `common.unsavedMessage` copy. On a dirty form the
 * close button and the back gesture therefore showed two different-looking dialogs
 * one tap apart. Both now go through the one confirmation sheet.
 *
 * `preventDefault()` still runs synchronously, before the sheet opens, so the pop is
 * already blocked and deferring the dispatch into the callback is safe. The only
 * behavioural change: navigation resumes a frame later, once the sheet has closed.
 */
export function useNavigationGuard(enabled: boolean, copy: GuardCopy): void {
  const navigation = useNavigation();
  const confirm = useConfirm();
  const { title, message, confirm: confirmLabel, cancel } = copy;

  useEffect(() => {
    if (!enabled) return;
    const nav = navigation as unknown as RemovableNavigation;

    return nav.addListener('beforeRemove', (event) => {
      event.preventDefault();
      confirm(
        { title, message, confirm: confirmLabel, cancel },
        () => nav.dispatch(event.data.action),
        { destructive: true },
      );
    });
  }, [enabled, navigation, confirm, title, message, confirmLabel, cancel]);
}
