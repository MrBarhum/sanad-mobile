import { CircleGate } from '@/features/care-circle/circle-gate';
import { FigmaEmergencyCard } from '@/features/emergency/figma-emergency-card';

/** Read-only emergency quick-reference card (managers get edit shortcuts). */
export default function EmergencyCardScreen() {
  return (
    <CircleGate>
      {(circle) => <FigmaEmergencyCard circleId={circle.circleId} canManage={circle.canManage} />}
    </CircleGate>
  );
}
