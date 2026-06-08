import { CircleGate } from '@/features/care-circle/circle-gate';
import { DoctorsManager } from '@/features/doctors/doctors-manager';

/** Manage the circle's doctors. */
export default function DoctorsScreen() {
  return (
    <CircleGate>
      {(circle) => <DoctorsManager circleId={circle.circleId} canManage={circle.canManage} />}
    </CircleGate>
  );
}
