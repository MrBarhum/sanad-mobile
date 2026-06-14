import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type OptionSelectProps<T extends string> = {
  label?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
};

/**
 * A labeled single-choice segmented chip group (category / priority / type /
 * unit / role enums on the care forms).
 *
 * Each option is a FULL-AREA Pressable chip with a clearly visible outline, so it
 * reads as a tappable control on the screen canvas rather than as loose text:
 *   - unselected — soft neutral fill (`backgroundSelected`) + a 1.5dp `border`
 *                  edge so it sits visibly above the canvas in light AND dark;
 *   - selected   — brand tint (`primaryBg`) + brand border + a leading check
 *                  glyph + bold label, so the choice is never carried by color
 *                  alone (a11y) and is obvious at a glance.
 * Meets the 48dp touch floor, wraps gracefully on narrow widths, and is RTL-safe
 * (row + gap, no physical left/right offsets). `radio` role + selected/disabled
 * accessibility state. Behaves identically on web and native (no native picker).
 *
 * NOTE: this intentionally does NOT use the generic `Button` `secondary` variant
 * — that variant is a quiet, near-canvas fill tuned for on-card actions, and as a
 * standalone on-canvas chip it provided almost no affordance (the regression that
 * made these options look unclickable).
 */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: OptionSelectProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
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
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
