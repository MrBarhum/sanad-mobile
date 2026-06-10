import { CircleGate } from '@/features/care-circle/circle-gate';
import { TasksCenter } from '@/features/tasks/tasks-center';

/** Care tasks center: today's, open, and done tasks. */
export default function TasksScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <TasksCenter
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
