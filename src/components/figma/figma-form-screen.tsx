import { ChevronRight, Info } from 'lucide-react-native';
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
import { useTranslation } from 'react-i18next';

import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The Dar "add / edit" form shell: a full-bleed deep-green header band (bordered
 * back square + stacked title/subtitle), an optional gold non-diagnostic banner as
 * the first bordered card, a scrolling stack of cards, and the save footer as the
 * last in-flow block. Cairo + Dar tokens, both themes, RTL. The caller passes the
 * save button as `footer` so each screen keeps its own loading/error wiring.
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
  const { t } = useTranslation();
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header band */}
        <View style={[styles.band, { backgroundColor: c.band, paddingTop: insets.top + 16 }]}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[styles.backButton, { borderColor: c.bandInk }]}>
            <ChevronRight size={20} color={c.bandInk} strokeWidth={2.4} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: c.bandInk }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.headerSubtitle, { color: c.bandInk }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Gold non-diagnostic disclaimer (first card) — only when provided. */}
          {disclaimer ? (
            <View style={[styles.banner, { backgroundColor: c.goldFill, borderColor: c.border }]}>
              <Info size={20} color={c.goldInk} strokeWidth={2.2} style={styles.bannerIcon} />
              <Text style={[styles.bannerText, { color: c.goldInk }]}>{disclaimer}</Text>
            </View>
          ) : null}

          {children}

          {/* Inline footer — the FINAL block INSIDE the ScrollView (not pinned; a
              pinned KAV-sibling footer proved invisible on Android). */}
          {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The Dar card section header: a 10×10 solid `btn` square + a 16/800 title. */
export function FigmaSectionLabel({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionSquare, { backgroundColor: c.primary }]} />
      <Text style={[styles.sectionTitle, { color: c.text }]}>{children}</Text>
    </View>
  );
}

/** A field label (15 / 700) with an optional « (مطلوب)» marker in the danger tone. */
export function FigmaFieldLabel({ label, required }: { label: string; required?: boolean }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <Text style={[styles.fieldLabel, { color: c.text }]}>
      {label}
      {required ? <Text style={{ color: c.errorFg }}>{` (${t('common.required')})`}</Text> : null}
    </Text>
  );
}

/**
 * The Dar brand toggle (48×28 pill): 2px-thin border, `sunken` off / `btn` on, a
 * `card`-colored thumb with a border. Accessible as a switch; the caller owns the boolean.
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
  const c = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? c.primary : c.backgroundSunken,
          borderColor: value ? c.primary : c.border,
          justifyContent: value ? 'flex-end' : 'flex-start',
        },
      ]}>
      <View style={[styles.switchThumb, { backgroundColor: c.backgroundElement, borderColor: c.border }]} />
    </Pressable>
  );
}

/** A small muted explanatory line (e.g. the non-medical coordination disclaimers). */
export function FigmaMutedNote({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={[styles.mutedNote, { color: c.textSecondary }]}>{children}</Text>;
}

/** A label + optional hint on the start, a pill switch on the end. */
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
  const c = useTheme();
  return (
    <View>
      {topDivider ? <View style={[styles.toggleDivider, { backgroundColor: c.border }]} /> : null}
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={[styles.toggleLabel, { color: c.text }]}>{label}</Text>
          {hint ? <Text style={[styles.toggleHint, { color: c.textSecondary }]}>{hint}</Text> : null}
        </View>
        <FigmaSwitch value={value} onValueChange={onValueChange} accessibilityLabel={label} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  band: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 20, fontFamily: FontFamily.bold, lineHeight: 28 },
  headerSubtitle: { fontSize: 14, fontFamily: FontFamily.medium, opacity: 0.85, marginTop: 1 },
  headerSpacer: { width: 44, flexShrink: 0 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 14, gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerIcon: { marginTop: 2 },
  bannerText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 25 },
  footer: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionSquare: { width: 10, height: 10 },
  sectionTitle: { fontSize: 16, fontFamily: FontFamily.bold },
  fieldLabel: { fontSize: 15, fontFamily: FontFamily.semibold },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.thin,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  switchThumb: { width: 20, height: 20, borderRadius: 10, borderWidth: BorderWidth.thin },
  mutedNote: { fontSize: 14, lineHeight: 22, fontFamily: FontFamily.medium },
  toggleDivider: { height: BorderWidth.standard, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 15, fontFamily: FontFamily.medium },
  toggleHint: { fontSize: 14, fontFamily: FontFamily.medium },
});
