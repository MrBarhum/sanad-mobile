import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaAppointments } from '@/features/appointments/figma-appointments';

/** Appointment center: today's and upcoming appointments. */
export default function AppointmentsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaAppointments circleId={circle.circleId} canManage={circle.canManage} />
      )}
    </CircleGate>
  );
}
