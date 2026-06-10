import { useLocalSearchParams } from 'expo-router';

import { CircleGate } from '@/features/care-circle/circle-gate';
import { VisitEditor } from '@/features/visits/visit-editor';

/** View / edit a single family visit. */
export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <CircleGate>
      {(circle) => (
        <VisitEditor
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
          visitId={String(id)}
        />
      )}
    </CircleGate>
  );
}
