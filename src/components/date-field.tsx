import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  daysInMonth,
  formatYmd,
  parseYmd,
  pad2,
  rangeInclusive,
  type DateFieldProps,
  type Ymd,
} from './date-time-shared';
import { Cairo } from './figma/form-typography';
import { PickerSheet, WheelColumn } from './picker-sheet';
import { ThemedText } from './themed-text';

const MIN_YEAR_OFFSET = 120;
const MAX_YEAR_OFFSET = 5;

function todayParts(): Ymd {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Clamp a date up to `min` (inclusive) when it falls earlier; identity if no min. */
function clampToMin(date: Ymd, min: Ymd | null): Ymd {
  if (!min) return date;
  if (date.year < min.year) return { ...min };
  if (date.year > min.year) return date;
  if (date.month < min.month) return { year: min.year, month: min.month, day: min.day };
  if (date.month > min.month) return date;
  if (date.day < min.day) return { ...date, day: min.day };
  return date;
}

/**
 * Labeled date field that opens a touch-friendly scrollable picker (year / month
 * / day) — no manual 'YYYY-MM-DD' typing. Stores and emits 'YYYY-MM-DD' (or ''
 * when cleared). RTL-friendly and themed; mirrors FormField's label + error
 * chrome. The web build uses a native `<input type="date">` instead (see
 * date-field.web.tsx).
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  clearable = false,
  minDate,
  accessibilityLabel,
}: DateFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const min = minDate ? parseYmd(minDate) : null;
  const [draft, setDraft] = useState<Ymd>(() => clampToMin(parseYmd(value) ?? todayParts(), min));

  const thisYear = new Date().getFullYear();
  // When a min is set, the wheel cannot scroll earlier than it (so past dates are
  // unreachable); otherwise the full 120-year-back range stays (e.g. birth dates).
  const firstYear = min ? min.year : thisYear - MIN_YEAR_OFFSET;
  const years = rangeInclusive(firstYear, thisYear + MAX_YEAR_OFFSET);
  const minMonth = min && draft.year === min.year ? min.month : 1;
  const months = rangeInclusive(minMonth, 12);
  const minDay = min && draft.year === min.year && draft.month === min.month ? min.day : 1;
  const maxDay = daysInMonth(draft.year, draft.month);
  const days = rangeInclusive(minDay, maxDay);
  const selectedDay = Math.min(Math.max(draft.day, minDay), maxDay);

  /** Apply a partial change to the draft, re-clamped to the min date. */
  function updateDraft(part: Partial<Ymd>) {
    setDraft((d) => clampToMin({ ...d, ...part }, min));
  }

  function openSheet() {
    if (disabled) return;
    setDraft(clampToMin(parseYmd(value) ?? todayParts(), min));
    setOpen(true);
  }

  function commit() {
    const clamped = clampToMin(draft, min);
    onChange(formatYmd(clamped.year, clamped.month, Math.min(clamped.day, daysInMonth(clamped.year, clamped.month))));
    setOpen(false);
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  const yearColumn = (
    <WheelColumn
      key="year"
      label={t('pickers.year')}
      values={years}
      selected={draft.year}
      onSelect={(year) => updateDraft({ year })}
      accessibilityLabel={t('pickers.year')}
    />
  );
  const monthColumn = (
    <WheelColumn
      key="month"
      label={t('pickers.month')}
      values={months}
      selected={Math.max(draft.month, minMonth)}
      onSelect={(month) => updateDraft({ month })}
      formatValue={pad2}
      accessibilityLabel={t('pickers.month')}
    />
  );
  const dayColumn = (
    <WheelColumn
      key="day"
      label={t('pickers.day')}
      values={days}
      selected={selectedDay}
      onSelect={(day) => updateDraft({ day })}
      formatValue={pad2}
      accessibilityLabel={t('pickers.day')}
    />
  );
  // Arabic/RTL reads the date day → month → year from the RIGHT. In an RTL row the
  // first child sits at the right edge, so order it day, month, year; LTR keeps the
  // ISO year, month, day. The stored value (YYYY-MM-DD) and clamps are unaffected.
  const dateColumns = I18nManager.isRTL
    ? [dayColumn, monthColumn, yearColumn]
    : [yearColumn, monthColumn, dayColumn];

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
            backgroundColor: theme.backgroundSunken,
            borderColor: error ? theme.errorFg : theme.border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}>
        <ThemedText themeColor={value ? 'text' : 'textMuted'} style={[styles.triggerText, Cairo.regular]}>
          {value || placeholder || t('pickers.setDate')}
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
        title={label ?? t('pickers.selectDate')}
        doneLabel={t('pickers.done')}
        cancelLabel={t('common.cancel')}
        clearLabel={t('pickers.clear')}
        onDone={commit}
        onCancel={() => setOpen(false)}
        onClear={clearable ? clear : undefined}>
        {open ? <View style={styles.columns}>{dateColumns}</View> : null}
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
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: TouchTarget.comfortable,
  },
  triggerText: { fontSize: 16, flexShrink: 1 },
  triggerGlyph: { fontSize: 22, lineHeight: 26, fontWeight: '600' },
  columns: { flexDirection: 'row', gap: Spacing.two },
});
