import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  formatHmParts,
  pad2,
  parseHm,
  rangeInclusive,
  type Hm,
  type TimeFieldProps,
} from './date-time-shared';
import { PickerSheet, WheelColumn } from './picker-sheet';
import { ThemedText } from './themed-text';

function nowParts(): Hm {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}

/** Minutes 0..59 honoring the step (always includes 0). */
function minuteValues(step: number): number[] {
  if (step <= 1) return rangeInclusive(0, 59);
  const out: number[] = [];
  for (let m = 0; m < 60; m += step) out.push(m);
  return out;
}

/**
 * Labeled time field that opens a touch-friendly scrollable picker (hour /
 * minute) â€” no manual 'HH:MM' typing. Stores and emits 24-hour 'HH:MM' (or ''
 * when cleared). The web build uses a native `<input type="time">` instead (see
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
  const [draft, setDraft] = useState<Hm>(() => parseHm(value) ?? nowParts());

  const hours = rangeInclusive(0, 23);
  const minutes = minuteValues(minuteStep);

  function openSheet() {
    if (disabled) return;
    setDraft(parseHm(value) ?? nowParts());
    setOpen(true);
  }

  function commit() {
    onChange(formatHmParts(draft.hour, draft.minute));
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
          {value || placeholder || t('pickers.setTime')}
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
              values={hours}
              selected={draft.hour}
              onSelect={(hour) => setDraft((d) => ({ ...d, hour }))}
              formatValue={pad2}
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
  columns: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
});
