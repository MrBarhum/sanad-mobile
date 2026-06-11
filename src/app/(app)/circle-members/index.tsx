import { CircleGate } from '@/features/care-circle/circle-gate';
import { MembersManager } from '@/features/circle-members/members-manager';

/** Care-circle roster. Any active member may view; managers get controls. */
export default function CircleMembersScreen() {
  return (
    <CircleGate>
      {(circle) => <MembersManager circleId={circle.circleId} actorRole={circle.role} />}
    </CircleGate>
  );
}
