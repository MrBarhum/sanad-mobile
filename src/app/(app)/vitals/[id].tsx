import { useLocalSearchParams } from 'expo-router';

import { CircleGate } from '@/features/care-circle/circle-gate';
import { VitalEditor } from '@/features/vitals/vital-editor';

/** View / edit a single vital reading. */
export default function VitalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <CircleGate>
      {(circle) => (
        <VitalEditor
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
          vitalId={String(id)}
        />
      )}
    </CircleGate>
  );
}
