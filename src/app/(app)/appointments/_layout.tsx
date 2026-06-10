import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  // Anchor back-navigation to the appointment center.
  initialRouteName: 'index',
};

/** Nested stack for the appointments flow (center → add → detail). */
export default function AppointmentsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: t('appointments.title') }} />
      <Stack.Screen name="new" options={{ title: t('appointments.addTitle') }} />
      <Stack.Screen name="[id]" options={{ title: t('appointments.detailTitle') }} />
    </Stack>
  );
}
