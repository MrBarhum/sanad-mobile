import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AlertCircle, Check, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormScreen } from '@/components/figma/figma-form-screen';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FormField } from '@/components/form-field';
import { isolateLtr, LtrText } from '@/components/ltr-text';
import { OptionSelect } from '@/components/option-select';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme';
import { emailLocalPart } from '@/features/circle-members/display-name';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { useMyProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { ymdFromInstant } from '@/utils/date';

import { invitableRoles, type CircleRole, type CreatedInvitation } from './api';
import { useCreateInvitation } from './hooks';
import { copyInviteCode, shareInviteMessage, shareViaWhatsApp } from './share';

/**
 * Create an invitation — the Dar form shell (deep-green form header + gold
 * sensitive-data banner + role cards + optional reference-name field + teal
 * create), wired to Sanad's real invitation flow. Roles come from the real
 * `invitableRoles` allowlist (no fake roles); on success the raw code is revealed
 * ONCE with copy/share on the 9c code-reveal screen. Behaviour/data/routing unchanged.
 */
export function InviteForm({ circleId, actorRole }: { circleId: string; actorRole: CircleRole }) {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const create = useCreateInvitation(circleId);

  const allowedRoles = invitableRoles(actorRole);
  const defaultRole: CircleRole =
    allowedRoles.find((r) => r === 'family_member') ?? allowedRoles[0] ?? 'family_member';

  const [role, setRole] = useState<CircleRole>(defaultRole);
  const [invitedName, setInvitedName] = useState('');
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = allowedRoles.map((value) => ({
    value,
    label: t(`circleMembers.roles.${value}`),
    description: t(`circleMembers.roleDescriptions.${value}`),
  }));

  async function onSubmit() {
    setError(null);
    try {
      const result = await create.mutateAsync({
        role,
        invitedName: invitedName.trim() === '' ? null : invitedName.trim(),
      });
      setCreated(result);
    } catch {
      setError(t('invitations.createFailed'));
    }
  }

  if (created) {
    return <CreatedCard created={created} onReset={() => setCreated(null)} />;
  }

  return (
    <FigmaFormScreen
      title={t('invitations.inviteTitle')}
      onBack={() => router.back()}
      disclaimer={t('invitations.warning')}>
      {/* Role — large stacked selectable cards (title + description). */}
      <Surface tone="card" radius={Radius.card} padded={16} gap={16}>
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.textSecondary }]}>
            {t('invitations.fields.role')}
          </Text>
          <OptionSelect value={role} options={roleOptions} onChange={setRole} variant="card" />
        </View>
      </Surface>

      {/* Optional reference name. */}
      <Surface tone="card" radius={Radius.card} padded={16} gap={16}>
        <FormField
          label={t('invitations.fields.invitedName')}
          value={invitedName}
          onChangeText={setInvitedName}
          placeholder={t('invitations.placeholders.invitedName')}
          hint={t('invitations.helpers.invitedName')}
        />
      </Surface>

      {error ? (
        <Text
          style={[styles.error, { color: c.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {/* Primary CTA — rendered directly in the body (not the footer prop, which
          did not render on Android). */}
      <FigmaFooterPrimaryButton
        label={t('invitations.create')}
        onPress={onSubmit}
        loading={create.isPending}
      />
    </FigmaFormScreen>
  );
}

/**
 * The 9c one-time code reveal: a deep-green sub-screen header, the gold shown-once
 * warning (a sanctioned gold use — an irreversible one-time secret), the sharing
 * instruction, the big LTR-isolated code in a sunken bordered well with the role +
 * expiry meta, and the share stack (WhatsApp filled, copy·share·create-another
 * bordered) with a quiet «تم نسخ الرمز» confirmation. Dar tokens, Cairo, both
 * themes, RTL. Real copy/share handlers unchanged.
 */
function CreatedCard({ created, onReset }: { created: CreatedInvitation; onReset: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const { activeCircle } = useCircleSelection();
  const { user } = useAuth();
  const profile = useMyProfile(user?.id);
  const [feedback, setFeedback] = useState<string | null>(null);

  const shareMessage = t('invitations.shareMessage', { code: created.code });
  // Rich WhatsApp message: circle, who invited, the code, join steps, and a deep
  // link that pre-fills the code on /join-circle. Universal https links are out of
  // scope this phase (the app scheme only opens for people who have Sanad).
  const circleName = activeCircle?.circleName?.trim() || t('circleMembers.title');
  const inviterName =
    profile.data?.fullName?.trim() || emailLocalPart(user?.email) || t('assignment.unknownMember');
  const joinLink = Linking.createURL('/join-circle', { queryParams: { code: created.code } });
  const whatsappMessage = t('invitations.whatsappMessage', {
    circle: circleName,
    inviter: inviterName,
    code: created.code,
    link: joinLink,
  });

  async function onCopy() {
    const ok = await copyInviteCode(created.code);
    setFeedback(ok ? t('invitations.copied') : null);
  }

  async function onWhatsApp() {
    await shareViaWhatsApp(whatsappMessage);
    setFeedback(t('invitations.shared'));
  }

  async function onShare() {
    await shareInviteMessage(shareMessage);
    setFeedback(t('invitations.shared'));
  }

  return (
    <FigmaScreen gap={12}>
      <FigmaHeader title={t('invitations.createdTitle')} onBack={onReset} />

      {/* Gold shown-once warning — a sanctioned gold use (one-time / irreversible). */}
      <View style={[styles.goldBanner, { backgroundColor: c.goldFill, borderColor: c.border }]}>
        <AlertCircle size={20} color={c.goldInk} strokeWidth={2.2} style={styles.goldIcon} />
        <Text style={[styles.goldText, { color: c.goldInk }]}>{t('invitations.codeOnceWarning')}</Text>
      </View>

      {/* Sharing instruction. */}
      <Text style={[styles.instruction, { color: c.textSecondary }]}>
        {t('invitations.createdSubtitle')}
      </Text>

      {/* The one-time code + role/expiry meta. */}
      <View style={[styles.codeCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.codeBox, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
          <LtrText style={[styles.code, { color: c.text }]} selectable accessibilityLabel={created.code}>
            {created.code}
          </LtrText>
        </View>
        <View style={styles.meta}>
          <Text style={[styles.metaLine, { color: c.text }]}>
            {t('invitations.roleLabel', { role: t(`circleMembers.roles.${created.role}`) })}
          </Text>
          <Text style={[styles.metaLine, { color: c.text }]}>
            {t('invitations.expiresLabel', { date: isolateLtr(ymdFromInstant(created.expiresAt)) })}
          </Text>
        </View>
      </View>

      {/* Share stack. */}
      <View style={styles.actions}>
        <Pressable
          onPress={onWhatsApp}
          accessibilityRole="button"
          accessibilityLabel={t('invitations.shareWhatsApp')}
          style={[styles.whatsapp, { backgroundColor: c.primary, borderColor: c.border }]}>
          <MessageCircle size={18} color={c.onPrimary} strokeWidth={2} />
          <Text style={[styles.whatsappText, { color: c.onPrimary }]}>
            {t('invitations.shareWhatsApp')}
          </Text>
        </Pressable>

        <View style={styles.actionRow}>
          <Button label={t('invitations.copy')} variant="secondary" onPress={onCopy} style={styles.flex1} />
          <Button label={t('invitations.share')} variant="secondary" onPress={onShare} style={styles.flex1} />
        </View>

        <Button label={t('invitations.createAnother')} variant="secondary" onPress={onReset} />

        {feedback ? (
          <View style={styles.feedbackRow} accessibilityLiveRegion="polite" accessibilityRole="text">
            <Check size={14} color={c.successFg} strokeWidth={2.8} />
            <Text style={[styles.feedbackText, { color: c.successFg }]}>{feedback}</Text>
          </View>
        ) : null}
      </View>
    </FigmaScreen>
  );
}

const styles = StyleSheet.create({
  // Create form
  group: { gap: Spacing.two },
  groupLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  error: { fontSize: 14, fontFamily: FontFamily.regular },

  // 9c reveal — gold shown-once warning
  goldBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  goldIcon: { marginTop: 2 },
  goldText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 25 },
  instruction: { fontSize: 15, fontFamily: FontFamily.medium, lineHeight: 25 },

  // Code reveal card
  codeCard: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  codeBox: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { fontSize: 28, lineHeight: 40, fontFamily: FontFamily.black, letterSpacing: 4, textAlign: 'center' },
  meta: { marginTop: 12, gap: 8 },
  metaLine: { fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 22 },

  // Share stack
  actions: { gap: 8 },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  whatsappText: { fontSize: 17, fontFamily: FontFamily.bold },
  actionRow: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 2 },
  feedbackText: { fontSize: 15, fontFamily: FontFamily.semibold },
});
