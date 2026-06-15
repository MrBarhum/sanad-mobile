import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlyphChip, type GlyphChipTone } from '@/components/glyph-chip';
import { Icon } from '@/components/icon';
import { LtrText } from '@/components/ltr-text';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { type IconName } from '@/constants/icons';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUpcomingAppointments } from '@/features/appointments/hooks';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import { useTodayDoses } from '@/features/medications/hooks';
import { summarizeDoses } from '@/features/medications/today';
import { useTodayTaskSummary } from '@/features/tasks/hooks';
import { formatHm, hmFromInstant, todayYmd, ymdFromInstant } from '@/utils/date';

import { TodayCareRing } from './today-care-ring';

/**
 * The Today-first overview: a calm summary of "what does this care recipient need
 * today, and what is the current care status". It composes the signature care
 * ring (today's medication dose loop) with a few high-value highlights — next
 * dose, today's appointment, tasks due today — each a one-tap entry into the
 * matching feature. It uses only data already fetched by the dashboard cards
 * (React Query dedupes the shared queries), adds no backend work, and shows calm
 * empty states rather than inventing data. No reminder/notification promises and
 * no medical interpretation.
 */
export function TodayOverview({ circle }: { circle: ActiveCircle }) {
  const { t } = useTranslation();
  const router = useRouter();
  const date = todayYmd();

  const { doses, isLoading: dosesLoading } = useTodayDoses(circle.circleId, date);
  const { total, given } = summarizeDoses(doses);
  // Earliest dose not yet given (the list is already sorted by time).
  const nextDose = doses.find((dose) => dose.status !== 'given') ?? null;

  const appointments = useUpcomingAppointments(circle.circleId);
  const nextAppointment =
    (appointments.data ?? []).find(
      (appointment) =>
        appointment.status !== 'cancelled' && ymdFromInstant(appointment.starts_at) === date,
    ) ?? null;

  const { summary: taskSummary } = useTodayTaskSummary(circle.circleId);
  const dueTasks = taskSummary.dueToday;

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

  // Plain-text spoken values (the rows are single button nodes for TalkBack).
  const nextDoseSpoken = nextDose
    ? `${nextDose.medicationName} ${formatHm(nextDose.scheduledTime)}`
    : total === 0
      ? t('careCircle.dashboard.today.nextDoseNone')
      : t('careCircle.dashboard.today.nextDoseAllGiven');
  const appointmentSpoken = nextAppointment
    ? `${nextAppointment.title} ${hmFromInstant(nextAppointment.starts_at)}`
    : t('careCircle.dashboard.today.appointmentNone');
  const tasksSpoken =
    dueTasks > 0 ? String(dueTasks) : t('careCircle.dashboard.today.tasksNone');

  return (
    <Section title={t('careCircle.dashboard.today.title')}>
      <Surface
        onPress={() => router.push('/medications')}
        accessibilityLabel={`${t('careCircle.dashboard.today.loopCardTitle')}. ${loopA11y}`}
        accessibilityHint={t('careCircle.dashboard.sections.medications.title')}>
        <TodayCareRing
          given={given}
          total={total}
          loading={dosesLoading}
          title={t('careCircle.dashboard.today.loopCardTitle')}
          caption={loopCaption}
        />
      </Surface>

      <Surface padded={false}>
        <TodayRow
          iconName="medication"
          tone="primary"
          label={t('careCircle.dashboard.today.nextDoseLabel')}
          accessibilityLabel={`${t('careCircle.dashboard.today.nextDoseLabel')}: ${nextDoseSpoken}`}
          onPress={() => router.push('/medications')}>
          {nextDose ? (
            <ThemedText type="cardTitle">
              {nextDose.medicationName}
              {'   '}
              <LtrText type="cardTitle" themeColor="accentFg">
                {formatHm(nextDose.scheduledTime)}
              </LtrText>
            </ThemedText>
          ) : (
            <ThemedText type="cardTitle" themeColor="textSecondary">
              {nextDoseSpoken}
            </ThemedText>
          )}
        </TodayRow>

        <TodayRow
          iconName="appointment"
          tone="info"
          label={t('careCircle.dashboard.today.appointmentLabel')}
          accessibilityLabel={`${t('careCircle.dashboard.today.appointmentLabel')}: ${appointmentSpoken}`}
          onPress={() => router.push('/appointments')}
          divider>
          {nextAppointment ? (
            <ThemedText type="cardTitle">
              {nextAppointment.title}
              {'   '}
              <LtrText type="cardTitle" themeColor="accentFg">
                {hmFromInstant(nextAppointment.starts_at)}
              </LtrText>
            </ThemedText>
          ) : (
            <ThemedText type="cardTitle" themeColor="textSecondary">
              {appointmentSpoken}
            </ThemedText>
          )}
        </TodayRow>

        <TodayRow
          iconName="task"
          tone="primary"
          label={t('careCircle.dashboard.today.tasksLabel')}
          accessibilityLabel={`${t('careCircle.dashboard.today.tasksLabel')}: ${tasksSpoken}`}
          onPress={() => router.push('/tasks')}
          divider>
          <ThemedText type="cardTitle" themeColor={dueTasks > 0 ? 'text' : 'textSecondary'}>
            {tasksSpoken}
          </ThemedText>
        </TodayRow>
      </Surface>
    </Section>
  );
}

type TodayRowProps = {
  iconName: IconName;
  tone: GlyphChipTone;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  divider?: boolean;
  children: ReactNode;
};

function TodayRow({
  iconName,
  tone,
  label,
  accessibilityLabel,
  onPress,
  divider = false,
  children,
}: TodayRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: theme.backgroundSelected }}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
        pressed && styles.pressed,
      ]}>
      <GlyphChip iconName={iconName} tone={tone} size="sm" />
      <View style={styles.rowText}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        {children}
      </View>
      <Icon name="chevron" size={26} color="textMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minHeight: TouchTarget.comfortable + Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.8 },
});
