import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { LtrText } from '@/components/ltr-text';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { type IconName } from '@/constants/icons';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AppointmentsCard } from '@/features/appointments/appointments-card';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import type { MedicationLogStatus } from '@/features/medications/api';
import { useLogDose, useTodayDoses } from '@/features/medications/hooks';
import { summarizeDoses, type DoseItem } from '@/features/medications/today';
import { TasksCard } from '@/features/tasks/tasks-card';
import { formatHm, todayYmd } from '@/utils/date';

import { TodayCareRing } from './today-care-ring';

/** Dose status → badge tone (color + a distinct shape icon, never color alone). */
const STATUS_TONE: Record<MedicationLogStatus, StatusTone> = {
  given: 'success',
  postponed: 'warning',
  missed: 'error',
};
/** Distinct shape per status so meaning never rests on color. */
const STATUS_ICON: Record<MedicationLogStatus, IconName> = {
  given: 'success',
  postponed: 'clock',
  missed: 'close',
};
const STATUS_ORDER: MedicationLogStatus[] = ['given', 'postponed', 'missed'];
/** Soft tint per status for the glance strip. */
const STRIP_TINT: Record<MedicationLogStatus, { bg: ThemeColor; fg: ThemeColor }> = {
  given: { bg: 'successBg', fg: 'successFg' },
  postponed: { bg: 'warningBg', fg: 'warningFg' },
  missed: { bg: 'errorBg', fg: 'errorFg' },
};
const STRIP_NEUTRAL = { bg: 'backgroundSelected' as ThemeColor, fg: 'textSecondary' as ThemeColor };

/**
 * The Today-first overview — the single visual anchor of Home, inspired by the
 * Figma Make Home. A premium care-loop hero (the signature ring = today's
 * medication dose loop, the next dose as the primary action, and a glanceable
 * dose-time strip), then the day's doses with direct status actions, then a calm
 * secondary summary (tasks + appointments). All data comes from existing hooks
 * (React Query dedupes); nothing is mocked, no backend work, no health judgment,
 * no reminder-delivery claims.
 */
export function TodayOverview({ circle }: { circle: ActiveCircle }) {
  const { t } = useTranslation();
  const router = useRouter();
  const date = todayYmd();

  const { doses, isLoading: dosesLoading } = useTodayDoses(circle.circleId, date);
  const { total, given } = summarizeDoses(doses);
  // Earliest dose not yet given (the list is already sorted by time).
  const nextDose = doses.find((dose) => dose.status !== 'given') ?? null;

  const loopCaption = dosesLoading
    ? t('careCircle.dashboard.today.loopLoading')
    : total === 0
      ? t('careCircle.dashboard.today.loopNone')
      : given >= total
        ? t('careCircle.dashboard.today.loopAllDone')
        : t('careCircle.dashboard.today.loopDoses', { given, total });

  const loopA11y =
    dosesLoading || total === 0
      ? t('careCircle.dashboard.today.loopA11yNone')
      : t('careCircle.dashboard.today.loopA11y', { given, total });

  const nextDoseSpoken = nextDose
    ? `${nextDose.medicationName} ${formatHm(nextDose.scheduledTime)}`
    : total === 0
      ? t('careCircle.dashboard.today.nextDoseNone')
      : t('careCircle.dashboard.today.nextDoseAllGiven');

  const heroA11y = `${t('careCircle.dashboard.today.loopCardTitle')}. ${loopA11y}. ${t('careCircle.dashboard.today.nextDoseLabel')}: ${nextDoseSpoken}`;

  const showDoses = !dosesLoading && total > 0;

  return (
    <Section
      title={t('careCircle.dashboard.today.title')}
      action={
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('careCircle.dashboard.today.viewAll')}
          onPress={() => router.push('/medications')}>
          <ThemedText type="link">{t('careCircle.dashboard.today.viewAll')}</ThemedText>
        </Pressable>
      }>
      <Surface
        onPress={() => router.push('/medications')}
        accessibilityLabel={heroA11y}
        accessibilityHint={t('careCircle.dashboard.sections.medications.title')}
        style={styles.hero}>
        <TodayCareRing
          given={given}
          total={total}
          loading={dosesLoading}
          title={t('careCircle.dashboard.today.loopCardTitle')}
          caption={loopCaption}
        />
        <NextDoseRow nextDose={nextDose} spoken={nextDoseSpoken} />
        {showDoses ? <DoseStrip doses={doses} /> : null}
      </Surface>

      {showDoses ? (
        <TodayDoses
          doses={doses}
          canLog={circle.canLogDoses}
          circleId={circle.circleId}
          date={date}
        />
      ) : null}

      <View style={styles.summary}>
        <TasksCard circleId={circle.circleId} />
        <AppointmentsCard circleId={circle.circleId} />
      </View>
    </Section>
  );
}

/** The primary "next action": the earliest not-yet-given dose (name + time). */
function NextDoseRow({ nextDose, spoken }: { nextDose: DoseItem | null; spoken: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.nextDose, { borderTopColor: theme.divider }]}>
      <View style={styles.nextDoseText}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('careCircle.dashboard.today.nextDoseLabel')}
        </ThemedText>
        {nextDose ? (
          <ThemedText type="cardTitle" numberOfLines={1}>
            {nextDose.medicationName}
            {'   '}
            <LtrText type="cardTitle" themeColor="primaryText">
              {formatHm(nextDose.scheduledTime)}
            </LtrText>
          </ThemedText>
        ) : (
          <ThemedText type="cardTitle" themeColor="textSecondary">
            {spoken}
          </ThemedText>
        )}
      </View>
      <Icon name="chevron" size={22} color="textMuted" />
    </View>
  );
}

/** A glanceable, decorative strip of dose times tinted by status (icon + time). */
function DoseStrip({ doses }: { doses: DoseItem[] }) {
  const theme = useTheme();
  return (
    <View
      style={styles.strip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {doses.slice(0, 8).map((dose) => {
        const tint = dose.status ? STRIP_TINT[dose.status] : STRIP_NEUTRAL;
        const icon: IconName = dose.status ? STATUS_ICON[dose.status] : 'clock';
        return (
          <View key={dose.key} style={[styles.stripPill, { backgroundColor: theme[tint.bg] }]}>
            <Icon name={icon} size={12} color={tint.fg} />
            <LtrText style={[styles.stripTime, { color: theme[tint.fg] }]}>
              {formatHm(dose.scheduledTime)}
            </LtrText>
          </View>
        );
      })}
    </View>
  );
}

/** Today's doses with direct status actions (mirrors the medications center). */
function TodayDoses({
  doses,
  canLog,
  circleId,
  date,
}: {
  doses: DoseItem[];
  canLog: boolean;
  circleId: string;
  date: string;
}) {
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

  return (
    <View style={styles.doseList}>
      {doses.map((dose) => (
        <DoseRow
          key={dose.key}
          dose={dose}
          canLog={canLog}
          pending={pendingKey === dose.key}
          onSetStatus={(status) => setStatus(dose, status)}
        />
      ))}
    </View>
  );
}

function DoseRow({
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
  const [open, setOpen] = useState(false);
  const status = dose.status;

  return (
    <Surface padded={false} style={styles.doseRow}>
      <View style={styles.doseMain}>
        <View style={[styles.timePill, { backgroundColor: theme.primaryBg }]}>
          <LtrText style={[styles.time, { color: theme.primaryText }]}>
            {formatHm(dose.scheduledTime)}
          </LtrText>
        </View>
        <View style={styles.doseText}>
          <ThemedText type="cardTitle" numberOfLines={1}>
            {dose.medicationName}
          </ThemedText>
          {dose.dosage ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {dose.dosage}
            </ThemedText>
          ) : null}
        </View>
        {status ? (
          <StatusBadge
            tone={STATUS_TONE[status]}
            iconName={STATUS_ICON[status]}
            label={t(`medications.status.${status}`)}
          />
        ) : canLog ? (
          <Button
            size="sm"
            variant="secondary"
            label={t('careCircle.dashboard.today.logAction')}
            onPress={() => setOpen((o) => !o)}
            accessibilityHint={dose.medicationName}
          />
        ) : (
          <ThemedText type="small" themeColor="textMuted">
            {t('careCircle.dashboard.today.doseUnlogged')}
          </ThemedText>
        )}
      </View>
      {open && !status && canLog ? (
        <View style={[styles.doseActions, { borderTopColor: theme.divider }]}>
          {STATUS_ORDER.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="secondary"
              iconName={STATUS_ICON[s]}
              label={t(`medications.status.${s}`)}
              disabled={pending}
              onPress={() => onSetStatus(s)}
              style={styles.doseAction}
            />
          ))}
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.three },
  nextDose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  nextDoseText: { flex: 1, gap: Spacing.half },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stripPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  stripTime: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  doseList: { gap: Spacing.two },
  doseRow: { padding: Spacing.three, gap: Spacing.two },
  doseMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  timePill: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one,
    minHeight: 36,
    justifyContent: 'center',
  },
  time: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  doseText: { flex: 1, gap: Spacing.half },
  doseActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  doseAction: { flexGrow: 1, flexBasis: 88 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
});
