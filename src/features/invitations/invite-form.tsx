import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { OptionSelect } from '@/components/option-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { ymdFromInstant } from '@/utils/date';

import { invitableRoles, type CircleRole, type CreatedInvitation } from './api';
import { useCreateInvitation } from './hooks';
import { copyInviteCode, shareInviteMessage } from './share';

const DANGER = '#dc2626';

/**
 * Create an invitation: pick a role (limited to what the actor may grant), add
 * an optional label, and on success reveal the raw code ONCE with copy/share.
 */
export function InviteForm({ circleId, actorRole }: { circleId: string; actorRole: CircleRole }) {
  const { t } = useTranslation();
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
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <ThemedView type="backgroundElement" style={styles.warning}>
          <ThemedText type="small">{t('invitations.warning')}</ThemedText>
        </ThemedView>

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
          <ThemedText style={styles.error} accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}

        <Button
          label={t('invitations.create')}
          onPress={onSubmit}
          loading={create.isPending}
          disabled={create.isPending}
        />
      </ScrollView>
    </ThemedView>
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="subtitle" style={styles.successTitle} accessibilityRole="header">
          {t('invitations.createdTitle')}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {t('invitations.createdSubtitle')}
        </ThemedText>

        <ThemedView type="backgroundSelected" style={styles.codeBox}>
          <ThemedText style={styles.code} selectable accessibilityLabel={created.code}>
            {created.code}
          </ThemedText>
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary">
          {t('invitations.roleLabel', { role: t(`circleMembers.roles.${created.role}`) })}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('invitations.expiresLabel', { date: ymdFromInstant(created.expiresAt) })}
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.warning}>
          <ThemedText type="small">{t('invitations.codeOnceWarning')}</ThemedText>
        </ThemedView>

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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  warning: { borderRadius: Spacing.three, padding: Spacing.three },
  successTitle: { fontSize: 24, lineHeight: 32 },
  codeBox: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  code: { fontSize: 32, fontWeight: '700', letterSpacing: 2 },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  action: { width: '100%' },
  error: { color: DANGER },
});
