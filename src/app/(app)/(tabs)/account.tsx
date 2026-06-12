import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { CircleSwitcher } from '@/features/circle-selection/circle-switcher';
import { CircleTimezoneCard } from '@/features/circle-selection/circle-timezone-card';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { deactivatePushToken } from '@/features/notifications/api';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { getRememberedToken } from '@/features/notifications/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

import { supabase } from '../../../../lib/supabase';

export default function AccountScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const { activeCircle } = useCircleSelection();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    setSigningOut(true);
    // Stop this device receiving pushes for the account before the session ends
    // (the RPC needs the auth context, so it must run BEFORE signOut). Best-effort.
    const token = getRememberedToken();
    if (token) {
      try {
        await deactivatePushToken(token);
      } catch {
        // ignore — a stale token is also invalidated server-side on re-register
      }
    }
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle" accessibilityRole="header">
              {t('account.title')}
            </ThemedText>
            <NotificationBell />
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('account.signedInAs')}
            </ThemedText>
            <ThemedText style={styles.email} selectable>
              {user?.email ?? t('account.noEmail')}
            </ThemedText>
          </ThemedView>

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {t('account.circleSectionTitle')}
          </ThemedText>

          <CircleSwitcher />

          {activeCircle ? (
            <LinkCard
              title={t('circleMembers.title')}
              subtitle={t('circleMembers.subtitle')}
              onPress={() => router.push('/circle-members')}
            />
          ) : null}

          {activeCircle ? <CircleTimezoneCard /> : null}

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {t('account.notificationsSectionTitle')}
          </ThemedText>

          <LinkCard
            title={t('notificationSettings.title')}
            subtitle={t('notificationSettings.subtitle')}
            onPress={() => router.push('/notification-settings')}
          />

          <LinkCard
            title={t('account.joinAnother')}
            subtitle={t('account.joinAnotherSubtitle')}
            onPress={() => router.push('/join-circle')}
          />

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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LinkCard({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.linkCard}>
        <ThemedText style={styles.linkTitle}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </ThemedView>
    </Pressable>
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
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: { marginTop: Spacing.two },
  linkCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
    minHeight: 72,
    justifyContent: 'center',
  },
  linkTitle: { fontSize: 18, fontWeight: '600' },
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
    marginTop: Spacing.two,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
