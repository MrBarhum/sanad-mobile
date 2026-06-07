import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers';

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  // Authenticated users have no business on the auth screens.
  if (session) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
