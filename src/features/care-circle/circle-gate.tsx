import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';

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
      <Screen scroll={false} center>
        <EmptyState title={t('careCircle.noActiveCircle')} />
      </Screen>
    );
  }

  return <>{children(circle)}</>;
}
