import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFormScreen } from '@/components/figma/figma-form-screen';
import { GlyphChip } from '@/components/glyph-chip';
import { InfoBanner } from '@/components/info-banner';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deactivatePushToken } from '@/features/notifications/api';
import { getRememberedToken } from '@/features/notifications/hooks';
import { confirmAction } from '@/utils/confirm';

import { supabase } from '../../../lib/supabase';

import { accountDeletionErrorKey, type AccountDeletionPreflightRow } from './api';
import { useAccountDeletionPreflight, useDeleteAccount } from './hooks';

/**
 * Permanent account deletion (Milestone 7 · A10) — required in-app by Google Play.
 *
 * This is a whole screen rather than one more button in the Account danger block
 * because of what the cascade actually does. `care_circles.owner_id` references
 * `profiles(id) on delete cascade`, and `profiles.id` references
 * `auth.users(id) on delete cascade` — so deleting the account destroys every
 * circle the user OWNS and everything inside it. The user has to be able to see,
 * before they confirm, which circles disappear and which they merely leave.
 *
 * When a circle they own still has other active members, the server REFUSES
 * (`ownership_transfer_required`) and this screen explains why and where to go.
 * That refusal is authoritative and re-checked inside the edge function; the list
 * here is disclosure, never the gate.
 */
export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const preflight = useAccountDeletionPreflight();
  const remove = useDeleteAccount();
  const [error, setError] = useState<string | null>(null);

  const rows = preflight.data ?? [];
  const blocked = rows.filter((row) => row.outcome === 'blocked');
  const canDelete = !preflight.isLoading && !preflight.isError && blocked.length === 0;

  function onDelete() {
    confirmAction(
      {
        title: t('account.delete.confirmTitle'),
        message: t('account.delete.confirmMessage'),
        confirm: t('account.delete.submit'),
        cancel: t('common.cancel'),
      },
      () => {
        void doDelete();
      },
      { destructive: true },
    );
  }

  async function doDelete() {
    setError(null);
    // Stop this device receiving pushes while the auth context still exists (the
    // RPC needs it). Best-effort — the token rows cascade away with the user.
    const token = getRememberedToken();
    if (token) {
      try {
        await deactivatePushToken(token);
      } catch {
        // ignore
      }
    }
    try {
      await remove.mutateAsync();
    } catch (deleteError) {
      setError(t(accountDeletionErrorKey(deleteError)));
      void preflight.refetch();
      return;
    }
    // The account is gone; the stored session is now a token for nothing. Clear
    // it locally so the (app) guard drops straight to sign-in rather than
    // retrying a dead session.
    await supabase.auth.signOut();
    router.replace('/sign-in');
  }

  return (
    <FigmaFormScreen
      title={t('account.delete.title')}
      subtitle={t('account.delete.subtitle')}
      onBack={() => router.back()}
      footer={
        <Button
          variant="danger"
          label={t('account.delete.submit')}
          iconName="delete"
          disabled={!canDelete || remove.isPending}
          loading={remove.isPending}
          // A dimmed button must say WHY it is dimmed: the warn banner states the
          // reason visually, so the hint states it to a screen reader too.
          accessibilityHint={blocked.length > 0 ? t('account.delete.blockedBody') : undefined}
          onPress={onDelete}
        />
      }>
      <Surface tone="card" gap={10}>
        <Text style={[styles.intro, { color: c.text }]}>{t('account.delete.intro')}</Text>
        <Text style={[styles.introMuted, { color: c.textSecondary }]}>
          {t('account.delete.introIrreversible')}
        </Text>
      </Surface>

      {preflight.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : preflight.isError ? (
        <Surface tone="card" gap={10}>
          <Text
            style={[styles.intro, { color: c.text }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {t('account.delete.loadError')}
          </Text>
          <Button
            variant="secondary"
            size="sm"
            label={t('retry')}
            onPress={() => void preflight.refetch()}
          />
        </Surface>
      ) : (
        <>
          {blocked.length > 0 ? (
            <>
              <InfoBanner tone="warning" text={t('account.delete.blockedBody')} />
              <Button
                variant="secondary"
                label={t('account.delete.blockedAction')}
                iconName="member"
                onPress={() => router.push('/circle-members')}
              />
            </>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title={t('account.delete.listTitle')} />
            {rows.length === 0 ? (
              <Surface tone="card">
                <Text style={[styles.introMuted, { color: c.textSecondary }]}>
                  {t('account.delete.accountOnly')}
                </Text>
              </Surface>
            ) : (
              // Clipped to the radius so a row can never bleed past the rounded
              // corner — the frame's list container is overflow:hidden.
              <Surface tone="card" padded={0} style={styles.outcomeList}>
                {rows.map((row, index) => (
                  <CircleOutcomeRow key={row.circleId} row={row} topDivider={index > 0} />
                ))}
              </Surface>
            )}
          </View>
        </>
      )}

      {error ? (
        <Text
          style={[styles.error, { color: c.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </FigmaFormScreen>
  );
}

/**
 * One circle and what happens to it. Status is never colour-only — each row
 * carries a tinted icon square plus an explicit Arabic outcome line.
 */
function CircleOutcomeRow({
  row,
  topDivider,
}: {
  row: AccountDeletionPreflightRow;
  topDivider: boolean;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const tone = row.outcome === 'blocked' ? 'warning' : row.outcome === 'deleted' ? 'error' : 'neutral';
  const iconName = row.outcome === 'blocked' ? 'warning' : row.outcome === 'deleted' ? 'delete' : 'visit';
  const outcomeColor =
    row.outcome === 'blocked' ? c.warningFg : row.outcome === 'deleted' ? c.errorFg : c.textSecondary;

  return (
    <View
      style={[
        styles.row,
        topDivider && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border },
      ]}>
      <GlyphChip iconName={iconName} tone={tone} size="sm" />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>
          {row.circleName ?? t('account.delete.untitledCircle')}
        </Text>
        <Text style={[styles.rowOutcome, { color: outcomeColor }]}>
          {t(`account.delete.outcome.${row.outcome}`)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 27 },
  introMuted: { fontSize: 15, fontFamily: FontFamily.medium, lineHeight: 25 },
  centered: { alignItems: 'center', paddingVertical: Spacing.four },
  section: { gap: Spacing.two },
  outcomeList: { overflow: 'hidden' },
  // No radius of its own: the row is a square block inside the clipped card,
  // separated from its neighbour by the 2px divider.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 26 },
  rowOutcome: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 22 },
  error: { fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 25 },
});
