import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { CareCircleDashboard } from '@/features/care-circle/circle-dashboard';
import { CareCircleOnboarding } from '@/features/care-circle/onboarding-form';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

/**
 * Home decides what the authenticated user sees:
 *   - loading   → spinner
 *   - error     → message + retry
 *   - no circle → onboarding (create the first circle / join with a code)
 *   - has circle → dashboard for the active circle
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const { activeCircle, hasNoCircles, isLoading, isError, refetch } = useCircleSelection();

  // Home is behind the (app) auth guard, but keep the types honest.
  if (!user) return null;

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (isError) {
    return (
      <Screen scroll={false} center edges={{ top: true }}>
        <ErrorState
          message={t('careCircle.loadError')}
          retryLabel={t('retry')}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  if (hasNoCircles || !activeCircle) {
    return <CareCircleOnboarding userId={user.id} />;
  }

  return <CareCircleDashboard circle={activeCircle} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
