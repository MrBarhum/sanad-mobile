import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Radius, Spacing, TouchTarget } from '@/constants/theme';
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
import { PickerSheet, WheelColumn } from './picker-sheet';
import { ThemedText } from './themed-text';

const MIN_YEAR_OFFSET = 120;
const MAX_YEAR_OFFSET = 5;

function todayParts(): Ymd {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * Labeled date field that opens a touch-friendly scrollable picker (year / month
 * / day) â€” no manual 'YYYY-MM-DD' typing. Stores and emits 'YYYY-MM-DD' (or ''
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
  accessibilityLabel,
}: DateFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Ymd>(() => parseYmd(value) ?? todayParts());

  const thisYear = new Date().getFullYear();
  const years = rangeInclusive(thisYear - MIN_YEAR_OFFSET, thisYear + MAX_YEAR_OFFSET);
  const months = rangeInclusive(1, 12);
  const maxDay = daysInMonth(draft.year, draft.month);
  const days = rangeInclusive(1, maxDay);
  const selectedDay = Math.min(draft.day, maxDay);

  function openSheet() {
    if (disabled) return;
    setDraft(parseYmd(value) ?? todayParts());
    setOpen(true);
  }

  function commit() {
    onChange(formatYmd(draft.year, draft.month, Math.min(draft.day, daysInMonth(draft.year, draft.month))));
    setOpen(false);
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}

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
        <ThemedText themeColor={value ? 'text' : 'textMuted'} style={styles.triggerText}>
          {value || placeholder || t('pickers.setDate')}
        </ThemedText>
        <ThemedText
          style={[styles.triggerGlyph, { color: theme.textMuted }]}
          accessibilityElementsHidden
          importantForAccessibility="no">
          â€º
        </ThemedText>
      </Pressable>

      {error ? (
        <ThemedText
          type="small"
          style={{ color: theme.errorFg }}
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
        {open ? (
          <View style={styles.columns}>
            <WheelColumn
              label={t('pickers.year')}
              values={years}
              selected={draft.year}
              onSelect={(year) => setDraft((d) => ({ ...d, year }))}
              accessibilityLabel={t('pickers.year')}
            />
            <WheelColumn
              label={t('pickers.month')}
              values={months}
              selected={draft.month}
              onSelect={(month) => setDraft((d) => ({ ...d, month }))}
              formatValue={pad2}
              accessibilityLabel={t('pickers.month')}
            />
            <WheelColumn
              label={t('pickers.day')}
              values={days}
              selected={selectedDay}
              onSelect={(day) => setDraft((d) => ({ ...d, day }))}
              formatValue={pad2}
              accessibilityLabel={t('pickers.day')}
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
  triggerText: { fontFamily: FontFamily.regular, fontSize: 16, flexShrink: 1 },
  triggerGlyph: { fontSize: 22, lineHeight: 26, fontWeight: '600' },
  columns: { flexDirection: 'row', gap: Spacing.two },
});
