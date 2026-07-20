import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FontFamily } from '@/constants/theme';
import { NotificationObserver } from '@/features/notifications/notification-observer';
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
    <>
      {/* Headless: notification handler, listeners, token refresh, tap routing. */}
      <NotificationObserver />
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          // Brand typeface on every native header so screen titles match the
          // in-screen typography (size kept native-modest, weight does the work).
          headerTitleStyle: { color: theme.text, fontFamily: FontFamily.bold, fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="circle-members" options={{ headerShown: false }} />
        <Stack.Screen name="join-circle" options={{ title: t('joinCircle.title') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications.title'), headerShown: false }} />
        <Stack.Screen
          name="notification-settings"
          options={{ title: t('notificationSettings.title') }}
        />
        <Stack.Screen name="medications" options={{ headerShown: false }} />
        <Stack.Screen name="tasks" options={{ headerShown: false }} />
        <Stack.Screen name="appointments" options={{ headerShown: false }} />
        <Stack.Screen name="visits" options={{ headerShown: false }} />
        <Stack.Screen name="available-to-claim" options={{ headerShown: false }} />
        <Stack.Screen name="pulse" options={{ headerShown: false }} />
        <Stack.Screen name="daily-logs" options={{ headerShown: false }} />
        <Stack.Screen name="vitals" options={{ headerShown: false }} />
        <Stack.Screen name="recipient-profile" options={{ title: t('recipientProfile.title') }} />
        <Stack.Screen name="emergency-card" options={{ title: t('emergencyCard.title'), headerShown: false }} />
        <Stack.Screen name="emergency-contacts" options={{ title: t('emergencyContacts.title') }} />
        <Stack.Screen name="doctors" options={{ title: t('doctors.title'), headerShown: false }} />
      </Stack>
    </>
  );
}
