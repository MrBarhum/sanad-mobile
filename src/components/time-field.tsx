import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  formatHm12,
  formatHmParts,
  from12h,
  pad2,
  parseHm,
  rangeInclusive,
  to12h,
  type Hm12,
  type TimeFieldProps,
} from './date-time-shared';
import { Cairo } from './figma/form-typography';
import { PickerSheet, WheelColumn } from './picker-sheet';
import { ThemedText } from './themed-text';

function nowParts12(): Hm12 {
  const now = new Date();
  return to12h(now.getHours(), now.getMinutes());
}

function draftFor(value: string): Hm12 {
  const parsed = parseHm(value);
  return parsed ? to12h(parsed.hour, parsed.minute) : nowParts12();
}

/** Minutes 0..59 honoring the step (always includes 0). */
function minuteValues(step: number): number[] {
  if (step <= 1) return rangeInclusive(0, 59);
  const out: number[] = [];
  for (let m = 0; m < 60; m += step) out.push(m);
  return out;
}

const HOURS_12 = rangeInclusive(1, 12);
// 0 = AM (صباحًا), 1 = PM (مساءً) — a 2-value wheel column.
const PERIODS = [0, 1];

/**
 * Labeled time field that opens a touch-friendly scrollable picker. The wheel
 * shows a 12-hour Arabic UX — hour 1–12, minutes, and a صباحًا / مساءً period
 * column — but the field STILL stores and emits 24-hour 'HH:MM' (or '' when
 * cleared), so duplicate-time checks, schedules and notifications are unchanged.
 * No manual typing. The web build uses a native `<input type="time">` (see
 * time-field.web.tsx).
 */
export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  clearable = false,
  minuteStep = 1,
  accessibilityLabel,
}: TimeFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Hm12>(() => draftFor(value));

  const minutes = minuteValues(minuteStep);
  const amLabel = t('pickers.am');
  const pmLabel = t('pickers.pm');
  const display = value ? formatHm12(value, amLabel, pmLabel) : placeholder || t('pickers.setTime');

  function openSheet() {
    if (disabled) return;
    setDraft(draftFor(value));
    setOpen(true);
  }

  function commit() {
    const { hour, minute } = from12h(draft.hour12, draft.minute, draft.period);
    onChange(formatHmParts(hour, minute));
    setOpen(false);
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold" style={Cairo.semibold}>{label}</ThemedText> : null}

      <Pressable
        onPress={openSheet}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.errorFg : theme.border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}>
        <ThemedText themeColor={value ? 'text' : 'textMuted'} style={[styles.triggerText, Cairo.regular]}>
          {display}
        </ThemedText>
        <ThemedText
          style={[styles.triggerGlyph, { color: theme.textMuted }]}
          accessibilityElementsHidden
          importantForAccessibility="no">
          {Glyph.chevron}
        </ThemedText>
      </Pressable>

      {error ? (
        <ThemedText
          type="small"
          style={[{ color: theme.errorFg }, Cairo.regular]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}

      <PickerSheet
        visible={open}
        title={label ?? t('pickers.selectTime')}
        doneLabel={t('pickers.done')}
        cancelLabel={t('common.cancel')}
        clearLabel={t('pickers.clear')}
        onDone={commit}
        onCancel={() => setOpen(false)}
        onClear={clearable ? clear : undefined}>
        {open ? (
          <View style={styles.columns}>
            <WheelColumn
              label={t('pickers.hour')}
              values={HOURS_12}
              selected={draft.hour12}
              onSelect={(hour12) => setDraft((d) => ({ ...d, hour12 }))}
              accessibilityLabel={t('pickers.hour')}
            />
            <WheelColumn
              label={t('pickers.minute')}
              values={minutes}
              selected={draft.minute}
              onSelect={(minute) => setDraft((d) => ({ ...d, minute }))}
              formatValue={pad2}
              accessibilityLabel={t('pickers.minute')}
            />
            <WheelColumn
              label={t('pickers.period')}
              values={PERIODS}
              selected={draft.period === 'pm' ? 1 : 0}
              onSelect={(p) => setDraft((d) => ({ ...d, period: p === 1 ? 'pm' : 'am' }))}
              formatValue={(p) => (p === 1 ? pmLabel : amLabel)}
              accessibilityLabel={t('pickers.period')}
            />
          </View>
        ) : null}
      </PickerSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    minHeight: TouchTarget.comfortable,
  },
  triggerText: { fontSize: 16, flexShrink: 1 },
  triggerGlyph: { fontSize: 22, lineHeight: 26, fontWeight: '600' },
  columns: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
});
