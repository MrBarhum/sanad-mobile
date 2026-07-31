import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AlertCircle, Check, MessageCircle, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormScreen, FigmaMutedNote, FigmaSectionLabel } from '@/components/figma/figma-form-screen';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FormField } from '@/components/form-field';
import { Icon } from '@/components/icon';
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
 * The hired-caregiver disclosure rows, in reading order. These mirror the
 * least-privilege RLS the database actually enforces — a family must be able to
 * read exactly what this person will and will not see BEFORE the code exists.
 * Rendered ONLY when the caregiver role card is selected; every other role leaves
 * the screen exactly as it was.
 */
const SEES_KEYS = ['doses', 'tasks', 'emergency', 'own'] as const;
const HIDDEN_KEYS = ['members', 'pulse', 'schedule', 'others'] as const;
/** Location is deliberately FIRST — the absence of location tracking is the
 *  deliverable of this feature, not a footnote. No shift/attendance/clock-in
 *  tracking exists anywhere in the product. */
const NOT_RECORDED_KEYS = ['location', 'background', 'mic', 'photos'] as const;

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

      {/* Hired-caregiver disclosure — rendered ONLY for the caregiver role, so a
          circle that never hires anyone sees this screen exactly as it always was.
          Three plain-language cards (sees / does not see / is not recorded) plus
          the mutual-protection note: the family learns the scope before the code
          exists, and the worker is told in the same breath what is never tracked. */}
      {role === 'caregiver' ? (
        <>
          <DisclosureCard
            title={t('caregiver.invite.disclosureTitle')}
            glyph={<Check size={16} color={c.successFg} strokeWidth={2.2} />}
            rows={SEES_KEYS.map((key) => ({ key, text: t(`caregiver.invite.sees.${key}`) }))}
          />
          <DisclosureCard
            title={t('caregiver.invite.hiddenTitle')}
            // A scope statement, not a warning — the muted tone, never `errorFg`.
            glyph={<X size={16} color={c.textSecondary} strokeWidth={2.2} />}
            rows={HIDDEN_KEYS.map((key) => ({ key, text: t(`caregiver.invite.hidden.${key}`) }))}
          />
          <DisclosureCard
            title={t('caregiver.invite.notRecordedTitle')}
            glyph={<Icon name="shield" size="sm" color="primaryText" />}
            rows={NOT_RECORDED_KEYS.map((key) => ({
              key,
              text: t(`caregiver.invite.notRecorded.${key}`),
            }))}
          />
          {/* The sentence that makes the feature defensible — kept directly under
              the three cards, never buried below the form. */}
          <FigmaMutedNote>{t('caregiver.invite.mutualNote')}</FigmaMutedNote>
        </>
      ) : null}

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

      {/* A failure is never colour alone: the same icon + 15/700 alert row the
          shared FormField uses, so every error on a form reads the same way. */}
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <AlertCircle size={15} color={c.errorFg} strokeWidth={2.4} />
          <Text style={[styles.errorText, { color: c.errorFg }]}>{error}</Text>
        </View>
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
 * One card of the caregiver disclosure: a `Surface` + a `FigmaSectionLabel` and
 * four hand-composed glyph/text rows. File-private on purpose — this is NOT a new
 * shared primitive and NOT a parallel variant of anything: `FigmaListRow` and
 * `GlyphChip` both take a semantic `iconName` and neither renders a bare glyph
 * beside a wrapping paragraph, which is exactly what a disclosure line is. The
 * glyph element is supplied by the caller and reused across the four rows; the
 * fixed-size box keeps it optically centred on the first text line for both the
 * lucide (SVG) and the registry (glyph-font) icons.
 */
function DisclosureCard({
  title,
  glyph,
  rows,
}: {
  title: string;
  glyph: ReactNode;
  rows: { key: string; text: string }[];
}) {
  const c = useTheme();
  return (
    <Surface tone="card" radius={Radius.card} padded={16} gap={12}>
      <FigmaSectionLabel>{title}</FigmaSectionLabel>
      <View style={styles.disclosureRows}>
        {rows.map((row) => (
          <View key={row.key} style={styles.disclosureRow}>
            <View style={styles.disclosureGlyph}>{glyph}</View>
            <Text style={[styles.disclosureText, { color: c.text }]}>{row.text}</Text>
          </View>
        ))}
      </View>
    </Surface>
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
          {/* Which app this code opens — only for a hired-caregiver invitation.
              Every other role's reveal is untouched. */}
          {created.role === 'caregiver' ? (
            <Text style={[styles.metaNote, { color: c.textSecondary }]}>
              {t('caregiver.invite.codeNote')}
            </Text>
          ) : null}
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
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold },

  // Caregiver disclosure cards — a glyph box sized to the first text line so the
  // icon sits optically centred on it however far the sentence wraps.
  disclosureRows: { gap: 12 },
  disclosureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  disclosureGlyph: {
    width: 16,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disclosureText: { flex: 1, fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },

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
  // The frame's 16/700 at 1.6 — and the ≥1.5× Arabic line-height the old 15/22
  // (1.47×) missed. Both reveal meta lines, every role.
  metaLine: { fontSize: 16, fontFamily: FontFamily.semibold, lineHeight: 26 },
  /** Same meta metrics as `metaLine` but a wrap-safe ≥1.5× Arabic line-height —
   *  the caregiver code note is a sentence, not a single-line label. */
  metaNote: { fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 24 },

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
