import { SignOutButton } from '@/features/account/sign-out-button';
import { CircleGate } from '@/features/care-circle/circle-gate';
import { CaregiverToday } from '@/features/caregiver/today';

/**
 * The hired caregiver's one screen: today's doses, today's tasks, nothing else.
 *
 * `fallbackAction` is not decoration. She has no tabs, no Account screen and no
 * other route, so the sign-out button inside `CaregiverToday` is her only way out
 * of the app — and the gate's error / no-circle states replace that screen
 * wholesale. Without this, a failed circle query locked her in.
 */
export default function CaregiverTodayScreen() {
  return (
    <CircleGate fallbackAction={<SignOutButton />}>
      {(circle) => (
        <CaregiverToday circleId={circle.circleId} recipientName={circle.recipientName} />
      )}
    </CircleGate>
  );
}
