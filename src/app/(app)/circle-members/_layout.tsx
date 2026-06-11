import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  // Anchor back-navigation to the members list.
  initialRouteName: 'index',
};

/**
 * Nested stack for the care-circle members flow (roster → invite → invitations).
 * Lives under the (app) stack, which hides its own header for this group so this
 * stack provides the themed headers and back buttons.
 */
export default function CircleMembersLayout() {
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
      <Stack.Screen name="index" options={{ title: t('circleMembers.title') }} />
      <Stack.Screen name="invite" options={{ title: t('invitations.inviteTitle') }} />
      <Stack.Screen name="invitations" options={{ title: t('invitations.manageTitle') }} />
    </Stack>
  );
}
