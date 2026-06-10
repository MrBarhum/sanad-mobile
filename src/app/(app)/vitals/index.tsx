import { CircleGate } from '@/features/care-circle/circle-gate';
import { VitalsCenter } from '@/features/vitals/vitals-center';

/** Vitals center: latest readings, today's readings, add. */
export default function VitalsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <VitalsCenter
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
