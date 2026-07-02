import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaAvailableToClaim } from '@/features/claiming/figma-available-to-claim';

/**
 * "متاح للتكفّل" / Available to claim — unowned care items a claim-capable member
 * (manager or family/doer) can take responsibility for. Read-only members
 * (remote_member / elder) can't claim: `canClaim` is false for them and the Home
 * entry point is hidden, so they never reach an actionable surface.
 */
export default function AvailableToClaimScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaAvailableToClaim
          circleId={circle.circleId}
          canClaim={circle.canManage || circle.canLogDoses}
        />
      )}
    </CircleGate>
  );
}
