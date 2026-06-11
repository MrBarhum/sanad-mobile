import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ymdFromInstant } from '@/utils/date';

import type { InvitationListItem } from './api';
import { useCircleInvitations, useRevokeInvitation } from './hooks';

const DANGER = '#dc2626';

/** Manager view of a circle's invitations with revoke for pending ones. */
export function InvitationsList({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Button label={t('invitations.invite')} onPress={() => router.push('/circle-members/invite')} />

        {error ? (
          <ThemedText style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
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
      </ScrollView>
    </ThemedView>
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
  const [confirming, setConfirming] = useState(false);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>
          {item.invitedName?.trim() || t(`circleMembers.roles.${item.role}`)}
        </ThemedText>
        <ThemedView type="backgroundSelected" style={styles.badge}>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`invitations.status.${item.status}`)}
          </ThemedText>
        </ThemedView>
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
          <View style={styles.actions}>
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
          <View style={styles.actions}>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  list: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  badge: { borderRadius: Spacing.five, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', marginTop: Spacing.one },
  error: { color: DANGER },
});
