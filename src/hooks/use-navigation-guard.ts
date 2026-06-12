import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

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
 * event (hardware/gesture/header back), so the user can choose to stay. On web it
 * falls back to `window.confirm`; on native it uses `Alert`. A no-op when
 * `enabled` is false, so normal back navigation is untouched on clean forms.
 */
export function useNavigationGuard(enabled: boolean, copy: GuardCopy): void {
  const navigation = useNavigation();
  const { title, message, confirm, cancel } = copy;

  useEffect(() => {
    if (!enabled) return;
    const nav = navigation as unknown as RemovableNavigation;

    return nav.addListener('beforeRemove', (event) => {
      event.preventDefault();
      const proceed = () => nav.dispatch(event.data.action);

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) proceed();
        return;
      }
      Alert.alert(title, message, [
        { text: cancel, style: 'cancel' },
        { text: confirm, style: 'destructive', onPress: proceed },
      ]);
    });
  }, [enabled, navigation, title, message, confirm, cancel]);
}
