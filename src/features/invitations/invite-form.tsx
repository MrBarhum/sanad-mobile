import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { InfoBanner } from '@/components/info-banner';
import { LtrText } from '@/components/ltr-text';
import { OptionSelect } from '@/components/option-select';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ymdFromInstant } from '@/utils/date';

import { invitableRoles, type CircleRole, type CreatedInvitation } from './api';
import { useCreateInvitation } from './hooks';
import { copyInviteCode, shareInviteMessage } from './share';

/**
 * Create an invitation: pick a role (limited to what the actor may grant), add
 * an optional label, and on success reveal the raw code ONCE with copy/share.
 */
export function InviteForm({ circleId, actorRole }: { circleId: string; actorRole: CircleRole }) {
  const { t } = useTranslation();
  const theme = useTheme();
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
    <Screen maxWidth={MaxFormWidth} keyboardAvoiding>
      <InfoBanner tone="warning" text={t('invitations.warning')} />

      <OptionSelect
        label={t('invitations.fields.role')}
        value={role}
        options={roleOptions}
        onChange={setRole}
      />

      <FormField
        label={t('invitations.fields.invitedName')}
        value={invitedName}
        onChangeText={setInvitedName}
        placeholder={t('invitations.placeholders.invitedName')}
      />

      {error ? (
        <ThemedText style={{ color: theme.errorFg }} accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      <Button
        label={t('invitations.create')}
        onPress={onSubmit}
        loading={create.isPending}
        disabled={create.isPending}
      />
    </Screen>
  );
}

function CreatedCard({
  created,
  onReset,
}: {
  created: CreatedInvitation;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<string | null>(null);

  const shareMessage = t('invitations.shareMessage', { code: created.code });

  async function onCopy() {
    const ok = await copyInviteCode(created.code);
    setFeedback(ok ? t('invitations.copied') : null);
  }

  async function onShare() {
    await shareInviteMessage(shareMessage);
    setFeedback(t('invitations.shared'));
  }

  return (
    <Screen maxWidth={MaxFormWidth}>
      <ThemedText type="sectionTitle" accessibilityRole="header">
        {t('invitations.createdTitle')}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {t('invitations.createdSubtitle')}
      </ThemedText>

      <Surface tone="sunken" radius={Radius.md} style={styles.codeBox}>
        <LtrText style={styles.code} selectable accessibilityLabel={created.code}>
          {created.code}
        </LtrText>
      </Surface>

      <ThemedText type="small" themeColor="textSecondary">
        {t('invitations.roleLabel', { role: t(`circleMembers.roles.${created.role}`) })}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('invitations.expiresLabel', { date: ymdFromInstant(created.expiresAt) })}
      </ThemedText>

      <InfoBanner tone="warning" text={t('invitations.codeOnceWarning')} />

      {feedback ? (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {feedback}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <Button label={t('invitations.copy')} onPress={onCopy} style={styles.action} />
        <Button
          label={t('invitations.share')}
          variant="secondary"
          onPress={onShare}
          style={styles.action}
        />
        <Button
          label={t('invitations.createAnother')}
          variant="secondary"
          onPress={onReset}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  code: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  action: { width: '100%' },
});
