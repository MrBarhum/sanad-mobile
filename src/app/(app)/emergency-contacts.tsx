import { CircleGate } from '@/features/care-circle/circle-gate';
import { EmergencyContactsManager } from '@/features/emergency/contacts-manager';

/** Manage the circle's emergency contacts. */
export default function EmergencyContactsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <EmergencyContactsManager circleId={circle.circleId} canManage={circle.canManage} />
      )}
    </CircleGate>
  );
}
