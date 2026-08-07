import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaAvailableToClaim } from '@/features/claiming/figma-available-to-claim';

/**
 * "متاح للتكفّل" / Available to claim — unowned care items a claim-capable member
 * (manager or family member) can take responsibility for.
 *
 * `circle.canClaim` mirrors the claim RPCs' own allow-list, so the roles they
 * refuse — `remote_member`, `elder` and (since Milestone 8) the hired `caregiver`
 * — get the in-screen blocked state instead of a 42501 from the server. It must
 * NOT be derived from `canLogDoses`: a caregiver records doses but cannot claim.
 */
export default function AvailableToClaimScreen() {
  return (
    <CircleGate>
      {(circle) => (
        <FigmaAvailableToClaim circleId={circle.circleId} canClaim={circle.canClaim} />
      )}
    </CircleGate>
  );
}
