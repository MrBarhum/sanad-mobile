import { useRouter } from 'expo-router';
import { Activity, Droplets, Info, Moon, Smile, Utensils } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState } from '@/components/states';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import type { DailyCareLog } from './api';
import { describeDailyLog, describeDailyLogNotes } from './describe';
import { useDailyLogs } from './hooks';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Dar tone → the icon foreground token it draws with. */
type FieldTone = 'primary' | 'success' | 'warning' | 'error';
const TONE_FG: Record<FieldTone, ThemeColor> = {
  primary: 'primaryText',
  success: 'successFg',
  warning: 'warningFg',
  error: 'errorFg',
};

/**
 * Per-field icon + Dar tone, keyed by the structured `LogDetail.key`s that
 * `describeDailyLog` emits (mood / sleep / appetite / hydration / pain / mobility).
 * The 8e frame draws EVERY observation-row icon in the green accent (`--acc`), so
 * every observation type maps to the `primary` tone — Dar collapses the per-feature
 * hue onto the single green accent; identity comes from the glyph, not the color.
 * (tacc→primary, tok→success, twarn→warning, terr→error is the tone vocabulary.)
 * Purely observational decoration — no clinical judgement is implied.
 */
const FIELD_VISUAL: Record<string, { Icon: IconCmp; tone: FieldTone }> = {
  mood: { Icon: Smile, tone: 'primary' },
  sleep: { Icon: Moon, tone: 'primary' },
  appetite: { Icon: Utensils, tone: 'primary' },
  hydration: { Icon: Droplets, tone: 'primary' },
  pain: { Icon: Activity, tone: 'primary' },
  mobility: { Icon: Activity, tone: 'primary' },
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
 * The Dar "السجل اليومي" (daily logs) list — frame 8e. A deep-green sub-screen band
 * (back + title + add), a bordered observational disclaimer (info glyph + "family
 * notes, not a medical assessment"), then one bordered card per log: a date + your-
 * log marker, a 2px sunken rule, structured observation rows (icon + label + value)
 * or a "notes only" line, and any free-text notes as sunken wells. Observational
 * only — never a clinical judgement. Cairo + Dar tokens, both themes, RTL. Reuses
 * the center's hooks (`useDailyLogs`) and `describe*` helpers verbatim; behaviour,
 * data and routing are unchanged.
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
      <View style={[styles.disclaimer, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
        <Info size={18} color={c.primaryText} strokeWidth={2.2} style={styles.disclaimerIcon} />
        <Text style={[styles.disclaimerText, { color: c.text }]}>{t('figma.dailylogs.disclaimer')}</Text>
      </View>

      {isLoading ? (
        <SkeletonList />
      ) : isError ? (
        <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('dailyLogs.loadError')}</Text>
          <Pressable
            onPress={() => logsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : logs.length === 0 ? (
        <EmptyState
          iconName="dailyLog"
          title={t('dailyLogs.noTodayTitle')}
          subtitle={t(canAdd ? 'dailyLogs.noTodaySubtitle' : 'dailyLogs.cannotAdd')}
        />
      ) : (
        <View style={styles.list}>
          {logs.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              mine={log.recorded_by !== null && log.recorded_by === userId}
              dateLabel={formatLogDate(log.log_date, i18n.language)}
              relativeLabel={log.log_date === today ? t('figma.dailylogs.todayPrefix') : undefined}
              onOpen={() => router.push(`/daily-logs/${log.id}`)}
            />
          ))}
        </View>
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
    <Surface
      radius={Radius.card}
      padded={14}
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

      <View style={[styles.divider, { backgroundColor: c.backgroundSunken }]} />

      {fields.length > 0 ? (
        <View style={styles.fieldList}>
          {fields.map((field) => {
            const visual = FIELD_VISUAL[field.key] ?? { Icon: Activity, tone: 'primary' as FieldTone };
            const FieldIcon = visual.Icon;
            return (
              <View key={field.key} style={styles.fieldRow}>
                <FieldIcon size={16} color={c[TONE_FG[visual.tone]]} strokeWidth={2} />
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
        <View style={[styles.notesGroup, { marginTop: fields.length > 0 ? 10 : 8 }]}>
          {notes.map((note) => (
            <View
              key={note.key}
              style={[styles.notesWell, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
              <Text style={[styles.notesLabel, { color: c.text }]}>{note.label}</Text>
              <Text style={[styles.notesText, { color: c.text }]}>{note.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  // Observational disclaimer (tacc tint, bordered, info glyph)
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  disclaimerIcon: { marginTop: 3, flexShrink: 0 },
  disclaimerText: { flex: 1, fontSize: 14, lineHeight: 23, fontFamily: FontFamily.semibold },
  // Error card
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.control,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Log cards
  list: { gap: 10 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardDate: { fontSize: 16, fontFamily: FontFamily.bold, flexShrink: 1 },
  recorder: { fontSize: 14, fontFamily: FontFamily.semibold, flexShrink: 0 },
  divider: { height: 2, marginVertical: 10 },
  // Structured observation rows
  fieldList: { gap: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldLabel: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold },
  fieldValue: { fontSize: 16, fontFamily: FontFamily.bold, flexShrink: 0 },
  notesOnly: { fontSize: 15, fontFamily: FontFamily.semibold },
  // Free-text note wells (sunken, bordered)
  notesGroup: { gap: 8 },
  notesWell: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  notesLabel: { fontSize: 14, fontFamily: FontFamily.bold },
  notesText: { fontSize: 15, lineHeight: 25, fontFamily: FontFamily.medium },
});
