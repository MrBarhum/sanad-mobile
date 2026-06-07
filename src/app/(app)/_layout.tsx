import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/providers';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  // Gate the authenticated app behind a session.
  if (!session) return <Redirect href="/sign-in" />;

  return <AppTabs />;
}
