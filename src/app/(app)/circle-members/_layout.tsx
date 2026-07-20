import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  // Anchor back-navigation to the members list.
  initialRouteName: 'index',
};

/**
 * Nested stack for the care-circle members flow (roster → invite → invitations).
 * Every screen draws its own Dar green FigmaHeader band, so this stack hides its
 * native header (the (app) stack already hides its own header for this group).
 */
export default function CircleMembersLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      {/* Each screen draws its own Dar green FigmaHeader band, so the nested
          stack hides its native header for all three (no double header). */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="invite" options={{ headerShown: false }} />
      <Stack.Screen name="invitations" options={{ headerShown: false }} />
    </Stack>
  );
}
