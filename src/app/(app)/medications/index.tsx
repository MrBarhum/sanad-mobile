import { CircleGate } from '@/features/care-circle/circle-gate';
import { MedicationsCenter } from '@/features/medications/medications-center';

/** Medication center: today's doses + medication list. */
export default function MedicationsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <MedicationsCenter
          circleId={circle.circleId}
          canManage={circle.canManage}
          canLog={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
