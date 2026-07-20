import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  // Anchor back-navigation to the task center.
  initialRouteName: 'index',
};

/** Nested stack for the tasks flow (center → add → detail). */
export default function TasksLayout() {
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
      <Stack.Screen name="index" options={{ title: t('tasks.title'), headerShown: false }} />
      <Stack.Screen name="new" options={{ title: t('tasks.addTitle') }} />
      <Stack.Screen name="[id]" options={{ title: t('tasks.detailTitle') }} />
    </Stack>
  );
}
