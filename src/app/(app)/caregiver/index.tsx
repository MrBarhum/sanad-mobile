import { CircleGate } from '@/features/care-circle/circle-gate';
import { CaregiverToday } from '@/features/caregiver/today';

/** The hired caregiver's one screen: today's doses, today's tasks, nothing else. */
export default function CaregiverTodayScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <CaregiverToday circleId={circle.circleId} recipientName={circle.recipientName} />
      )}
    </CircleGate>
  );
}
