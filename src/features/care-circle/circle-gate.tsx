import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Glyph } from '@/constants/glyphs';

import { useActiveCircle, type ActiveCircle } from './hooks';

/**
 * Resolves the active care circle for a detail screen and renders the shared
 * loading / error / no-circle states, handing the resolved circle to `children`
 * only once it is available. Keeps the four care detail screens free of repeated
 * auth + summary boilerplate.
 */
export function CircleGate({
  children,
  fallbackAction,
}: {
  children: (circle: ActiveCircle) => ReactNode;
  /**
   * A control rendered inside the error and no-circle states — the escape hatch
   * for a screen that has no other one.
   *
   * These two states REPLACE the screen entirely, which is harmless where the
   * user still has tabs and a back stack, and is a trap where they do not. The
   * hired caregiver has exactly one route and no Account tab, so her only
   * sign-out control lives on the very screen this gate was blanking: a failed
   * circle query left her holding an app she could not leave. Routes that can
   * strand a user pass their way out here; every other caller passes nothing and
   * is unchanged.
   */
  fallbackAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const { circle, isLoading, isError, refetch } = useActiveCircle();

  if (isLoading) return <LoadingState />;
  if (isError) {
    return (
      <ErrorState
        message={t('careCircle.loadError')}
        retryLabel={t('retry')}
        onRetry={() => refetch()}
        action={fallbackAction}
      />
    );
  }
  if (!circle) {
    return (
      <Screen scroll={false} center>
        <EmptyState icon={Glyph.members} title={t('careCircle.noActiveCircle')} />
        {fallbackAction}
      </Screen>
    );
  }

  return <>{children(circle)}</>;
}
