// Initialize i18next (side effect) before any component using translations renders.
import '@/i18n';

import { type PropsWithChildren } from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';

/**
 * Composes the app-wide foundation providers. Order (outer -> inner):
 * SafeAreaProvider -> QueryProvider -> AuthProvider.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

export { useAuth } from './auth-provider';
