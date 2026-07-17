import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import {
  FigmaChipSelect,
  FigmaFieldLabel,
  FigmaFormCard,
  FigmaFormField,
} from '@/components/figma/figma-form-screen';
import { Glyph } from '@/constants/glyphs';
import { FontFamily, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { DailyLogDraft } from './log-fields';
import {
  APPETITE_LEVELS,
  HYDRATION_LEVELS,
  MOBILITY_LEVELS,
  MOODS,
  PAIN_LEVELS,
  SLEEP_QUALITIES,
} from './schema';

/** Sentinel select value meaning "not recorded" (maps to null on save). */
const UNSET = '';

/**
 * Figma-faithful inputs for a daily log — a visual rebuild of the export's date /
 * observational-chips / pain / notes cards, wired to Sanad's draft. It preserves
 * the real "غير محدّد" unset option on every chip group (maps to null) and the
 * DISTINCT "بدون" pain state (null) vs an observed 0 — neither of which the export
 * had. Observational only: no medical/diagnostic wording. The date uses the
 * protected wheel picker.
 */
export function FigmaDailyLogFields({
  draft,
  onChange,
  errors,
}: {
  draft: DailyLogDraft;
  onChange: (patch: Partial<DailyLogDraft>) => void;
  errors: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  function withUnset(group: string, values: readonly string[]) {
    return [
      { value: UNSET, label: t('dailyLogs.unset') },
      ...values.map((value) => ({ value, label: t(`dailyLogs.${group}.${value}`) })),
    ];
  }

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'logDate':
        return t('dailyLogs.errors.logDate');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  function setPain(next: number | null) {
    onChange({ painLevel: next });
  }

  const pain = draft.painLevel;
  const divider = <View style={[styles.divider, { backgroundColor: theme.divider }]} />;

  return (
    <>
      {/* Date */}
      <FigmaFormCard>
        <View style={styles.group}>
          <FigmaFieldLabel label={t('dailyLogs.fields.logDate')} />
          <DateField
            value={draft.logDate}
            onChange={(value) => onChange({ logDate: value })}
            accessibilityLabel={t('dailyLogs.fields.logDate')}
            error={fieldError(errors.log_date)}
          />
        </View>
      </FigmaFormCard>

      {/* Daily observations */}
      <FigmaFormCard label={t('dailyLogs.dailyTitle')}>
        <View style={styles.group}>
          <FigmaFieldLabel label={t('dailyLogs.fields.mood')} />
          <FigmaChipSelect
            value={draft.mood}
            options={withUnset('mood', MOODS)}
            onChange={(value) => onChange({ mood: value })}
          />
        </View>
        {divider}
        <View style={styles.group}>
          <FigmaFieldLabel label={t('dailyLogs.fields.sleepQuality')} />
          <FigmaChipSelect
            value={draft.sleepQuality}
            options={withUnset('sleepQuality', SLEEP_QUALITIES)}
            onChange={(value) => onChange({ sleepQuality: value })}
          />
        </View>
        {divider}
        <View style={styles.group}>
          <FigmaFieldLabel label={t('dailyLogs.fields.appetite')} />
          <FigmaChipSelect
            value={draft.appetite}
            options={withUnset('appetite', APPETITE_LEVELS)}
            onChange={(value) => onChange({ appetite: value })}
          />
        </View>
        {divider}
        <View style={styles.group}>
          <FigmaFieldLabel label={t('dailyLogs.fields.hydration')} />
          <FigmaChipSelect
            value={draft.hydration}
            options={withUnset('hydration', HYDRATION_LEVELS)}
            onChange={(value) => onChange({ hydration: value })}
          />
        </View>
        {divider}
        <View style={styles.group}>
          <FigmaFieldLabel label={t('dailyLogs.fields.mobility')} />
          <FigmaChipSelect
            value={draft.mobility}
            options={withUnset('mobility', MOBILITY_LEVELS)}
            onChange={(value) => onChange({ mobility: value })}
          />
        </View>
      </FigmaFormCard>

      {/* Observed pain — null ("بدون") is distinct from an observed 0 */}
      <FigmaFormCard label={t('dailyLogs.fields.painLevel')}>
        <Text style={[styles.painHint, { color: theme.textMuted }]}>{t('dailyLogs.painScaleHint')}</Text>

        <Pressable
          onPress={() => setPain(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: pain === null }}
          accessibilityLabel={t('dailyLogs.painNone')}
          style={[
            styles.noneChip,
            {
              backgroundColor: pain === null ? theme.primaryBg : theme.backgroundSunken,
              borderColor: pain === null ? theme.primary : theme.border,
            },
          ]}>
          <Text
            style={[
              styles.noneChipText,
              {
                color: pain === null ? theme.primaryText : theme.textSecondary,
                fontFamily: pain === null ? FontFamily.semibold : FontFamily.regular,
              },
            ]}>
            {pain === null ? `${Glyph.check} ${t('dailyLogs.painNone')}` : t('dailyLogs.painNone')}
          </Text>
        </Pressable>

        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setPain(pain === null ? 0 : Math.max(0, pain - 1))}
            accessibilityRole="button"
            accessibilityLabel="-"
            style={[styles.stepButton, { backgroundColor: theme.backgroundSunken, borderColor: theme.border }]}>
            <Minus size={18} color={theme.text} />
          </Pressable>
          <View style={styles.stepValue}>
            <Text style={[styles.painBig, { color: theme.text }]}>{pain === null ? '—' : String(pain)}</Text>
            <Text style={[styles.painOutOf, { color: theme.textMuted }]}>{t('dailyLogs.painOutOf')}</Text>
          </View>
          <Pressable
            onPress={() => setPain(pain === null ? 0 : Math.min(10, pain + 1))}
            accessibilityRole="button"
            accessibilityLabel="+"
            style={[styles.stepButton, { backgroundColor: theme.backgroundSunken, borderColor: theme.border }]}>
            <Plus size={18} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.scaleRow}>
          {PAIN_LEVELS.map((level) => {
            const on = pain === level;
            return (
              <Pressable
                key={level}
                onPress={() => setPain(level)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={String(level)}
                style={[
                  styles.scaleChip,
                  {
                    backgroundColor: on ? theme.primary : theme.backgroundSunken,
                    borderColor: on ? theme.primary : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.scaleChipText,
                    {
                      color: on ? theme.onPrimary : theme.textMuted,
                      fontFamily: on ? FontFamily.bold : FontFamily.regular,
                    },
                  ]}>
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FigmaFormCard>

      {/* Notes */}
      <FigmaFormCard>
        <FigmaFormField
          label={t('dailyLogs.fields.bathroomNotes')}
          value={draft.bathroomNotes}
          onChangeText={(value) => onChange({ bathroomNotes: value })}
          placeholder={t('dailyLogs.placeholders.bathroomNotes')}
          multiline
          error={fieldError(errors.bathroom_notes)}
        />
        <FigmaFormField
          label={t('dailyLogs.fields.foodNotes')}
          value={draft.foodNotes}
          onChangeText={(value) => onChange({ foodNotes: value })}
          placeholder={t('dailyLogs.placeholders.foodNotes')}
          multiline
          error={fieldError(errors.food_notes)}
        />
        <FigmaFormField
          label={t('dailyLogs.fields.activityNotes')}
          value={draft.activityNotes}
          onChangeText={(value) => onChange({ activityNotes: value })}
          placeholder={t('dailyLogs.placeholders.activityNotes')}
          multiline
          error={fieldError(errors.activity_notes)}
        />
        <FigmaFormField
          label={t('dailyLogs.fields.generalNotes')}
          value={draft.generalNotes}
          onChangeText={(value) => onChange({ generalNotes: value })}
          placeholder={t('dailyLogs.placeholders.generalNotes')}
          multiline
          error={fieldError(errors.general_notes)}
        />
      </FigmaFormCard>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth },
  painHint: { fontSize: 14, lineHeight: 18, fontFamily: FontFamily.regular },
  noneChip: {
    minHeight: TouchTarget.min,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  noneChipText: { fontSize: 14 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { flex: 1, alignItems: 'center' },
  painBig: { fontSize: 36, fontFamily: FontFamily.bold, writingDirection: 'ltr' },
  painOutOf: { fontSize: 14, fontFamily: FontFamily.regular },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleChip: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleChipText: { fontSize: 14 },
});
