import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaTasks } from '@/features/tasks/figma-tasks';

/** Care tasks center: today's, open, and done tasks. */
export default function TasksScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaTasks
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
