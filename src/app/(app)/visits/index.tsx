import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaVisits } from '@/features/visits/figma-visits';

/** Family visits center: today's, upcoming, and recent visits. */
export default function VisitsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaVisits
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
