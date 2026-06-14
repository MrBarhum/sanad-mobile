import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** Days of the week, 0 = Sunday .. 6 = Saturday (matches the DB convention). */
const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

type WeekdaySelectorProps = {
  /** Selected day numbers (0 = Sun .. 6 = Sat). Empty means none selected. */
  value: number[];
  onChange: (next: number[]) => void;
  /** Short chip labels indexed 0 (Sun) .. 6 (Sat). */
  dayLabels: readonly string[];
  /** Full names for accessibility, indexed 0 (Sun) .. 6 (Sat). */
  accessibilityDayLabels?: readonly string[];
  /** Label for the explicit select-all / clear-all control (e.g. "Every day"). */
  everyDayLabel: string;
  label?: string;
  error?: string;
};

/**
 * Explicit multi-select for weekdays. Selection is opt-IN: a fresh schedule
 * starts with NO days selected and tapping a day SELECTS it (selected = filled,
 * unselected = neutral). The "Every day" control selects all seven when not all
 * are selected, and clears them when all are. Days are stored as 0 (Sun)..6
 * (Sat). Validation that at least one day is chosen lives in the parent schema;
 * pass its message via `error`.
 */
export function WeekdaySelector({
  value,
  onChange,
  dayLabels,
  accessibilityDayLabels,
  everyDayLabel,
  label,
  error,
}: WeekdaySelectorProps) {
  const theme = useTheme();
  const selected = new Set(value);
  const allSelected = DAY_INDEXES.every((day) => selected.has(day));

  function toggleDay(day: number) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort((a, b) => a - b));
  }

  function toggleEveryDay() {
    onChange(allSelected ? [] : [...DAY_INDEXES]);
  }

  return (
    <View style={styles.section}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}

      <Chip selected={allSelected} label={everyDayLabel} onPress={toggleEveryDay} fullWidth />

      <View style={styles.days}>
        {DAY_INDEXES.map((day) => (
          <Chip
            key={day}
            selected={selected.has(day)}
            label={dayLabels[day]}
            accessibilityLabel={accessibilityDayLabels?.[day] ?? dayLabels[day]}
            onPress={() => toggleDay(day)}
          />
        ))}
      </View>

      {error ? (
        <ThemedText type="small" style={{ color: theme.errorFg }} accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Chip({
  selected,
  label,
  accessibilityLabel,
  onPress,
  fullWidth = false,
}: {
  selected: boolean;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chipWrap,
        fullWidth && styles.chipFull,
        {
          backgroundColor: selected ? theme.primaryBg : theme.backgroundSelected,
          borderColor: selected ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText
        type="small"
        themeColor={selected ? 'primaryText' : 'textSecondary'}
        style={[styles.chip, selected && styles.chipSelectedText, fullWidth && styles.chipFullText]}>
        {selected ? `${Glyph.check} ${label}` : label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipWrap: {
    minHeight: TouchTarget.min,
    minWidth: TouchTarget.min,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  chipFull: { alignSelf: 'stretch' },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlign: 'center',
  },
  chipSelectedText: { fontWeight: '700' },
  chipFullText: { paddingVertical: Spacing.three },
  pressed: { opacity: 0.7 },
});
