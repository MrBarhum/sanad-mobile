// Initialize i18next (side effect) before any component using translations renders.
import '@/i18n';

import { type PropsWithChildren } from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { CircleSelectionProvider } from '@/features/circle-selection/provider';

import { AuthProvider } from './auth-provider';
import { ConfirmProvider } from './confirm-provider';
import { QueryProvider } from './query-provider';
import { ThemePreferenceProvider } from './theme-provider';

/**
 * Composes the app-wide foundation providers. Order (outer -> inner):
 * SafeAreaProvider -> ThemePreferenceProvider -> QueryProvider -> AuthProvider ->
 * CircleSelectionProvider -> ConfirmProvider. ThemePreferenceProvider sits high so
 * both the root navigation theme and every screen read the same appearance choice;
 * the circle-selection layer needs both the session and the query client, so it
 * stays low.
 *
 * ConfirmProvider is innermost so its sheet covers every route — `(app)`, `(auth)`
 * and the standalone reset-password screen. It needs SafeAreaProvider (insets),
 * ThemePreferenceProvider (tokens) and i18n, and deliberately nothing from
 * QueryProvider or AuthProvider: the sheet never mutates, the caller's own callback
 * owns that, so no query state can re-render it.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemePreferenceProvider>
        <QueryProvider>
          <AuthProvider>
            <CircleSelectionProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </CircleSelectionProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

export { useAuth } from './auth-provider';
export { useConfirm, useConfirmDiscard, type ConfirmCopy } from './confirm-provider';
export { useThemePreference } from './theme-provider';
