import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

export const unstable_settings = {
  // Anchor back-navigation to the tab group, so a deep link straight to a detail
  // screen (e.g. /emergency-card) still has Home to return to.
  initialRouteName: '(tabs)',
};

/**
 * Authenticated area. A Stack wraps the tab group so the care detail screens
 * push full-screen over the tab bar with a themed native header + back button.
 * The session guard stays here, gating every screen in the group at once.
 */
export default function AppLayout() {
  const { session, isLoading } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();

  if (isLoading) return null;
  // Gate the authenticated app behind a session.
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="recipient-profile" options={{ title: t('recipientProfile.title') }} />
      <Stack.Screen name="emergency-card" options={{ title: t('emergencyCard.title') }} />
      <Stack.Screen name="emergency-contacts" options={{ title: t('emergencyContacts.title') }} />
      <Stack.Screen name="doctors" options={{ title: t('doctors.title') }} />
    </Stack>
  );
}
