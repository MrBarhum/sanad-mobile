import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CircleGate } from '@/features/care-circle/circle-gate';
import { TaskForm } from '@/features/tasks/task-form';

/** Add a task (managers only). */
export default function NewTaskScreen() {
  const { t } = useTranslation();
  return (
    <CircleGate>
      {(circle) =>
        circle.canManage ? (
          <TaskForm circleId={circle.circleId} />
        ) : (
          <ThemedView style={styles.centered}>
            <EmptyState title={t('tasks.managersOnly')} />
          </ThemedView>
        )
      }
    </CircleGate>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
