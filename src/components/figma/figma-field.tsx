import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FigmaFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
};

/**
 * A label above a rounded, recessed input. RTL (start-aligned), with a hairline.
 * (Phase B folds this into the shared `FormField`.)
 */
export function FigmaField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: FigmaFieldProps) {
  const c = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlign="right"
        style={[
          styles.input,
          { backgroundColor: c.backgroundSunken, borderColor: c.border, color: c.text },
          multiline && styles.multiline,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontFamily: FontFamily.semibold },
  input: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});
