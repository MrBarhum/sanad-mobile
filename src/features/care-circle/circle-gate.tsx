import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { useActiveCircle, type ActiveCircle } from './hooks';

/**
 * Resolves the active care circle for a detail screen and renders the shared
 * loading / error / no-circle states, handing the resolved circle to `children`
 * only once it is available. Keeps the four care detail screens free of repeated
 * auth + summary boilerplate.
 */
export function CircleGate({ children }: { children: (circle: ActiveCircle) => ReactNode }) {
  const { t } = useTranslation();
  const { circle, isLoading, isError, refetch } = useActiveCircle();

  if (isLoading) return <LoadingState />;
  if (isError) {
    return (
      <ErrorState
        message={t('careCircle.loadError')}
        retryLabel={t('retry')}
        onRetry={() => refetch()}
      />
    );
  }
  if (!circle) {
    return (
      <ThemedView style={styles.center}>
        <EmptyState title={t('careCircle.noActiveCircle')} />
      </ThemedView>
    );
  }

  return <>{children(circle)}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
