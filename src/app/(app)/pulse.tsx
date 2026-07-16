import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaPulse } from '@/features/pulse/figma-pulse';

/**
 * Care Pulse («نبض اليوم») — a read-only activity feed of what's happening across
 * the care circle. Any active member may view it (the RPC is member-gated); there
 * are no actions here, so no role branching is needed.
 */
export default function PulseScreen() {
  return <CircleGate>{(circle) => <FigmaPulse circleId={circle.circleId} />}</CircleGate>;
}
