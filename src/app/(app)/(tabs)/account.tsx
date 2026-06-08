import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

import { supabase } from '../../../../lib/supabase';

export default function AccountScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    setSigningOut(true);
    // On success the auth state change propagates and the (app) guard redirects
    // (this screen unmounts). On failure we recover so the button isn't stuck.
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(t('account.signOutError'));
      setSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t('account.title')}
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('account.signedInAs')}
          </ThemedText>
          <ThemedText style={styles.email} selectable>
            {user?.email ?? t('account.noEmail')}
          </ThemedText>
        </ThemedView>

        {error ? (
          <ThemedText style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={onSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityState={{ disabled: signingOut, busy: signingOut }}
          style={[styles.button, { backgroundColor: theme.text, opacity: signingOut ? 0.6 : 1 }]}>
          {signingOut ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText style={[styles.buttonLabel, { color: theme.background }]}>
              {t('account.signOut')}
            </ThemedText>
          )}
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxFormWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.four,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  email: {
    fontSize: 16,
  },
  error: {
    color: '#dc2626',
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
