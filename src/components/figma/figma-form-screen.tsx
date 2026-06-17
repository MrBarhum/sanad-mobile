import { ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FigmaFont } from './figma-tokens';

/**
 * Figma "add screen" shell — an exact-copy rebuild of the missing-screens export's
 * Add* layout (AddMedicationScreen / AddVitalScreen): a fixed header (rounded
 * back button + stacked title/subtitle + hairline divider), a full-bleed gold
 * disclaimer banner, a scrolling stack of cards, and a sticky save footer.
 *
 * Colors come from the committed theme (already the Figma teal / warm-graphite
 * palette — NOT the export's hardcoded blue) and type is Cairo (NOT the export's
 * IBM Plex). The caller passes the save button as `footer` so each screen keeps
 * its own disabled/loading/error wiring.
 */
export function FigmaFormScreen({
  title,
  subtitle,
  onBack,
  disclaimer,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  disclaimer: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.divider },
          ]}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={[styles.backButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {/* ChevronRight = "back" in RTL (points toward the start edge). */}
            <ChevronRight size={18} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Medical / non-diagnostic disclaimer banner (gold) */}
        <View style={[styles.banner, { backgroundColor: theme.accentBg }]}>
          <Text style={[styles.bannerText, { color: theme.accentFg }]}>{disclaimer}</Text>
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        {/* Sticky save footer */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.divider,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ]}>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * A Figma form card: the elevated surface with a hairline border and a large
 * radius that groups one section of the form, with an optional muted section
 * label. Mirrors the export's `background:card, borderRadius:16, padding:16` card.
 */
export function FigmaFormCard({ label, children }: { label?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {label ? <FigmaSectionLabel>{label}</FigmaSectionLabel> : null}
      {children}
    </View>
  );
}

/** The muted card section label (export: 13px / 600 / muted, margin-bottom 14). */
export function FigmaSectionLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{children}</Text>;
}

/** A field label (export: 14px / 600 / textSecondary) with an optional required mark. */
export function FigmaFieldLabel({ label, required }: { label: string; required?: boolean }) {
  const theme = useTheme();
  return (
    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
      {label}
      {required ? <Text style={{ color: theme.errorFg }}> *</Text> : null}
    </Text>
  );
}

/**
 * A Figma text field: a label above a raised, rounded input with a teal focus
 * ring, exactly mirroring the export's `TextField` (raised fill, 1.5px border,
 * radius 10, Cairo). RTL Arabic content aligns to the start automatically — no
 * forced text alignment, so any LTR content stays readable. `multiline` renders
 * a 3-row note box. Validation/errors stay owned by the caller.
 */
export function FigmaFormField({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  hint,
  error,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.errorFg : focused ? theme.primary : theme.border;

  return (
    <View style={styles.field}>
      {label ? <FigmaFieldLabel label={label} required={required} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { backgroundColor: theme.backgroundSunken, borderColor, color: theme.text },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text> : null}
      {error ? (
        <Text
          style={[styles.error, { color: theme.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A Figma pill toggle (the export's "with food" switch): a 48×28 track with a
 * white thumb that slides to the trailing edge when on. Accessible as a switch;
 * the caller owns the boolean.
 */
export function FigmaSwitch({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? theme.primary : theme.backgroundSunken,
          borderColor: value ? theme.primary : theme.border,
          // RTL-aware via flexbox: off = leading edge, on = trailing edge.
          justifyContent: value ? 'flex-end' : 'flex-start',
        },
      ]}>
      <View style={styles.switchThumb} />
    </Pressable>
  );
}

type ChipOption<T extends string> = { value: T; label: string };

/**
 * A Figma single-choice chip group: a wrap of rounded pills that clearly read as
 * tappable chips (raised surface + hairline unselected; teal fill + teal border +
 * leading check + bold when selected — never color-only). ≥48dp targets, RTL-safe
 * wrap. Use for measurement-type / category / type selectors on the Figma forms.
 */
export function FigmaChipSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly ChipOption<T>[];
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={opt.label}
            style={[
              styles.chip,
              {
                backgroundColor: on ? theme.primaryBg : theme.backgroundSunken,
                borderColor: on ? theme.primary : theme.border,
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                {
                  color: on ? theme.primaryText : theme.textSecondary,
                  fontFamily: on ? FigmaFont.semibold : FigmaFont.regular,
                },
              ]}>
              {on ? `${Glyph.check} ${opt.label}` : opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: FigmaFont.bold },
  headerSubtitle: { fontSize: 12, fontFamily: FigmaFont.regular, marginTop: 1 },
  banner: { paddingVertical: 10, paddingHorizontal: Spacing.three },
  bannerText: { fontSize: 12, lineHeight: 18, fontFamily: FigmaFont.regular },
  scrollContent: { padding: Spacing.three, gap: Spacing.three },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  sectionLabel: { fontSize: 13, fontFamily: FigmaFont.semibold },
  field: { gap: 5 },
  fieldLabel: { fontSize: 14, fontFamily: FigmaFont.semibold },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FigmaFont.regular,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  hint: { fontSize: 12, fontFamily: FigmaFont.regular },
  error: { fontSize: 13, fontFamily: FigmaFont.regular },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: TouchTarget.min,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13 },
});
