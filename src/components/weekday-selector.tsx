import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const DANGER = '#dc2626';

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
        <ThemedText type="small" style={styles.error} accessibilityRole="alert">
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [fullWidth && styles.chipFull, pressed && styles.pressed]}>
      <ThemedView
        type={selected ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.chipWrap, fullWidth && styles.chipFull]}>
        <ThemedText
          type="small"
          themeColor={selected ? 'text' : 'textSecondary'}
          style={[styles.chip, selected && styles.chipSelectedText, fullWidth && styles.chipFullText]}>
          {selected ? `✓ ${label}` : label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipWrap: {
    minHeight: 44,
    minWidth: 48,
    borderRadius: Spacing.three,
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
  error: { color: DANGER },
});
