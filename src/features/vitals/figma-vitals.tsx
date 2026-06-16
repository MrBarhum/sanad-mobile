import { useRouter } from 'expo-router';
import {
  Activity,
  Droplets,
  Heart,
  Stethoscope,
  Thermometer,
  Weight,
  Wind,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { IconChip } from '@/components/figma/icon-chip';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { useAuth } from '@/providers';
import { hmFromInstant, todayYmd, ymdFromInstant } from '@/utils/date';

import type { VitalReading, VitalReadingType } from './api';
import { formatVitalValue } from './describe';
import { useVitals } from './hooks';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Per-type icon + category color for the vital cards. NON-DIAGNOSTIC: the color is
 * a fixed per-type category accent (a visual aid only) — it never encodes a
 * normal/abnormal judgement of the value. Mirrors the Figma `VitalsScreen` chips.
 */
const VITAL_VISUAL: Record<VitalReadingType, { Icon: IconCmp; color: string }> = {
  blood_pressure: { Icon: Activity, color: FigmaCategory.blue },
  heart_rate: { Icon: Heart, color: FigmaCategory.purple },
  temperature: { Icon: Thermometer, color: FigmaCategory.gold },
  blood_sugar: { Icon: Droplets, color: FigmaCategory.purple },
  oxygen_saturation: { Icon: Wind, color: FigmaCategory.green },
  weight: { Icon: Weight, color: FigmaCategory.gold },
  other: { Icon: Stethoscope, color: FigmaCategory.teal },
};

/**
 * The Figma Make `VitalsScreen`, recreated as literally as possible in React
 * Native and wired to real Sanad data. Header (back + title + teal add), the
 * strong non-diagnostic disclaimer banner, then a 2-column grid of vital cards:
 * a category-colored type icon chip, the type name, the measured value + unit,
 * and the timestamp. Strictly NON-DIAGNOSTIC — value + unit + time only, no
 * normal/abnormal labels and no health-based color coding. Tap → /vitals/[id].
 * Reuses `VitalsCenter`'s hooks/fields verbatim (`useVitals`, `formatVitalValue`,
 * `reading_type`, `reading_at`, `recorded_by`). No old Sanad Screen/Surface/
 * Section/GlyphChip.
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
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
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

  const disclaimer = (
    <View
      style={[
        styles.disclaimer,
        { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.15) },
      ]}>
      <Text style={[styles.disclaimerText, { color: c.muted }]}>{t('vitals.disclaimer')}</Text>
    </View>
  );

  // Loading / error / empty states — calm, never a guessed value.
  if (vitalsQuery.isError) {
    return (
      <FigmaScreen>
        {header}
        {disclaimer}
        <FigmaCard radius={FigmaRadius.r24} padding={20}>
          <Text style={[styles.stateTitle, { color: c.text }]}>{t('vitals.loadError')}</Text>
        </FigmaCard>
      </FigmaScreen>
    );
  }

  if (!vitalsQuery.isLoading && readings.length === 0) {
    return (
      <FigmaScreen>
        {header}
        {disclaimer}
        <FigmaCard radius={FigmaRadius.r24} padding={24}>
          <View style={styles.emptyInner}>
            <IconChip Icon={Activity} color={c.primary} size={48} radius={FigmaRadius.r16} iconSize={24} />
            <Text style={[styles.stateTitle, { color: c.text }]}>{t('vitals.noTodayTitle')}</Text>
            {canAdd ? (
              <Text style={[styles.stateSub, { color: c.muted }]}>{t('figma.vitals.emptySubtitle')}</Text>
            ) : null}
          </View>
        </FigmaCard>
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
            scheme={scheme}
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
  scheme,
  today,
  mine,
  onOpen,
}: {
  reading: VitalReading;
  scheme: FigmaScheme;
  today: string;
  mine: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];
  const visual = VITAL_VISUAL[reading.reading_type];
  const typeLabel = t(`vitals.type.${reading.reading_type}`);

  // The measured value with its unit, split into a large value + small unit to
  // mirror the Figma baseline-aligned value/unit pair. NON-DIAGNOSTIC.
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
    <FigmaCard
      tone="card"
      radius={FigmaRadius.r24}
      padding={16}
      onPress={onOpen}
      accessibilityLabel={`${typeLabel}${value ? `: ${value} ${unit}` : ''}`}
      accessibilityHint={when}
      style={styles.cell}>
      <IconChip
        Icon={visual.Icon}
        color={visual.color}
        size={40}
        radius={FigmaRadius.r12}
        iconSize={20}
        style={styles.cellChip}
      />
      <Text style={[styles.type, { color: c.muted }]} numberOfLines={1}>
        {typeLabel}
      </Text>
      {value ? (
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: c.text }]} numberOfLines={1}>
            {isolateLtr(value)}
          </Text>
          {unit ? (
            <Text style={[styles.unit, { color: c.muted }]} numberOfLines={1}>
              {unit}
            </Text>
          ) : null}
        </View>
      ) : null}
      {when ? (
        <Text style={[styles.time, { color: c.muted }]} numberOfLines={1}>
          {when}
          {mine ? ` · ${t('vitals.mineLabel')}` : ''}
        </Text>
      ) : null}
    </FigmaCard>
  );
}

const styles = StyleSheet.create({
  // Disclaimer banner (Figma: teal-tinted rounded-2xl well).
  disclaimer: {
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disclaimerText: { fontSize: 12, lineHeight: 19, fontFamily: FigmaFont.regular },
  // 2-column grid.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47%', flexGrow: 1 },
  cellChip: { marginBottom: 12 },
  type: { fontSize: 11, fontFamily: FigmaFont.regular },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  value: { fontSize: 22, fontFamily: FigmaFont.bold, lineHeight: 26 },
  unit: { fontSize: 11, fontFamily: FigmaFont.regular },
  time: { fontSize: 10, fontFamily: FigmaFont.regular, marginTop: 4 },
  // States.
  stateTitle: { fontSize: 15, fontFamily: FigmaFont.semibold, textAlign: 'center' },
  stateSub: { fontSize: 12, fontFamily: FigmaFont.regular, textAlign: 'center' },
  emptyInner: { alignItems: 'center', gap: 10 },
});
