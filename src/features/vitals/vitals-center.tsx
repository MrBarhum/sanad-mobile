import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('vitals.disclaimer')}
        </ThemedText>

        {canAdd ? (
          <Button label={t('vitals.add')} onPress={() => router.push('/vitals/new')} />
        ) : null}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('vitals.todayTitle')}
        </ThemedText>
        {todayReadings.length === 0 ? (
          <EmptyState
            title={t('vitals.noTodayTitle')}
            subtitle={canAdd ? t('vitals.noTodaySubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>{todayReadings.map(renderRow)}</View>
        )}

        {recentReadings.length > 0 ? (
          <>
            <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
              {t('vitals.recentTitle')}
            </ThemedText>
            <View style={styles.list}>{recentReadings.map(renderRow)}</View>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
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
  const when = `${ymdFromInstant(reading.reading_at)} ${hmFromInstant(reading.reading_at)}`;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t(`vitals.type.${reading.reading_type}`)}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>
            {t(`vitals.type.${reading.reading_type}`)}
          </ThemedText>
          {value ? <ThemedText style={styles.value}>{value}</ThemedText> : null}
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
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sectionTitle: { fontSize: 22, lineHeight: 30, marginTop: Spacing.two },
  list: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  value: { fontSize: 18, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
