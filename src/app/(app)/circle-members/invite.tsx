import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CircleGate } from '@/features/care-circle/circle-gate';
import { InviteForm } from '@/features/invitations/invite-form';

/** Create an invitation (managers only). */
export default function InviteMemberScreen() {
  const { t } = useTranslation();
  return (
    <CircleGate>
      {(circle) =>
        circle.canManage ? (
          // The Figma invite screen draws its own header; hide the native one.
          <>
            <Stack.Screen options={{ headerShown: false }} />
            <InviteForm circleId={circle.circleId} actorRole={circle.role} />
          </>
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
