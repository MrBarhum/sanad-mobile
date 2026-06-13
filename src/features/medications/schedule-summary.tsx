import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LtrText, isolateLtr } from '@/components/ltr-text';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatHm } from '@/utils/date';

import type { MedicationSchedule } from './api';
import { WEEKDAY_KEYS } from './schedule-fields';

function uniqueSortedTimes(times: string[]): string[] {
  return [...new Set(times.map(formatHm))].sort();
}

/**
 * Compact weekly summary of a medication's ACTIVE dose schedules, so it's
 * immediately obvious what happens each day. Shows one line per distinct day-set
 * ("Every day: 08:00", "Sun, Tue, Thu: 23:00") and an expandable per-day
 * breakdown listing every time that falls on each weekday. Stopped schedules are
 * excluded â€” they don't generate doses.
 */
export function ScheduleSummary({ schedules }: { schedules: MedicationSchedule[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const active = useMemo(() => schedules.filter((s) => s.is_active), [schedules]);

  // Group active schedules by their day-set, unioning the times under each group.
  const groups = useMemo(() => {
    const map = new Map<string, { days: number[]; times: Set<string> }>();
    for (const schedule of active) {
      const days = [...schedule.days_of_week].sort((a, b) => a - b);
      const key = days.join(',');
      const entry = map.get(key) ?? { days, times: new Set<string>() };
      schedule.times.forEach((time) => entry.times.add(formatHm(time)));
      map.set(key, entry);
    }
    return [...map.values()].map((group) => ({
      days: group.days,
      times: [...group.times].sort(),
    }));
  }, [active]);

  // Per-weekday breakdown: index 0 (Sun)..6 (Sat) -> sorted unique times.
  const perDay = useMemo(() => {
    const byDay: string[][] = [[], [], [], [], [], [], []];
    for (const schedule of active) {
      for (const day of schedule.days_of_week) {
        for (const time of schedule.times) byDay[day].push(formatHm(time));
      }
    }
    return byDay.map((times) => uniqueSortedTimes(times));
  }, [active]);

  if (active.length === 0) return null;

  function daysLabel(days: number[]): string {
    if (days.length >= 7) return t('medications.everyDay');
    return days.map((day) => t(`medications.weekdaysShort.${WEEKDAY_KEYS[day]}`)).join('ØŒ ');
  }

  return (
    <Surface style={styles.card}>
      <ThemedText type="cardTitle">{t('medications.summary.weeklyTitle')}</ThemedText>

      {groups.map((group, index) => (
        <ThemedText key={index} type="small">
          {t('medications.summary.line', {
            days: daysLabel(group.days),
            times: isolateLtr(group.times.join('ØŒ ')),
          })}
        </ThemedText>
      ))}

      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        hitSlop={Spacing.two}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.toggle}>
          {expanded ? t('medications.summary.hidePerDay') : t('medications.summary.showPerDay')}
        </ThemedText>
      </Pressable>

      {expanded ? (
        <View style={styles.perDay}>
          {perDay.map((times, day) => (
            <View key={day} style={styles.perDayRow}>
              <ThemedText type="smallBold">
                {t(`medications.weekdays.${WEEKDAY_KEYS[day]}`)}
              </ThemedText>
              {times.length ? (
                <LtrText type="small" themeColor="textSecondary" style={styles.perDayTimes}>
                  {times.join('ØŒ ')}
                </LtrText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.perDayTimes}>
                  {t('medications.summary.perDayNone')}
                </ThemedText>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  toggle: { textDecorationLine: 'underline', marginTop: Spacing.one },
  perDay: { gap: Spacing.one, marginTop: Spacing.one },
  perDayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  perDayTimes: { flexShrink: 1, textAlign: 'right' },
});
