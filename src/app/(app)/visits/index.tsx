import { CircleGate } from '@/features/care-circle/circle-gate';
import { VisitsCenter } from '@/features/visits/visits-center';

/** Family visits center: today's, upcoming, and recent visits. */
export default function VisitsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <VisitsCenter
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
