import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LtrText } from '@/components/ltr-text';
import { Button } from '@/components/button';
import { GlyphChip } from '@/components/glyph-chip';
import { Screen } from '@/components/screen';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { MaxFormWidth, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
        // ignore â€” a stale token is also invalidated server-side on re-register
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
        <ThemedText type="smallBold">{t('account.signedInAs')}</ThemedText>
        <View style={[styles.emailWell, { backgroundColor: theme.backgroundSunken }]}>
          {user?.email ? (
            <LtrText selectable>{user.email}</LtrText>
          ) : (
            <ThemedText>{t('account.noEmail')}</ThemedText>
          )}
        </View>
      </Surface>

      <Section title={t('account.circleSectionTitle')}>
        <CircleSwitcher />

        {activeCircle ? (
          <Surface padded={false}>
            <LinkRow
              glyph="â–"
              title={t('circleMembers.title')}
              subtitle={t('circleMembers.subtitle')}
              onPress={() => router.push('/circle-members')}
            />
          </Surface>
        ) : null}

        {activeCircle ? <CircleTimezoneCard /> : null}
      </Section>

      <Section title={t('account.notificationsSectionTitle')}>
        <Surface padded={false}>
          <LinkRow
            glyph="â—Ž"
            title={t('notificationSettings.title')}
            subtitle={t('notificationSettings.subtitle')}
            onPress={() => router.push('/notification-settings')}
          />
          <LinkRow
            glyph="ï¼‹"
            topDivider
            title={t('account.joinAnother')}
            subtitle={t('account.joinAnotherSubtitle')}
            onPress={() => router.push('/join-circle')}
          />
        </Surface>
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
        style={styles.signOut}
      />
    </Screen>
  );
}

function LinkRow({
  glyph,
  title,
  subtitle,
  onPress,
  topDivider = false,
}: {
  glyph: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Hairline separator above the row (every row but the first in a group). */
  topDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      android_ripple={{ color: theme.backgroundSelected }}
      style={({ pressed }) => [
        styles.linkRow,
        topDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
        pressed && styles.pressed,
      ]}>
      <GlyphChip glyph={glyph} tone="neutral" size="sm" />
      <View style={styles.linkRowText}>
        <ThemedText type="cardTitle">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText style={[styles.chevron, { color: theme.textMuted }]} accessibilityElementsHidden>
        â€º
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardGap: { gap: Spacing.two },
  emailWell: { borderRadius: Radius.md, padding: Spacing.three },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minHeight: TouchTarget.comfortable + Spacing.three,
  },
  linkRowText: { flex: 1, gap: Spacing.half },
  chevron: { fontSize: 26, lineHeight: 30, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  signOut: { marginTop: Spacing.two },
});
