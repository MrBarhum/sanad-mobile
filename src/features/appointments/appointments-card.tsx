import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NavCard } from '@/components/nav-card';

import { useTodayAppointmentSummary } from './hooks';

/** Navigable appointments card on the dashboard, showing today's count. */
export function AppointmentsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { count, isLoading } = useTodayAppointmentSummary(circleId);

  const subtitle = isLoading
    ? t('careCircle.dashboard.sections.appointments.subtitle')
    : count === 0
      ? t('appointments.summary.none')
      : t('appointments.summary.count', { count });

  return (
    <NavCard
      iconName="appointment"
      title={t('careCircle.dashboard.sections.appointments.title')}
      subtitle={subtitle}
      onPress={() => router.push('/appointments')}
    />
  );
}
