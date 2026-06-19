import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { StatTile } from '@/components/dashboard-tile';

import { useTodayAppointmentSummary } from './hooks';

/**
 * Compact "today summary" stat for Home: appointments scheduled today. A small
 * secondary tile (not a hero), navigating into the appointments center.
 */
export function AppointmentsCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { count, isLoading } = useTodayAppointmentSummary(circleId);

  return (
    <StatTile
      iconName="appointment"
      tone="info"
      value={isLoading ? '—' : String(count)}
      label={t('careCircle.dashboard.today.appointmentLabel')}
      onPress={() => router.push('/appointments')}
      accessibilityHint={t('careCircle.dashboard.sections.appointments.title')}
    />
  );
}
