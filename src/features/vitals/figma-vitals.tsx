import { useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { GlyphChip, type GlyphChipTone } from '@/components/glyph-chip';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState } from '@/components/states';
import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { hmFromInstant, todayYmd, ymdFromInstant } from '@/utils/date';

import type { VitalReading, VitalReadingType } from './api';
import { formatVitalValue } from './describe';
import { useVitals } from './hooks';

/**
 * Per-type icon + category TONE for the vital cards. NON-DIAGNOSTIC: the tone is a
 * fixed per-type category accent (a visual aid only) — it never encodes a
 * normal/abnormal judgement of the value. Tones resolve to the Dar tint pairs the
 * frame draws on each icon square (primary → tacc/acc, success → tok/ok, warning
 * → twarn/warn). The per-type icon glyph is unchanged.
 */
const VITAL_VISUAL: Record<VitalReadingType, { iconName: IconName; tone: GlyphChipTone }> = {
  blood_pressure: { iconName: 'activity', tone: 'primary' },
  heart_rate: { iconName: 'heart', tone: 'success' },
  temperature: { iconName: 'temperature', tone: 'warning' },
  blood_sugar: { iconName: 'drop', tone: 'primary' },
  oxygen_saturation: { iconName: 'oxygen', tone: 'success' },
  weight: { iconName: 'weight', tone: 'warning' },
  other: { iconName: 'doctor', tone: 'primary' },
};

/**
 * The Dar vital-readings list (frame 8d): a deep-green sub-screen header (back +
 * «القياسات الحيوية» + filled add), a strong non-diagnostic disclaimer well, then a
 * 2-column grid of reading cards — a tinted per-type icon square, the type name,
 * the measured value + unit (big, LTR, baseline-aligned), and the timestamp meta.
 * Strictly NON-DIAGNOSTIC: value + unit + time only, no normal/abnormal labels and
 * no health-based color coding. Tap → /vitals/[id]. Reuses `useVitals`,
 * `formatVitalValue`, and the `reading_type` / `reading_at` / `recorded_by` fields
 * verbatim. Cairo + Dar tokens, both themes, RTL. Behaviour/data/routing unchanged.
 */
export function FigmaVitals({
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
  const c = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const vitalsQuery = useVitals(circleId);
  const canAdd = canManage || canCollaborate;

  const readings = vitalsQuery.data ?? [];
  const today = todayYmd();

  const header = (
    <FigmaHeader
      title={t('vitals.title')}
      onAdd={canAdd ? () => router.push('/vitals/new') : undefined}
      addAccessibilityLabel={t('vitals.add')}
    />
  );

  // Non-diagnostic disclaimer well — tacc (primaryBg) tint, 2px border, an info
  // glyph in the green accent, and a 14/700 line in the ink tone (frame 8d).
  const disclaimer = (
    <View style={[styles.disclaimer, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
      <Info size={18} color={c.primaryText} strokeWidth={2.2} style={styles.disclaimerIcon} />
      <Text style={[styles.disclaimerText, { color: c.text }]}>{t('vitals.disclaimer')}</Text>
    </View>
  );

  // Loading / error / empty states — calm, never a guessed value.
  if (vitalsQuery.isLoading) {
    return (
      <FigmaScreen>
        {header}
        {disclaimer}
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </FigmaScreen>
    );
  }

  if (vitalsQuery.isError) {
    return (
      <FigmaScreen>
        {header}
        {disclaimer}
        <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('vitals.loadError')}</Text>
          <Pressable
            onPress={() => vitalsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </View>
      </FigmaScreen>
    );
  }

  if (!vitalsQuery.isLoading && readings.length === 0) {
    return (
      <FigmaScreen>
        {header}
        {disclaimer}
        <EmptyState
          iconName="vital"
          title={t('vitals.noTodayTitle')}
          subtitle={canAdd ? t('figma.vitals.emptySubtitle') : undefined}
        />
      </FigmaScreen>
    );
  }

  return (
    <FigmaScreen>
      {header}
      {disclaimer}

      <View style={styles.grid}>
        {readings.map((reading) => (
          <VitalCard
            key={reading.id}
            reading={reading}
            today={today}
            mine={reading.recorded_by !== null && reading.recorded_by === userId}
            onOpen={() => router.push(`/vitals/${reading.id}`)}
          />
        ))}
      </View>
    </FigmaScreen>
  );
}

function VitalCard({
  reading,
  today,
  mine,
  onOpen,
}: {
  reading: VitalReading;
  today: string;
  mine: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const visual = VITAL_VISUAL[reading.reading_type];
  const typeLabel = t(`vitals.type.${reading.reading_type}`);

  // The measured value with its unit, split into a large value + small unit to
  // mirror the frame's baseline-aligned value/unit pair (LTR). NON-DIAGNOSTIC.
  const full = formatVitalValue(reading);
  const unit = reading.unit ?? '';
  const value = unit && full.endsWith(unit) ? full.slice(0, full.length - unit.length).trim() : full;

  const day = ymdFromInstant(reading.reading_at);
  const time = hmFromInstant(reading.reading_at);
  const when =
    day && time
      ? day === today
        ? `${t('figma.vitals.today')} ${isolateLtr(time)}`
        : isolateLtr(`${day} ${time}`)
      : '';

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel}${value ? `: ${value} ${unit}` : ''}`}
      accessibilityHint={when}
      android_ripple={{ color: c.backgroundSelected }}
      style={[
        styles.cell,
        { backgroundColor: c.backgroundElement, borderColor: c.border },
      ]}>
      <GlyphChip iconName={visual.iconName} tone={visual.tone} size="sm" style={styles.cellChip} />
      <Text style={[styles.type, { color: c.textSecondary }]} numberOfLines={1}>
        {typeLabel}
      </Text>
      {value ? (
        <Text style={[styles.valueLine, { color: c.text }]} numberOfLines={1}>
          {isolateLtr(value)}
          {unit ? (
            <Text style={[styles.unit, { color: c.textSecondary }]}>{` ${unit}`}</Text>
          ) : null}
        </Text>
      ) : null}
      {when ? (
        <Text style={[styles.meta, { color: c.textSecondary }]} numberOfLines={1}>
          {when}
          {mine ? ` · ${t('vitals.mineLabel')}` : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Non-diagnostic disclaimer well (frame: tacc fill, 2px border, info + 14/700 ink).
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  disclaimerIcon: { marginTop: 3, flexShrink: 0 },
  disclaimerText: { flex: 1, fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 23 },
  // 2-column reading grid.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '47%',
    flexGrow: 1,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  // Frame's 38px tinted icon square (GlyphChip keeps its 2px border + radius 6).
  cellChip: { width: 38, height: 38 },
  type: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 22, marginTop: 8 },
  // Big LTR value + small unit on one baseline, anchored to the start (RTL right).
  valueLine: {
    writingDirection: 'ltr',
    textAlign: 'right',
    fontSize: 24,
    fontFamily: FontFamily.black,
    lineHeight: 32,
    marginTop: 2,
  },
  unit: { fontSize: 14, fontFamily: FontFamily.semibold },
  meta: { fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 22, marginTop: 2 },
  // States.
  center: { paddingVertical: 64, alignItems: 'center', justifyContent: 'center' },
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
});
