import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CircleGate } from '@/features/care-circle/circle-gate';
import { VisitForm } from '@/features/visits/visit-form';

/** Add a family visit (managers, caregivers, and family members). */
export default function NewVisitScreen() {
  const { t } = useTranslation();
  return (
    <CircleGate>
      {(circle) =>
        circle.canManage || circle.canLogDoses ? (
          <VisitForm circleId={circle.circleId} canManage={circle.canManage} />
        ) : (
          <ThemedView style={styles.centered}>
            <EmptyState title={t('visits.cannotAdd')} />
          </ThemedView>
        )
      }
    </CircleGate>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
