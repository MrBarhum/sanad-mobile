import { useRouter } from 'expo-router';
import { Activity, Droplets, Moon, Smile, Utensils } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { FontFamily, Radius, withAlpha, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import type { DailyCareLog } from './api';
import { describeDailyLog, describeDailyLogNotes } from './describe';
import { useDailyLogs } from './hooks';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Per-field icon + category color, keyed by the structured `LogDetail.key`s that
 * `describeDailyLog` emits (mood / sleep / appetite / hydration / pain / mobility).
 * Mirrors the Figma DailyLogsScreen row icons. Purely observational decoration —
 * no clinical judgement is implied by the color.
 */
const FIELD_VISUAL: Record<string, { Icon: IconCmp; colorKey: ThemeColor }> = {
  mood: { Icon: Smile, colorKey: 'categoryTeal' },
  sleep: { Icon: Moon, colorKey: 'categoryPurple' },
  appetite: { Icon: Utensils, colorKey: 'categoryGold' },
  hydration: { Icon: Droplets, colorKey: 'categoryBlue' },
  pain: { Icon: Activity, colorKey: 'categoryGreen' },
  mobility: { Icon: Activity, colorKey: 'categoryGreen' },
};

/** Long, localized label for a 'YYYY-MM-DD' log date (Western digits in Arabic). */
function formatLogDate(ymd: string, language: string | undefined): string {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isolateLtr(ymd);
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return isolateLtr(ymd);
  try {
    const locale = language && language.startsWith('ar') ? 'ar-u-nu-latn' : language || 'en';
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  } catch {
    return isolateLtr(ymd);
  }
}

/**
 * The Figma Make "السجل اليومي" (daily logs) screen, recreated as literally as
 * possible in React Native and wired to REAL Sanad data. Mirrors
 * `DailyLogsScreen.tsx`: header (back + title + teal "+"), an observational
 * "family notes, not a medical assessment" disclaimer, then one card per log with
 * a date + (your-log) marker, a list of structured field rows (mood / sleep /
 * appetite / hydration / pain / mobility, each an icon + label + value) and a
 * notes well. Observational only — never any clinical judgement. IBM Plex + Figma
 * tokens, RTL. Reuses the center's hooks (`useDailyLogs`) and `describe*` helpers
 * verbatim. No old Sanad Screen/Surface/Section/GlyphChip/Button.
 */
export function FigmaDailyLogs({
  circleId,
  canManage,
  canCollaborate,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const logsQuery = useDailyLogs(circleId);
  const logs = logsQuery.data ?? [];
  const canAdd = canManage || canCollaborate;

  const today = todayYmd();
  const isError = logsQuery.isError;
  const isLoading = logsQuery.isLoading;

  return (
    <FigmaScreen gap={16}>
      <FigmaHeader
        title={t('figma.dailylogs.title')}
        onAdd={canAdd ? () => router.push('/daily-logs/new') : undefined}
        addAccessibilityLabel={t('dailyLogs.add')}
      />

      {/* Observational disclaimer — family notes, not a medical assessment. */}
      <View
        style={[
          styles.disclaimer,
          { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.15) },
        ]}>
        <Text style={[styles.disclaimerText, { color: c.textSecondary }]}>{t('figma.dailylogs.disclaimer')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : isError ? (
        <FigmaCard radius={Radius.xl} padding={20}>
          <Text style={[styles.emptyTitle, { color: c.errorFg }]}>{t('dailyLogs.loadError')}</Text>
          <Pressable
            onPress={() => logsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : logs.length === 0 ? (
        <FigmaCard radius={Radius.xl} padding={20}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('dailyLogs.noTodayTitle')}</Text>
          {canAdd ? (
            <Text style={[styles.emptySub, { color: c.textSecondary }]}>{t('dailyLogs.noTodaySubtitle')}</Text>
          ) : (
            <Text style={[styles.emptySub, { color: c.textSecondary }]}>{t('dailyLogs.cannotAdd')}</Text>
          )}
        </FigmaCard>
      ) : (
        logs.map((log) => (
          <LogCard
            key={log.id}
            log={log}
            mine={log.recorded_by !== null && log.recorded_by === userId}
            dateLabel={formatLogDate(log.log_date, i18n.language)}
            relativeLabel={
              log.log_date === today ? t('figma.dailylogs.todayPrefix') : undefined
            }
            onOpen={() => router.push(`/daily-logs/${log.id}`)}
          />
        ))
      )}
    </FigmaScreen>
  );
}

function LogCard({
  log,
  mine,
  dateLabel,
  relativeLabel,
  onOpen,
}: {
  log: DailyCareLog;
  mine: boolean;
  dateLabel: string;
  relativeLabel?: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const fields = describeDailyLog(log, t);
  const notes = describeDailyLogNotes(log, t);
  const heading = relativeLabel ? `${relativeLabel}${dateLabel}` : dateLabel;

  return (
    <FigmaCard
      radius={Radius.xl}
      padding={16}
      onPress={onOpen}
      accessibilityLabel={heading}
      accessibilityHint={t('figma.dailylogs.openHint')}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardDate, { color: c.text }]} numberOfLines={1}>
          {heading}
        </Text>
        {mine ? (
          <Text style={[styles.recorder, { color: c.textSecondary }]}>{t('dailyLogs.mineLabel')}</Text>
        ) : null}
      </View>

      {fields.length > 0 ? (
        <View style={styles.fieldList}>
          {fields.map((field) => {
            const visual = FIELD_VISUAL[field.key] ?? { Icon: Activity, colorKey: 'textSecondary' as ThemeColor };
            const FieldIcon = visual.Icon;
            return (
              <View key={field.key} style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <FieldIcon size={15} color={c[visual.colorKey]} />
                </View>
                <Text style={[styles.fieldLabel, { color: c.textSecondary }]} numberOfLines={1}>
                  {field.label}
                </Text>
                <Text style={[styles.fieldValue, { color: c.text }]} numberOfLines={2}>
                  {field.value}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.notesOnly, { color: c.textSecondary }]}>{t('dailyLogs.notesOnly')}</Text>
      )}

      {notes.length > 0 ? (
        <View style={styles.notesGroup}>
          {notes.map((note) => (
            <View
              key={note.key}
              style={[styles.notesWell, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
              <Text style={[styles.notesLabel, { color: c.textSecondary }]}>{note.label}</Text>
              <Text style={[styles.notesText, { color: c.text }]}>{note.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </FigmaCard>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disclaimerText: { fontSize: 14, lineHeight: 19, fontFamily: FontFamily.regular },
  empty: { fontSize: 14, fontFamily: FontFamily.regular, textAlign: 'center', marginTop: 8 },
  center: { paddingVertical: 64, alignItems: 'center', justifyContent: 'center' },
  retry: { marginTop: 16, minHeight: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  retryText: { fontSize: 16, fontFamily: FontFamily.semibold },
  emptyTitle: { fontSize: 15, fontFamily: FontFamily.semibold },
  emptySub: { fontSize: 14, fontFamily: FontFamily.regular, marginTop: 4 },
  // Log card
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  cardDate: { fontSize: 14, fontFamily: FontFamily.bold, flexShrink: 1 },
  recorder: { fontSize: 14, fontFamily: FontFamily.regular },
  fieldList: { gap: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldIcon: { width: 20, alignItems: 'center' },
  fieldLabel: { fontSize: 14, fontFamily: FontFamily.regular, width: 84, flexShrink: 0 },
  fieldValue: { fontSize: 14, fontFamily: FontFamily.medium, flex: 1 },
  notesOnly: { fontSize: 14, fontFamily: FontFamily.regular },
  notesGroup: { gap: 8, marginTop: 12 },
  notesWell: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  notesLabel: { fontSize: 14, fontFamily: FontFamily.medium },
  notesText: { fontSize: 14, lineHeight: 18, fontFamily: FontFamily.regular },
});
