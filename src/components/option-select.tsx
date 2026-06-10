import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Button } from './button';
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
 * A labeled single-choice chip group. Renders each option as a small button —
 * the selected one filled (`primary`), the rest subtle (`secondary`). Built from
 * the shared Button so it follows the theme and RTL layout automatically, and
 * behaves identically on web and native (no native picker). Used for the small
 * enum choices on the task / appointment / visit forms.
 */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: OptionSelectProps<T>) {
  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <View style={styles.options}>
        {options.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={option.value === value ? 'primary' : 'secondary'}
            label={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
