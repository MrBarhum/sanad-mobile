import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaDoctors } from '@/features/doctors/figma-doctors';

/** Manage the circle's doctors. */
export default function DoctorsScreen() {
  return (
    <CircleGate>
      {(circle) => <FigmaDoctors circleId={circle.circleId} canManage={circle.canManage} />}
    </CircleGate>
  );
}
