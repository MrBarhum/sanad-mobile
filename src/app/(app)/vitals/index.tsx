import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaVitals } from '@/features/vitals/figma-vitals';

/** Vitals: non-diagnostic readings grid (Figma exact-copy), add. */
export default function VitalsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaVitals
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
