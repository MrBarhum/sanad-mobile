import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { GlyphChip } from '@/components/glyph-chip';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ymdFromInstant } from '@/utils/date';

import type { InvitationListItem, InvitationStatus } from './api';
import { useCircleInvitations, useRevokeInvitation } from './hooks';

const STATUS_TONE: Record<InvitationStatus, StatusTone> = {
  pending: 'info',
  accepted: 'success',
  revoked: 'error',
  expired: 'warning',
};

/** Manager view of a circle's invitations with revoke for pending ones. */
export function InvitationsList({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const invitations = useCircleInvitations(circleId);
  const revoke = useRevokeInvitation(circleId);
  const [error, setError] = useState<string | null>(null);

  async function onRevoke(id: string) {
    setError(null);
    try {
      await revoke.mutateAsync(id);
    } catch {
      setError(t('invitations.revokeFailed'));
    }
  }

  if (invitations.isLoading) return <LoadingState />;
  if (invitations.isError) {
    return (
      <ErrorState
        message={t('invitations.loadError')}
        retryLabel={t('retry')}
        onRetry={() => invitations.refetch()}
      />
    );
  }

  const items = invitations.data ?? [];

  return (
    <Screen>
      <Button label={t('invitations.invite')} onPress={() => router.push('/circle-members/invite')} />

      {error ? (
        <ThemedText
          style={{ color: theme.errorFg }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="â–"
          title={t('invitations.emptyTitle')}
          subtitle={t('invitations.emptySubtitle')}
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <InvitationCard
              key={item.id}
              item={item}
              revoking={revoke.isPending}
              onRevoke={() => onRevoke(item.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function InvitationCard({
  item,
  revoking,
  onRevoke,
}: {
  item: InvitationListItem;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);

  return (
    <Surface style={styles.card}>
      <View style={styles.cardHeader}>
        <GlyphChip glyph="â–" tone="primary" size="sm" />
        <ThemedText type="cardTitle" style={styles.cardTitle}>
          {item.invitedName?.trim() || t(`circleMembers.roles.${item.role}`)}
        </ThemedText>
        <StatusBadge tone={STATUS_TONE[item.status]} label={t(`invitations.status.${item.status}`)} />
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {t('invitations.roleLabel', { role: t(`circleMembers.roles.${item.role}`) })}
      </ThemedText>

      {item.status === 'pending' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('invitations.expiresLabel', { date: ymdFromInstant(item.expiresAt) })}
        </ThemedText>
      ) : null}

      {item.status === 'accepted' && item.acceptedByName ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('invitations.acceptedByLabel', {
            name: item.acceptedByName,
            date: item.acceptedAt ? ymdFromInstant(item.acceptedAt) : '',
          })}
        </ThemedText>
      ) : null}

      {item.createdByName ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('invitations.createdByLabel', { name: item.createdByName })}
        </ThemedText>
      ) : null}

      {item.status === 'pending' ? (
        confirming ? (
          <View style={[styles.actions, { borderTopColor: theme.divider }]}>
            <Button
              size="sm"
              variant="danger"
              label={t('invitations.confirmRevoke')}
              loading={revoking}
              onPress={onRevoke}
            />
            <Button
              size="sm"
              variant="secondary"
              label={t('common.cancel')}
              disabled={revoking}
              onPress={() => setConfirming(false)}
            />
          </View>
        ) : (
          <View style={[styles.actions, { borderTopColor: theme.divider }]}>
            <Button
              size="sm"
              variant="danger"
              label={t('invitations.revoke')}
              disabled={revoking}
              onPress={() => setConfirming(true)}
            />
          </View>
        )
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: { gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardTitle: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    marginTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
});
