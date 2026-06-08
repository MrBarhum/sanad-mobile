import { CircleGate } from '@/features/care-circle/circle-gate';
import { RecipientProfileForm } from '@/features/recipient-profile/profile-form';

/** View / edit the care recipient's profile. */
export default function RecipientProfileScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <RecipientProfileForm circleId={circle.circleId} canManage={circle.canManage} />
      )}
    </CircleGate>
  );
}
