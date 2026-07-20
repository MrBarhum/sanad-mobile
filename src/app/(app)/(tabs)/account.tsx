import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Edit3 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { Button } from '@/components/button';
import { Surface } from '@/components/surface';
import { FigmaTabBand } from '@/components/figma/figma-header';
import { FigmaListRow } from '@/components/figma/figma-list-row';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { GlyphChip } from '@/components/glyph-chip';
import { LtrText } from '@/components/ltr-text';
import { SectionHeader } from '@/components/section-header';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
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
 * The Dar "Account" screen (frame 8b): a green tab-band header, a profile card
 * (a 56dp person square + signed-in name + email + a bordered edit-name square),
 * a grouped "care circles" list (active circle → members, notification settings,
 * join another circle) and a restrained danger sign-out. Cairo + Dar tokens, both
 * themes, RTL.
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

  const muted = { color: c.textSecondary };

  return (
    <FigmaScreen band={<FigmaTabBand title={t('account.title')} />} contentGutter={14} gap={16}>
      {/* Profile header */}
      <Surface tone="card" radius={Radius.card} padded={16}>
        <View style={styles.profileRow}>
          <GlyphChip
            iconName="member"
            tone="primary"
            size="lg"
            style={{ width: 56, height: 56, borderRadius: Radius.card }}
          />
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
            style={[styles.editBtn, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}>
            <Edit3 size={18} color={c.primaryText} strokeWidth={2} />
          </Pressable>
        </View>
      </Surface>

      {/* Care circles */}
      <View style={styles.section}>
        <SectionHeader title={t('account.circleSectionTitle')} />
        <Surface tone="card" radius={Radius.card} padded={0}>
          {activeCircle ? (
            <FigmaListRow
              iconName="member"
              tone="primary"
              title={activeCircle.circleName || t('circleMembers.title')}
              subtitle={circleSubtitle || t('circleMembers.subtitle')}
              onPress={() => router.push('/circle-members')}
            />
          ) : null}
          <FigmaListRow
            iconName="notification"
            tone="success"
            topDivider={Boolean(activeCircle)}
            title={t('notificationSettings.title')}
            subtitle={t('notificationSettings.subtitle')}
            onPress={() => router.push('/notification-settings')}
          />
          <FigmaListRow
            iconName="add"
            tone="warning"
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
      <Text style={[styles.sheetLabel, { color: c.text }]}>{t('account.nameLabel')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('account.namePlaceholder')}
        placeholderTextColor={c.textMuted}
        autoCapitalize="words"
        accessibilityLabel={t('account.nameLabel')}
        style={[
          styles.sheetInput,
          { color: c.text, borderColor: c.primaryText, backgroundColor: c.backgroundSunken },
        ]}
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
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileText: { flex: 1, minWidth: 0, gap: 2 },
  profileLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  profileName: { fontSize: 18, fontFamily: FontFamily.bold },
  profileEmailSub: { fontSize: 14, fontFamily: FontFamily.medium },
  editBtn: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  section: { gap: 8 },
  // Name edit sheet
  sheetLabel: { fontSize: 15, fontFamily: FontFamily.bold },
  sheetInput: {
    minHeight: 52,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: FontFamily.semibold,
  },
  // Danger zone
  dangerBlock: { gap: 12, marginTop: 2 },
  error: { fontSize: 14, fontFamily: FontFamily.medium },
  version: { fontSize: 14, fontFamily: FontFamily.medium, textAlign: 'center', marginTop: 4 },
});
