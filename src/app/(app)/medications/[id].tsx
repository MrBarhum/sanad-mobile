import { useLocalSearchParams } from 'expo-router';

import { CircleGate } from '@/features/care-circle/circle-gate';
import { MedicationEditor } from '@/features/medications/medication-editor';

/** View / edit a single medication and its schedules. */
export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <CircleGate>
      {(circle) => (
        <MedicationEditor
          circleId={circle.circleId}
          canManage={circle.canManage}
          medicationId={String(id)}
        />
      )}
    </CircleGate>
  );
}
