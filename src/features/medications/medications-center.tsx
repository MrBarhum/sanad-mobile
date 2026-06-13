import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { GlyphChip } from '@/components/glyph-chip';
import { LtrText } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ReminderNotice } from '@/features/notifications/reminder-notice';
import { formatHm, todayYmd } from '@/utils/date';

import type { Medication, MedicationLogStatus } from './api';
import { useActiveMedications, useLogDose, useTodayDoses } from './hooks';
import type { DoseItem } from './today';

/** Status â†’ badge tone (color + a distinct glyph, never color alone). */
const STATUS_TONE: Record<MedicationLogStatus, StatusTone> = {
  given: 'success',
  postponed: 'warning',
  missed: 'error',
};

/** Non-emoji glyph per dose action, mirrored on the badge for recognition. */
const STATUS_GLYPH: Record<MedicationLogStatus, string> = {
  given: 'âœ“',
  postponed: 'â—·',
  missed: 'âœ•',
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
      <ThemedText type="small" themeColor="textMuted">
        {t('medications.disclaimer')}
      </ThemedText>

      <ReminderNotice messageKey="medications.reminderNotice" />

      {canManage ? (
        <Button glyph="ï¼‹" label={t('medications.add')} onPress={() => router.push('/medications/new')} />
      ) : null}

      <Section title={t('medications.todayTitle')}>
        {today.doses.length === 0 ? (
          <EmptyState
            icon="â—‰"
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
            icon="â—‰"
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
  const theme = useTheme();
  const subtitleParts = [dose.dosage, dose.form].filter(Boolean) as string[];

  return (
    <Surface style={styles.doseCard}>
      <View style={styles.doseHeader}>
        {/* The scheduled time is the scannable anchor of the day timeline. */}
        <View style={[styles.timeChip, { backgroundColor: theme.accentBg }]}>
          <LtrText style={[styles.doseTime, { color: theme.accentFg }]}>
            {formatHm(dose.scheduledTime)}
          </LtrText>
        </View>
        {dose.status ? (
          <StatusBadge
            tone={STATUS_TONE[dose.status]}
            glyph={STATUS_GLYPH[dose.status]}
            label={t(`medications.status.${dose.status}`)}
          />
        ) : null}
      </View>

      <ThemedText type="cardTitle">{dose.medicationName}</ThemedText>
      {subtitleParts.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitleParts.join(' â€¢ ')}
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
        <View style={[styles.doseActions, { borderTopColor: theme.divider }]}>
          {STATUS_ORDER.map((status) => (
            <Button
              key={status}
              variant={dose.status === status ? 'primary' : 'secondary'}
              glyph={STATUS_GLYPH[status]}
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
  const theme = useTheme();
  const subtitleParts = [medication.dosage, medication.form].filter(Boolean) as string[];

  return (
    <Surface
      onPress={onPress}
      accessibilityLabel={medication.name}
      accessibilityHint={t('medications.tapToEdit')}
      style={styles.medCard}>
      <View style={styles.medRow}>
        <GlyphChip glyph="â—‰" tone="primary" size="sm" />
        <View style={styles.medText}>
          <ThemedText type="cardTitle">{medication.name}</ThemedText>
          {subtitleParts.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitleParts.join(' â€¢ ')}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText style={[styles.chevron, { color: theme.textMuted }]} accessibilityElementsHidden>
          â€º
        </ThemedText>
      </View>
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
    marginBottom: Spacing.one,
  },
  timeChip: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 40,
    justifyContent: 'center',
  },
  doseTime: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 30, fontWeight: '700' },
  doseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  doseAction: { flexGrow: 1, flexBasis: 96 },
  medCard: { paddingVertical: Spacing.three },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  medText: { flex: 1, gap: Spacing.half },
  chevron: { fontSize: 24, lineHeight: 28, fontWeight: '600' },
});
