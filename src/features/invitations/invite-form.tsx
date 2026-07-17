import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaButton } from '@/components/figma/figma-button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import {
  FigmaCardSelect,
  FigmaFormCard,
  FigmaFormField,
  FigmaFormScreen,
  FigmaMutedNote,
} from '@/components/figma/figma-form-screen';
import { LtrText } from '@/components/ltr-text';
import { FontFamily, Spacing } from '@/constants/theme';
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
 * Create an invitation — an exact-copy rebuild in the Figma form language (header
 * + gold sensitive-data banner + role chips + optional reference-name card +
 * sticky teal create), wired to Sanad's real invitation flow. Roles come from the
 * real `invitableRoles` allowlist (no fake roles); on success the raw code is
 * revealed ONCE with copy/share, also reskinned.
 */
export function InviteForm({ circleId, actorRole }: { circleId: string; actorRole: CircleRole }) {
  const { t } = useTranslation();
  const theme = useTheme();
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
    title: t(`circleMembers.roles.${value}`),
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
      {/* Role — large stacked selectable cards (title + description), not chips */}
      <FigmaFormCard>
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>
            {t('invitations.fields.role')}
          </Text>
          <FigmaCardSelect value={role} options={roleOptions} onChange={setRole} />
        </View>
      </FigmaFormCard>

      {/* Optional reference name */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('invitations.fields.invitedName')}
          value={invitedName}
          onChangeText={setInvitedName}
          placeholder={t('invitations.placeholders.invitedName')}
          hint={t('invitations.helpers.invitedName')}
        />
      </FigmaFormCard>

      {error ? (
        <Text
          style={[styles.error, { color: theme.errorFg }]}
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

function CreatedCard({ created, onReset }: { created: CreatedInvitation; onReset: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
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
    <FigmaFormScreen
      title={t('invitations.createdTitle')}
      onBack={onReset}
      disclaimer={t('invitations.codeOnceWarning')}>
      <FigmaMutedNote>{t('invitations.createdSubtitle')}</FigmaMutedNote>

      {/* The one-time code */}
      <FigmaFormCard>
        <View style={[styles.codeBox, { backgroundColor: theme.backgroundSunken, borderColor: theme.border }]}>
          <LtrText style={[styles.code, { color: theme.text }]} selectable accessibilityLabel={created.code}>
            {created.code}
          </LtrText>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {t('invitations.roleLabel', { role: t(`circleMembers.roles.${created.role}`) })}
          </Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {t('invitations.expiresLabel', { date: ymdFromInstant(created.expiresAt) })}
          </Text>
        </View>
      </FigmaFormCard>

      {feedback ? (
        <Text style={[styles.feedback, { color: theme.successFg }]} accessibilityLiveRegion="polite">
          {feedback}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <FigmaButton label={t('invitations.shareWhatsApp')} onPress={onWhatsApp} />
        <FigmaButton label={t('invitations.copy')} variant="secondary" onPress={onCopy} />
        <FigmaButton label={t('invitations.share')} variant="secondary" onPress={onShare} />
        <FigmaButton label={t('invitations.createAnother')} variant="secondary" onPress={onReset} />
      </View>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  groupLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  error: { fontSize: 13, fontFamily: FontFamily.regular },
  codeBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  code: { fontSize: 28, lineHeight: 42, fontFamily: FontFamily.bold, letterSpacing: 2, textAlign: 'center' },
  metaRow: { gap: 4 },
  meta: { fontSize: 13, fontFamily: FontFamily.regular },
  feedback: { fontSize: 13, fontFamily: FontFamily.regular },
  actions: { gap: Spacing.two },
});
