import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

import { supabase } from '../../../lib/supabase';

export default function AccountScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    // On sign-out the auth state change propagates and the (app) guard redirects.
    await supabase.auth.signOut();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{t('account.title')}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('account.signedInAs')}
          </ThemedText>
          <ThemedText>{user?.email ?? '—'}</ThemedText>
        </ThemedView>

        <Pressable
          onPress={onSignOut}
          disabled={signingOut}
          accessibilityRole="button"
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
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.four,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
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
