import { CircleGate } from '@/features/care-circle/circle-gate';
import { EmergencyCard } from '@/features/emergency/emergency-card';

/** Read-only emergency quick-reference card. */
export default function EmergencyCardScreen() {
  return <CircleGate>{(circle) => <EmergencyCard circleId={circle.circleId} />}</CircleGate>;
}
