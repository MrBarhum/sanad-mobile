import { useLocalSearchParams } from 'expo-router';

import { CircleGate } from '@/features/care-circle/circle-gate';
import { TaskEditor } from '@/features/tasks/task-editor';

/** View / edit a single task. */
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <CircleGate>
      {(circle) => (
        <TaskEditor
          circleId={circle.circleId}
          canManage={circle.canManage}
          canCollaborate={circle.canLogDoses}
          taskId={String(id)}
        />
      )}
    </CircleGate>
  );
}
