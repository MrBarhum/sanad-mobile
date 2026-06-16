import {
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type KeyboardTypeOptions,
} from 'react-native';

import { FigmaColors, FigmaFont, FigmaRadius } from './figma-tokens';

type FigmaFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
};

/**
 * The Figma form field: a label above a rounded, elevated input. Cairo, RTL
 * (right-aligned), elevated background with a hairline. A foundation primitive for
 * the Figma add/edit sheets (the validated logic stays in the existing forms).
 */
export function FigmaField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: FigmaFieldProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlign="right"
        style={[
          styles.input,
          { backgroundColor: c.elevated, borderColor: c.border, color: c.text },
          multiline && styles.multiline,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: FigmaFont.semibold },
  input: {
    borderRadius: FigmaRadius.r12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FigmaFont.regular,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});
