import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaMembers } from '@/features/circle-members/figma-members';

/** Care-circle roster. Any active member may view; managers get controls. */
export default function CircleMembersScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaMembers
          circleId={circle.circleId}
          actorRole={circle.role}
          circleName={circle.circleName}
          recipientName={circle.recipientName}
        />
      )}
    </CircleGate>
  );
}
