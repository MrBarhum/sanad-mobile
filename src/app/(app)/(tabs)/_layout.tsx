import AppTabs from '@/components/app-tabs';

/**
 * The tab navigator (Home / Explore / Account). Lives in its own group so the
 * parent (app) layout can be a Stack that pushes full-screen detail screens
 * (recipient profile, emergency card, contacts, doctors) over the tab bar.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
