import { CircleGate } from '@/features/care-circle/circle-gate';
import { CaregiverWeekSummary } from '@/features/caregiver/week-summary';

/**
 * «ملخّص الأسبوع» — the family's weekly record for a hired caregiver.
 *
 * Reachable only from the Explore row, which itself renders only when the circle
 * has an ACTIVE 'caregiver' member and the viewer is a manager — so a circle that
 * never hired anyone never sees this route exist. The screen re-checks the manager
 * role itself (a deep link is not a permission), and the DB stays authoritative.
 */
export default function CaregiverWeekScreen() {
  return <CircleGate>{(circle) => <CaregiverWeekSummary circle={circle} />}</CircleGate>;
}
