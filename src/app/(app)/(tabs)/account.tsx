import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LtrText } from '@/components/ltr-text';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { CircleSwitcher } from '@/features/circle-selection/circle-switcher';
import { CircleTimezoneCard } from '@/features/circle-selection/circle-timezone-card';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { deactivatePushToken } from '@/features/notifications/api';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { getRememberedToken } from '@/features/notifications/hooks';
import { useAuth } from '@/providers';

import { supabase } from '../../../../lib/supabase';

export default function AccountScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
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
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth}>
      <View style={styles.headerRow}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t('account.title')}
        </ThemedText>
        <NotificationBell />
      </View>

      <Surface style={styles.cardGap}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('account.signedInAs')}
        </ThemedText>
        {user?.email ? (
          <LtrText style={styles.email} selectable>
            {user.email}
          </LtrText>
        ) : (
          <ThemedText style={styles.email}>{t('account.noEmail')}</ThemedText>
        )}
      </Surface>

      <Section title={t('account.circleSectionTitle')}>
        <CircleSwitcher />

        {activeCircle ? (
          <LinkCard
            title={t('circleMembers.title')}
            subtitle={t('circleMembers.subtitle')}
            onPress={() => router.push('/circle-members')}
          />
        ) : null}

        {activeCircle ? <CircleTimezoneCard /> : null}
      </Section>

      <Section title={t('account.notificationsSectionTitle')}>
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
      </Section>

      {error ? (
        <ThemedText
          themeColor="errorFg"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}

      <Button
        variant="danger"
        label={t('account.signOut')}
        loading={signingOut}
        disabled={signingOut}
        onPress={onSignOut}
      />
    </Screen>
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
    <Surface
      onPress={onPress}
      accessibilityLabel={title}
      style={styles.linkCard}>
      <ThemedText type="cardTitle">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {subtitle}
      </ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardGap: { gap: Spacing.one },
  linkCard: {
    gap: Spacing.one,
    minHeight: 72,
    justifyContent: 'center',
  },
  email: {
    fontSize: 16,
  },
});
