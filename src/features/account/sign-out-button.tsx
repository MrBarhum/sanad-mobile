import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/button';
import { FontFamily } from '@/constants/theme';
import { deactivatePushToken } from '@/features/notifications/api';
import { getRememberedToken } from '@/features/notifications/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useConfirm } from '@/providers';

import { supabase } from '../../../lib/supabase';

/**
 * Sign out — the confirm, the push-token deactivation, the session end and the
 * failure message, as ONE control.
 *
 * It is a shared component rather than three copies because of who depends on it.
 * A hired caregiver has no tabs, no Account screen and no second route: this
 * button is the ONLY way out of the app for her. It therefore has to be
 * mountable from a screen's error boundary as well as from the screen itself —
 * see `CircleGate`'s `fallbackAction`, which exists so a failed circle query can
 * never leave her holding an app she cannot leave.
 *
 * The logic is the long-standing one, unchanged: confirm first (a stray tap must
 * not end a session), deactivate this device's push token BEFORE the session
 * ends (the RPC needs the auth context) and best-effort, then sign out. On
 * success the auth state change propagates and the `(app)` guard redirects, so
 * this unmounts; on failure it recovers so the button is never stuck.
 */
export function SignOutButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const c = useTheme();
  const confirm = useConfirm();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSignOut() {
    confirm(
      {
        title: t('account.confirmSignOutTitle'),
        message: t('account.confirmSignOutMessage'),
        confirm: t('account.signOut'),
        cancel: t('common.cancel'),
      },
      () => {
        void doSignOut();
      },
      { destructive: true },
    );
  }

  async function doSignOut() {
    setError(null);
    setSigningOut(true);
    const token = getRememberedToken();
    if (token) {
      try {
        await deactivatePushToken(token);
      } catch {
        // Best-effort: a stale token is also invalidated server-side on re-register.
      }
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(t('account.signOutError'));
      setSigningOut(false);
    }
  }

  return (
    <View style={[styles.block, style]}>
      {error ? (
        <Text
          style={[styles.error, { color: c.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button
        variant="danger"
        label={t('account.signOut')}
        iconName="signOut"
        loading={signingOut}
        disabled={signingOut}
        onPress={onSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8, alignSelf: 'stretch' },
  error: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 22 },
});
