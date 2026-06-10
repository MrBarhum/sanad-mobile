import { useLocalSearchParams } from 'expo-router';

import { AppointmentEditor } from '@/features/appointments/appointment-editor';
import { CircleGate } from '@/features/care-circle/circle-gate';

/** View / edit a single appointment. */
export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <CircleGate>
      {(circle) => (
        <AppointmentEditor
          circleId={circle.circleId}
          canManage={circle.canManage}
          appointmentId={String(id)}
        />
      )}
    </CircleGate>
  );
}
