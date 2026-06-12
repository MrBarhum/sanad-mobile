import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ReminderNotice } from '@/features/notifications/reminder-notice';
import { formatHm, todayYmd } from '@/utils/date';

import type { Medication, MedicationLogStatus } from './api';
import { useActiveMedications, useLogDose, useTodayDoses } from './hooks';
import type { DoseItem } from './today';

const STATUS_COLORS: Record<MedicationLogStatus, string> = {
  given: '#16a34a',
  missed: '#dc2626',
  postponed: '#d97706',
};

const STATUS_ORDER: MedicationLogStatus[] = ['given', 'postponed', 'missed'];

/** Medication center: today's doses + the active medication list. */
export function MedicationsCenter({
  circleId,
  canManage,
  canLog,
}: {
  circleId: string;
  canManage: boolean;
  canLog: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const date = todayYmd();

  const today = useTodayDoses(circleId, date);
  const medications = useActiveMedications(circleId);
  const logDose = useLogDose(circleId);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function setStatus(dose: DoseItem, status: MedicationLogStatus) {
    setPendingKey(dose.key);
    try {
      await logDose.mutateAsync({ dose, status, date });
    } finally {
      setPendingKey(null);
    }
  }

  if (today.isLoading) return <LoadingState />;
  if (today.isError) {
    return (
      <ErrorState
        message={t('medications.loadError')}
        retryLabel={t('retry')}
        onRetry={() => today.refetch()}
      />
    );
  }

  const meds = medications.data ?? [];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('medications.disclaimer')}
        </ThemedText>

        <ReminderNotice messageKey="medications.reminderNotice" />

        {canManage ? (
          <Button label={t('medications.add')} onPress={() => router.push('/medications/new')} />
        ) : null}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('medications.todayTitle')}
        </ThemedText>
        {today.doses.length === 0 ? (
          <EmptyState title={t('medications.noDosesTitle')} subtitle={t('medications.noDosesSubtitle')} />
        ) : (
          <View style={styles.list}>
            {today.doses.map((dose) => (
              <DoseCard
                key={dose.key}
                dose={dose}
                canLog={canLog}
                pending={pendingKey === dose.key}
                onSetStatus={(status) => setStatus(dose, status)}
              />
            ))}
          </View>
        )}

        <ThemedText type="subtitle" style={styles.sectionTitle} accessibilityRole="header">
          {t('medications.listTitle')}
        </ThemedText>
        {meds.length === 0 ? (
          <EmptyState
            title={t('medications.noMedsTitle')}
            subtitle={canManage ? t('medications.noMedsSubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>
            {meds.map((medication) => (
              <MedicationRow
                key={medication.id}
                medication={medication}
                onPress={() => router.push(`/medications/${medication.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function DoseCard({
  dose,
  canLog,
  pending,
  onSetStatus,
}: {
  dose: DoseItem;
  canLog: boolean;
  pending: boolean;
  onSetStatus: (status: MedicationLogStatus) => void;
}) {
  const { t } = useTranslation();

  const subtitleParts = [dose.dosage, dose.form].filter(Boolean) as string[];

  return (
    <ThemedView type="backgroundElement" style={styles.doseCard}>
      <View style={styles.doseHeader}>
        <ThemedText style={styles.doseTime}>{formatHm(dose.scheduledTime)}</ThemedText>
        {dose.status ? (
          <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[dose.status] }]}>
            <ThemedText type="small" style={{ color: STATUS_COLORS[dose.status] }}>
              {t(`medications.status.${dose.status}`)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText style={styles.doseName}>{dose.medicationName}</ThemedText>
      {subtitleParts.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitleParts.join(' • ')}
        </ThemedText>
      ) : null}
      {dose.withFood ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('medications.withFoodHint')}
        </ThemedText>
      ) : null}
      {dose.instructions ? (
        <ThemedText type="small" themeColor="textSecondary">
          {dose.instructions}
        </ThemedText>
      ) : null}

      {canLog ? (
        <View style={styles.doseActions}>
          {STATUS_ORDER.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={dose.status === status ? 'primary' : 'secondary'}
              label={t(`medications.status.${status}`)}
              disabled={pending}
              onPress={() => onSetStatus(status)}
            />
          ))}
        </View>
      ) : null}
    </ThemedView>
  );
}

function MedicationRow({
  medication,
  onPress,
}: {
  medication: Medication;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const subtitleParts = [medication.dosage, medication.form].filter(Boolean) as string[];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={medication.name}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.medCard}>
        <ThemedText style={styles.medName}>{medication.name}</ThemedText>
        {subtitleParts.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitleParts.join(' • ')}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {t('medications.tapToEdit')}
        </ThemedText>
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
  doseCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  doseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  doseTime: { fontSize: 20, fontWeight: '700' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  doseName: { fontSize: 18, fontWeight: '600' },
  doseActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  medCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.one },
  medName: { fontSize: 18, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
