import { useLocalSearchParams } from 'expo-router';

import { CircleGate } from '@/features/care-circle/circle-gate';
import { DailyLogEditor } from '@/features/daily-logs/log-editor';

/** View / edit a single daily log. */
export default function DailyLogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <CircleGate>
      {(circle) => (
        <DailyLogEditor
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
          logId={String(id)}
        />
      )}
    </CircleGate>
  );
}
