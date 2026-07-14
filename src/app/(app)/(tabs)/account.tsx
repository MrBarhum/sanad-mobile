import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Bell, LogOut, Plus, User, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaButton } from '@/components/figma/figma-button';
import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaListRow, FigmaSectionLabel } from '@/components/figma/figma-list-row';
import { FigmaScreen } from '@/components/figma/figma-screen';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { IconChip } from '@/components/figma/icon-chip';
import { LtrText } from '@/components/ltr-text';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { deactivatePushToken } from '@/features/notifications/api';
import { getRememberedToken } from '@/features/notifications/hooks';
import { useAuth } from '@/providers';

import { supabase } from '../../../../lib/supabase';

/**
 * The Figma Make Account screen, recreated as literally as possible in React
 * Native on real Sanad data. Mirrors `AccountScreen.tsx`: a profile header
 * (user email via `useAuth`), a grouped "care circles" list (active circle →
 * members, notification settings, join another circle) and a danger sign-out.
 * Cairo + Figma tokens, RTL. No old Sanad Screen/Surface/Section/CircleSwitcher.
 *
 * KEEPS the exact existing sign-out logic verbatim (deactivatePushToken +
 * supabase.auth.signOut + error state) — only the visuals changed.
 */
export default function AccountScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
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

  // The active circle subtitle: the user's role label in this circle, plus the
  // cared-for person's name when stored (both come straight from the selection
  // provider — no fabricated member count, which we don't have here).
  const circleSubtitleParts = [
    activeCircle ? t(`circleMembers.roles.${activeCircle.role}`) : null,
    activeCircle?.recipientName ?? null,
  ].filter(Boolean) as string[];
  const circleSubtitle = circleSubtitleParts.join('  ·  ');

  const muted = { color: c.muted, fontFamily: FigmaFont.regular };

  return (
    <FigmaScreen gap={24}>
      {/* Profile header */}
      <FigmaCard radius={FigmaRadius.r24} padding={20}>
        <View style={styles.profileRow}>
          <IconChip
            Icon={User}
            color={c.primary}
            size={64}
            radius={FigmaRadius.pill}
            iconSize={30}
            tintOpacity={0.15}
          />
          <View style={styles.profileText}>
            <Text style={[styles.profileLabel, muted]}>{t('account.signedInAs')}</Text>
            {user?.email ? (
              <LtrText selectable style={[styles.profileEmail, { color: c.text }]}>
                {user.email}
              </LtrText>
            ) : (
              <Text style={[styles.profileEmail, { color: c.text }]}>{t('account.noEmail')}</Text>
            )}
          </View>
        </View>
      </FigmaCard>

      {/* Care circles */}
      <View>
        <FigmaSectionLabel label={t('account.circleSectionTitle')} />
        <FigmaCard tone="card" radius={FigmaRadius.r24} padding={0}>
          {activeCircle ? (
            <FigmaListRow
              Icon={Users}
              color={c.primary}
              title={activeCircle.circleName || t('circleMembers.title')}
              subtitle={circleSubtitle || t('circleMembers.subtitle')}
              onPress={() => router.push('/circle-members')}
            />
          ) : null}
          <FigmaListRow
            Icon={Bell}
            color={FigmaCategory.purple}
            topDivider={Boolean(activeCircle)}
            title={t('notificationSettings.title')}
            subtitle={t('notificationSettings.subtitle')}
            onPress={() => router.push('/notification-settings')}
          />
          <FigmaListRow
            Icon={Plus}
            color={FigmaCategory.gold}
            topDivider
            title={t('account.joinAnother')}
            subtitle={t('account.joinAnotherSubtitle')}
            onPress={() => router.push('/join-circle')}
          />
        </FigmaCard>
      </View>

      {/* Danger sign-out */}
      <View style={styles.dangerBlock}>
        {error ? (
          <Text
            style={[styles.error, { color: c.error }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <FigmaButton
          variant="danger"
          label={t('account.signOut')}
          Icon={LogOut}
          loading={signingOut}
          disabled={signingOut}
          onPress={onSignOut}
        />
        <Text style={[styles.version, muted]}>
          {t('figma.account.version', {
            version: Constants.expoConfig?.version ?? '1.0.0',
          })}
        </Text>
      </View>
    </FigmaScreen>
  );
}

const styles = StyleSheet.create({
  // Profile header
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileText: { flex: 1, gap: 2 },
  profileLabel: { fontSize: 12 },
  profileEmail: { fontSize: 16, fontFamily: FigmaFont.bold },
  // Danger zone
  dangerBlock: { gap: 12 },
  error: { fontSize: 13, fontFamily: FigmaFont.medium },
  version: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
