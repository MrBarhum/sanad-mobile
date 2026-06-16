import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaMedications } from '@/features/medications/figma-medications';

/** Medication center: today's doses + medication list. */
export default function MedicationsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaMedications
          circleId={circle.circleId}
          canManage={circle.canManage}
          canLog={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
