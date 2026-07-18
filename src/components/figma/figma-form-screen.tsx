import { ArrowRight } from 'lucide-react-native';
import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Gutter, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The "add screen" shell: a fixed header (rounded back button + stacked
 * title/subtitle + hairline divider), an optional full-bleed gold disclaimer
 * banner, a scrolling stack of cards, and the save footer.
 *
 * Colors and type both come from the single token system (theme.ts + IBM Plex
 * Sans Arabic). The caller passes the save button as `footer` so each screen keeps
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
  /** Gold non-diagnostic banner text. Omit on non-medical screens (no banner). */
  disclaimer?: string;
  /** Sticky footer (e.g. the save button). Omit for read-only screens (no bar). */
  footer?: ReactNode;
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
            {/* ArrowRight = "back" in RTL (points toward the start edge) — matches FigmaHeader. */}
            <ArrowRight size={20} color={theme.text} />
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

        {/* Medical / non-diagnostic disclaimer banner (gold) — only when provided. */}
        {disclaimer ? (
          <View style={[styles.banner, { backgroundColor: theme.accentBg }]}>
            <Text style={[styles.bannerText, { color: theme.accentFg }]}>{disclaimer}</Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.four }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}

          {/* Inline footer (fallback) — rendered as the FINAL block INSIDE the
              ScrollView content, NOT pinned. Pinned/KAV-sibling footers proved
              invisible on the Android device, so the CTA lives in the normal scroll
              flow as the last visible block; on long forms the user scrolls to
              reach it. Its own bottom padding clears the Android nav / safe area,
              and it stretches full-width like the form cards above it. */}
          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
              {footer}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The muted card section label (14 / 600 / muted). */
export function FigmaSectionLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{children}</Text>;
}

/** A field label (14 / 600 / textSecondary) with an optional required mark. */
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
 * A pill toggle: a 48×28 track with a white thumb that slides to the trailing edge
 * when on. Accessible as a switch; the caller owns the boolean.
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

/** A small muted explanatory line (e.g. the non-medical coordination disclaimers). */
export function FigmaMutedNote({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.mutedNote, { color: theme.textSecondary }]}>{children}</Text>;
}

/**
 * A label + optional hint on the start, a pill switch on the end — the "with food"
 * / "link to my account" row. Optional top divider for when it follows other
 * fields inside the same card.
 */
export function FigmaToggleRow({
  label,
  hint,
  value,
  onValueChange,
  topDivider,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  topDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      {topDivider ? <View style={[styles.toggleDivider, { backgroundColor: theme.divider }]} /> : null}
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
          {hint ? <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
        </View>
        <FigmaSwitch value={value} onValueChange={onValueChange} accessibilityLabel={label} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Matches FigmaHeader's canonical round back affordance (44dp pill).
  backButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: FontFamily.bold },
  // Raised to the 14 content floor (was 12).
  headerSubtitle: { fontSize: 14, fontFamily: FontFamily.regular, marginTop: 1 },
  banner: { paddingVertical: 10, paddingHorizontal: Gutter },
  bannerText: { fontSize: 14, lineHeight: 21, fontFamily: FontFamily.regular },
  scrollContent: { paddingHorizontal: Gutter, paddingTop: Spacing.three, gap: Spacing.three },
  // Inline footer block: extra separation above the CTA beyond the scroll-content
  // gap. Horizontal inset comes from scrollContent's padding; bottom (safe-area)
  // padding is applied inline at the call site.
  footer: { marginTop: Spacing.two },
  sectionLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  fieldLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
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
  mutedNote: { fontSize: 14, lineHeight: 21, fontFamily: FontFamily.regular },
  toggleDivider: { height: StyleSheet.hairlineWidth, marginBottom: Spacing.three },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 15, fontFamily: FontFamily.regular },
  toggleHint: { fontSize: 14, fontFamily: FontFamily.regular },
});
