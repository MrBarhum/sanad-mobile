import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Edit3 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { Button } from '@/components/button';
import { Surface } from '@/components/surface';
import { FigmaListRow, FigmaSectionLabel } from '@/components/figma/figma-list-row';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { GlyphChip } from '@/components/glyph-chip';
import { LtrText } from '@/components/ltr-text';
import { FontFamily, Radius, withAlpha } from '@/constants/theme';
import { emailLocalPart } from '@/features/circle-members/display-name';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { deactivatePushToken } from '@/features/notifications/api';
import { getRememberedToken } from '@/features/notifications/hooks';
import { useMyProfile, useUpdateMyName } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { confirmAction } from '@/utils/confirm';

import { supabase } from '../../../../lib/supabase';

/**
 * The Figma Make Account screen, recreated as literally as possible in React
 * Native on real Sanad data. Mirrors `AccountScreen.tsx`: a profile header
 * (user email via `useAuth`), a grouped "care circles" list (active circle →
 * members, notification settings, join another circle) and a danger sign-out.
 * IBM Plex + theme tokens, RTL. No old Sanad Screen/Surface/Section/CircleSwitcher.
 *
 * KEEPS the exact existing sign-out logic verbatim (deactivatePushToken +
 * supabase.auth.signOut + error state) — only the visuals changed.
 */
export default function AccountScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const c = useTheme();
  const { activeCircle } = useCircleSelection();
  const profile = useMyProfile(user?.id);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  // Name shown in the header: the profile's real name, else the email local-part,
  // else a gentle "add your name" prompt (never a bare email or blank).
  const profileName = profile.data?.fullName?.trim() || null;
  const displayName = profileName || emailLocalPart(user?.email) || t('account.noName');

  // Signing out ends the session (and stops this device's reminders) — a stray
  // tap must not do it silently, so confirm first (A4).
  function onSignOut() {
    confirmAction(
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

  const muted = { color: c.textSecondary, fontFamily: FontFamily.regular };

  return (
    <FigmaScreen gap={24}>
      {/* Profile header */}
      <Surface radius={Radius.xl} padded={20}>
        <View style={styles.profileRow}>
          <GlyphChip iconName="member" color="primary" size="lg" />
          <View style={styles.profileText}>
            <Text style={[styles.profileLabel, muted]}>{t('account.signedInAs')}</Text>
            <Text style={[styles.profileName, { color: c.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {user?.email ? (
              <LtrText selectable style={[styles.profileEmailSub, muted]}>
                {user.email}
              </LtrText>
            ) : null}
          </View>
          <Pressable
            onPress={() => setEditingName(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('account.editName')}
            style={[styles.editBtn, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
            <Edit3 size={18} color={c.primary} />
          </Pressable>
        </View>
      </Surface>

      {/* Care circles */}
      <View>
        <FigmaSectionLabel label={t('account.circleSectionTitle')} />
        <Surface tone="card" radius={Radius.xl} padded={0}>
          {activeCircle ? (
            <FigmaListRow
              iconName="member"
              color="primary"
              title={activeCircle.circleName || t('circleMembers.title')}
              subtitle={circleSubtitle || t('circleMembers.subtitle')}
              onPress={() => router.push('/circle-members')}
            />
          ) : null}
          <FigmaListRow
            iconName="notification"
            color="categoryPurple"
            topDivider={Boolean(activeCircle)}
            title={t('notificationSettings.title')}
            subtitle={t('notificationSettings.subtitle')}
            onPress={() => router.push('/notification-settings')}
          />
          <FigmaListRow
            iconName="add"
            color="categoryGold"
            topDivider
            title={t('account.joinAnother')}
            subtitle={t('account.joinAnotherSubtitle')}
            onPress={() => router.push('/join-circle')}
          />
        </Surface>
      </View>

      {/* Danger sign-out */}
      <View style={styles.dangerBlock}>
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
        <Text style={[styles.version, muted]}>
          {t('figma.account.version', {
            version: Constants.expoConfig?.version ?? '1.0.0',
          })}
        </Text>
      </View>

      <NameEditSheet
        visible={editingName}
        userId={user?.id}
        initialName={profileName ?? ''}
        onClose={() => setEditingName(false)}
      />
    </FigmaScreen>
  );
}

/**
 * Bottom-sheet editor for the current user's display name. Writes
 * `profiles.full_name` for the signed-in user (RLS = own row only). A save
 * refreshes the roster so the new name propagates everywhere the user appears.
 */
function NameEditSheet({
  visible,
  userId,
  initialName,
  onClose,
}: {
  visible: boolean;
  userId: string | undefined;
  initialName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const update = useUpdateMyName(userId);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  // Reseed the field whenever the sheet (re)opens so it reflects the latest name.
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setError(null);
    }
  }, [visible, initialName]);

  async function onSave() {
    setError(null);
    try {
      await update.mutateAsync(name);
      onClose();
    } catch {
      setError(t('account.nameError'));
    }
  }

  return (
    <FigmaBottomSheet visible={visible} onClose={onClose} title={t('account.editName')}>
      <Text style={[styles.sheetLabel, { color: c.textSecondary }]}>{t('account.nameLabel')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('account.namePlaceholder')}
        placeholderTextColor={c.textMuted}
        autoCapitalize="words"
        accessibilityLabel={t('account.nameLabel')}
        style={[styles.sheetInput, { color: c.text, borderColor: c.border, backgroundColor: c.backgroundSunken }]}
      />
      {error ? (
        <Text style={[styles.error, { color: c.errorFg }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={t('common.save')} loading={update.isPending} onPress={onSave} />
      <Button
        label={t('common.cancel')}
        variant="secondary"
        disabled={update.isPending}
        onPress={onClose}
      />
    </FigmaBottomSheet>
  );
}

const styles = StyleSheet.create({
  // Profile header
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileText: { flex: 1, gap: 2 },
  profileLabel: { fontSize: 14 },
  profileName: { fontSize: 18, fontFamily: FontFamily.bold },
  profileEmailSub: { fontSize: 14 },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Name edit sheet
  sheetLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  sheetInput: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  // Danger zone
  dangerBlock: { gap: 12 },
  error: { fontSize: 14, fontFamily: FontFamily.medium },
  version: { fontSize: 14, textAlign: 'center', marginTop: 4 },
});
