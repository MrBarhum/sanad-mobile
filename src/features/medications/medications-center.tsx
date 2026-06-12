import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LtrText } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ReminderNotice } from '@/features/notifications/reminder-notice';
import { formatHm, todayYmd } from '@/utils/date';

import type { Medication, MedicationLogStatus } from './api';
import { useActiveMedications, useLogDose, useTodayDoses } from './hooks';
import type { DoseItem } from './today';

/** Status → badge tone (color + a distinct glyph, never color alone). */
const STATUS_TONE: Record<MedicationLogStatus, StatusTone> = {
  given: 'success',
  postponed: 'warning',
  missed: 'error',
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
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t('medications.disclaimer')}
      </ThemedText>

      <ReminderNotice messageKey="medications.reminderNotice" />

      {canManage ? (
        <Button label={t('medications.add')} onPress={() => router.push('/medications/new')} />
      ) : null}

      <Section title={t('medications.todayTitle')}>
        {today.doses.length === 0 ? (
          <EmptyState
            icon="💊"
            title={t('medications.noDosesTitle')}
            subtitle={t('medications.noDosesSubtitle')}
          />
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
      </Section>

      <Section title={t('medications.listTitle')}>
        {meds.length === 0 ? (
          <EmptyState
            icon="💊"
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
      </Section>
    </Screen>
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
    <Surface style={styles.doseCard}>
      <View style={styles.doseHeader}>
        <LtrText style={styles.doseTime}>{formatHm(dose.scheduledTime)}</LtrText>
        {dose.status ? (
          <StatusBadge tone={STATUS_TONE[dose.status]} label={t(`medications.status.${dose.status}`)} />
        ) : null}
      </View>

      <ThemedText type="cardTitle">{dose.medicationName}</ThemedText>
      {subtitleParts.length > 0 ? (
        <ThemedText themeColor="textSecondary">{subtitleParts.join(' • ')}</ThemedText>
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
              variant={dose.status === status ? 'primary' : 'secondary'}
              label={t(`medications.status.${status}`)}
              disabled={pending}
              onPress={() => onSetStatus(status)}
              style={styles.doseAction}
            />
          ))}
        </View>
      ) : null}
    </Surface>
  );
}

function MedicationRow({ medication, onPress }: { medication: Medication; onPress: () => void }) {
  const { t } = useTranslation();
  const subtitleParts = [medication.dosage, medication.form].filter(Boolean) as string[];

  return (
    <Surface onPress={onPress} accessibilityLabel={medication.name} accessibilityHint={t('medications.tapToEdit')} style={styles.medCard}>
      <ThemedText type="cardTitle">{medication.name}</ThemedText>
      {subtitleParts.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitleParts.join(' • ')}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="primaryText">
        {t('medications.tapToEdit')} ›
      </ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  doseCard: { gap: Spacing.two },
  doseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  doseTime: { fontSize: 24, fontWeight: '800' },
  doseActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  doseAction: { flexGrow: 1, flexBasis: 96 },
  medCard: { gap: Spacing.one },
});
