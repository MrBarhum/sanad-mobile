import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  // Anchor back-navigation to the medication center.
  initialRouteName: 'index',
};

/**
 * Nested stack for the medication flow (center → add → detail). Lives under the
 * (app) stack, which hides its own header for this group so this stack provides
 * the themed headers and back buttons.
 */
export default function MedicationsLayout() {
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
      <Stack.Screen name="index" options={{ title: t('medications.title'), headerShown: false }} />
      <Stack.Screen name="new" options={{ title: t('medications.addTitle') }} />
      <Stack.Screen name="[id]" options={{ title: t('medications.detailTitle') }} />
    </Stack>
  );
}
