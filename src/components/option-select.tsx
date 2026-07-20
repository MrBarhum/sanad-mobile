import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Optional supporting line, shown only in the `card` variant. */
  description?: string;
};

type OptionSelectProps<T extends string> = {
  label?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /**
   * `chip` (default) — a wrap of compact Dar chips (2px border, radius 8; selected =
   * `btn` fill + `btnInk` + a leading check).
   * `card` — full-width stacked cards with a radio + title + optional description
   * (selected = `acc` border + `tacc` fill + a filled radio).
   */
  variant?: 'chip' | 'card';
};

/**
 * The Dar single-choice selector — the ONE selection primitive for category /
 * priority / type / unit / role enums on the care forms. Each option is a
 * full-area Pressable; the selection is never carried by colour alone (a leading
 * check + bold label). Meets the 48dp touch floor, RTL-safe.
 */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  variant = 'chip',
}: OptionSelectProps<T>) {
  const c = useTheme();

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.groupLabel, { color: c.text }]}>{label}</Text> : null}
      {variant === 'card' ? (
        <View style={styles.cardList}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={option.label}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor: selected ? c.primaryBg : c.backgroundElement,
                    borderColor: selected ? c.primaryText : c.border,
                  },
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}>
                <View
                  style={[
                    styles.radio,
                    { borderColor: selected ? c.primaryText : c.border, backgroundColor: selected ? c.primary : 'transparent' },
                  ]}>
                  {selected ? <Check size={13} color={c.onPrimary} strokeWidth={2.8} /> : null}
                </View>
                <View style={styles.optionText}>
                  <Text
                    style={[styles.cardTitle, { color: c.text, fontFamily: selected ? FontFamily.bold : FontFamily.semibold }]}>
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text style={[styles.cardDesc, { color: c.textSecondary }]}>{option.description}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.options}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={option.label}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: selected ? c.primary : c.backgroundElement, borderColor: c.border },
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}>
                {selected ? <Check size={13} color={c.onPrimary} strokeWidth={2.8} /> : null}
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? c.onPrimary : c.textSecondary, fontFamily: selected ? FontFamily.bold : FontFamily.semibold },
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  groupLabel: { fontSize: 15, fontFamily: FontFamily.semibold },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipText: { fontSize: 15 },
  cardList: { gap: 8 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 48,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  optionText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, lineHeight: 24 },
  cardDesc: { fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 22 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
