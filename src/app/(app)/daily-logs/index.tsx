import { CircleGate } from '@/features/care-circle/circle-gate';
import { DailyLogsCenter } from '@/features/daily-logs/daily-logs-center';

/** Daily care logs center: today's logs, recent logs, add. */
export default function DailyLogsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <DailyLogsCenter
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
