import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

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
   * `chip` (default) — a wrap of compact segmented chips.
   * `card` — full-width stacked cards with a radio + title + optional description
   * (the "pick one, with explanation" choice, e.g. a role picker).
   */
  variant?: 'chip' | 'card';
};

/**
 * A labeled single-choice selector — the ONE selection primitive for category /
 * priority / type / unit / role enums on the care forms.
 *
 * Each option is a FULL-AREA Pressable with a clearly visible outline so it reads
 * as a tappable control, never loose text: unselected = soft neutral fill +
 * hairline; selected = brand tint + brand border + a leading check + bold label,
 * so the choice is never carried by color alone (a11y). Meets the 48dp touch
 * floor, RTL-safe, identical on web + native. `chip` wraps compact pills; `card`
 * stacks full-width rows with a radio + title + optional description.
 */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  variant = 'chip',
}: OptionSelectProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
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
                    backgroundColor: selected ? theme.primaryBg : theme.backgroundSelected,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}>
                <View
                  style={[
                    styles.radio,
                    { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : 'transparent' },
                  ]}>
                  {selected ? (
                    <ThemedText style={[styles.radioCheck, { color: theme.onPrimary }]}>{Glyph.check}</ThemedText>
                  ) : null}
                </View>
                <View style={styles.optionText}>
                  <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'primaryText' : 'text'}>
                    {option.label}
                  </ThemedText>
                  {option.description ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {option.description}
                    </ThemedText>
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
                  {
                    backgroundColor: selected ? theme.primaryBg : theme.backgroundSelected,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}>
                <ThemedText
                  type={selected ? 'smallBold' : 'small'}
                  themeColor={selected ? 'primaryText' : 'text'}>
                  {selected ? `${Glyph.check} ${option.label}` : option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: TouchTarget.min,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardList: { gap: Spacing.two },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    minHeight: TouchTarget.min,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.three,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioCheck: { fontSize: 13, lineHeight: 15, fontWeight: '800' },
  optionText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
