import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CircleGate } from '@/features/care-circle/circle-gate';
import { MedicationForm } from '@/features/medications/medication-form';

/** Add a medication (managers only). */
export default function NewMedicationScreen() {
  const { t } = useTranslation();
  return (
    <CircleGate>
      {(circle) =>
        circle.canManage ? (
          // The Figma add screen draws its own header; hide the native one.
          <>
            <Stack.Screen options={{ headerShown: false }} />
            <MedicationForm circleId={circle.circleId} />
          </>
        ) : (
          <ThemedView style={styles.centered}>
            <EmptyState title={t('medications.managersOnly')} />
          </ThemedView>
        )
      }
    </CircleGate>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
