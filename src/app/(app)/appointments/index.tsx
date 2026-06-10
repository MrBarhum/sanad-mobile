import { CircleGate } from '@/features/care-circle/circle-gate';
import { AppointmentsCenter } from '@/features/appointments/appointments-center';

/** Appointment center: today's and upcoming appointments. */
export default function AppointmentsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <AppointmentsCenter circleId={circle.circleId} canManage={circle.canManage} />
      )}
    </CircleGate>
  );
}
