import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CircleGate } from '@/features/care-circle/circle-gate';
import { DailyLogForm } from '@/features/daily-logs/log-form';

/** Add a daily log (caregiving roles only). */
export default function NewDailyLogScreen() {
  const { t } = useTranslation();
  return (
    <CircleGate>
      {(circle) =>
        circle.canManage || circle.canLogDoses ? (
          <DailyLogForm circleId={circle.circleId} />
        ) : (
          <ThemedView style={styles.centered}>
            <EmptyState title={t('dailyLogs.cannotAdd')} />
          </ThemedView>
        )
      }
    </CircleGate>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
