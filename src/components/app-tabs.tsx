import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FigmaTabBar } from '@/components/figma/figma-tab-bar';

/**
 * The app's bottom tab navigator (Home / Explore / Account).
 *
 * Figma exact-copy: the previous native tab bar (`NativeTabs`) could not be
 * styled to match the Figma BottomNav, so this uses Expo Router's JS `Tabs` with
 * a fully custom `tabBar` (`FigmaTabBar`) — the teal active pill, lucide icons
 * and IBM Plex labels from the Figma design. Navigation behavior is preserved: the
 * custom bar emits the standard `tabPress` event and navigates on select. RTL
 * tab order is handled by the row mirroring (Home sits at the right).
 */
export default function AppTabs() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <FigmaTabBar
          activeIndex={state.index}
          routeNames={state.routes.map((route) => route.name)}
          onSelect={(index) => {
            const route = state.routes[index];
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (state.index !== index && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }}
        />
      )}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="account" options={{ title: t('tabs.account') }} />
    </Tabs>
  );
}
