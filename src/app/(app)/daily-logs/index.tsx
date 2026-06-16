import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaDailyLogs } from '@/features/daily-logs/figma-daily-logs';

/** Daily care logs: observational family notes, newest day first, with add. */
export default function DailyLogsScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaDailyLogs
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
