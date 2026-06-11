// Initialize i18next (side effect) before any component using translations renders.
import '@/i18n';

import { type PropsWithChildren } from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { CircleSelectionProvider } from '@/features/circle-selection/provider';

import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';

/**
 * Composes the app-wide foundation providers. Order (outer -> inner):
 * SafeAreaProvider -> QueryProvider -> AuthProvider -> CircleSelectionProvider.
 * The circle-selection layer needs both the session (AuthProvider) and the query
 * client (QueryProvider), so it sits innermost.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryProvider>
        <AuthProvider>
          <CircleSelectionProvider>{children}</CircleSelectionProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

export { useAuth } from './auth-provider';
