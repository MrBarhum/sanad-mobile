import { Redirect, Stack } from 'expo-router';

import { useCircleSelection } from '@/features/circle-selection/provider';

/**
 * The hired-caregiver shell — a plain stack holding her single «اليوم» screen.
 *
 * This is the OTHER half of the routing gate in `(app)/_layout.tsx`: that one
 * sends a caregiver here instead of the family tabs; this one makes sure nobody
 * else can land here, however they arrived (a deep link, a stale history entry,
 * or a role that changed while the app was open). A member whose active circle
 * is not a caregiver membership goes straight back to the family Home.
 */
export default function CaregiverLayout() {
  const { activeCircle, isLoading } = useCircleSelection();

  // Wait for the membership list before deciding — redirecting on an unresolved
  // role would bounce a caregiver out of her own shell on every cold start.
  if (isLoading) return null;
  if (activeCircle?.role !== 'caregiver') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
