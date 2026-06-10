import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AppointmentForm } from '@/features/appointments/appointment-form';
import { CircleGate } from '@/features/care-circle/circle-gate';

/** Add an appointment (managers only). */
export default function NewAppointmentScreen() {
  const { t } = useTranslation();
  return (
    <CircleGate>
      {(circle) =>
        circle.canManage ? (
          <AppointmentForm circleId={circle.circleId} />
        ) : (
          <ThemedView style={styles.centered}>
            <EmptyState title={t('appointments.managersOnly')} />
          </ThemedView>
        )
      }
    </CircleGate>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
