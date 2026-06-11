import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CircleGate } from '@/features/care-circle/circle-gate';
import { InvitationsList } from '@/features/invitations/invitations-list';

/** Manage a circle's invitations (managers only). */
export default function CircleInvitationsScreen() {
  const { t } = useTranslation();
  return (
    <CircleGate>
      {(circle) =>
        circle.canManage ? (
          <InvitationsList circleId={circle.circleId} />
        ) : (
          <ThemedView style={styles.centered}>
            <EmptyState title={t('invitations.managersOnly')} />
          </ThemedView>
        )
      }
    </CircleGate>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
