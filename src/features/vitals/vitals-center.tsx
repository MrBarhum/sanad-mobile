import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { isolateLtr } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers';
import { hmFromInstant, todayYmd, ymdFromInstant } from '@/utils/date';

import type { VitalReading } from './api';
import { formatVitalValue } from './describe';
import { useVitals } from './hooks';

/** Vitals center: latest readings, today's readings, and an add button. */
export function VitalsCenter({
  circleId,
  canManage,
  canCollaborate,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const vitalsQuery = useVitals(circleId);

  if (vitalsQuery.isLoading) return <LoadingState />;
  if (vitalsQuery.isError) {
    return (
      <ErrorState
        message={t('vitals.loadError')}
        retryLabel={t('retry')}
        onRetry={() => vitalsQuery.refetch()}
      />
    );
  }

  const readings = vitalsQuery.data ?? [];
  const today = todayYmd();
  const todayReadings = readings.filter((reading) => ymdFromInstant(reading.reading_at) === today);
  const recentReadings = readings.filter((reading) => ymdFromInstant(reading.reading_at) !== today);
  const canAdd = canManage || canCollaborate;

  function renderRow(reading: VitalReading) {
    return (
      <VitalRow
        key={reading.id}
        reading={reading}
        mine={reading.recorded_by !== null && reading.recorded_by === userId}
        onOpen={() => router.push(`/vitals/${reading.id}`)}
      />
    );
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t('vitals.disclaimer')}
      </ThemedText>

      {canAdd ? (
        <Button label={t('vitals.add')} onPress={() => router.push('/vitals/new')} />
      ) : null}

      <Section title={t('vitals.todayTitle')}>
        {todayReadings.length === 0 ? (
          <EmptyState
            title={t('vitals.noTodayTitle')}
            subtitle={canAdd ? t('vitals.noTodaySubtitle') : undefined}
          />
        ) : (
          <View style={{ gap: Spacing.three }}>{todayReadings.map(renderRow)}</View>
        )}
      </Section>

      {recentReadings.length > 0 ? (
        <Section title={t('vitals.recentTitle')}>
          <View style={{ gap: Spacing.three }}>{recentReadings.map(renderRow)}</View>
        </Section>
      ) : null}
    </Screen>
  );
}

function VitalRow({
  reading,
  mine,
  onOpen,
}: {
  reading: VitalReading;
  mine: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const value = formatVitalValue(reading);
  const when = isolateLtr(`${ymdFromInstant(reading.reading_at)} ${hmFromInstant(reading.reading_at)}`);

  return (
    <Surface
      onPress={onOpen}
      accessibilityLabel={t(`vitals.type.${reading.reading_type}`)}
      style={{ gap: Spacing.two }}>
      <View style={styles.cardHeader}>
        <ThemedText type="cardTitle" style={styles.cardTitle}>
          {t(`vitals.type.${reading.reading_type}`)}
        </ThemedText>
        {value ? (
          <ThemedText type="cardTitle" style={styles.value}>
            {value}
          </ThemedText>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {when}
        {mine ? ` • ${t('vitals.mineLabel')}` : ''}
      </ThemedText>

      {reading.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {reading.notes}
        </ThemedText>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { flexShrink: 1 },
  value: { fontWeight: '700' },
});
