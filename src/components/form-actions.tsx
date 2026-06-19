import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FigmaFooterPrimaryButton } from './figma/figma-footer-primary-button';
import { FormButton } from './figma/form-button';
import { Cairo } from './figma/form-typography';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export type FormActionsStatus = 'idle' | 'saved' | 'error';

type SharedProps = {
  /** Primary save label — a specific creation label ("Add medication") on create
   * forms, or the "Save changes" equivalent on edit forms. */
  saveLabel: string;
  onSave: () => void;
  saving?: boolean;
  /** Inline save status shown above the button. */
  status?: FormActionsStatus;
  savedLabel?: string;
  errorLabel?: string;
  /** Optional non-destructive secondary action (e.g. Cancel). Destructive actions
   * (delete) deliberately live elsewhere so save is never mixed with them. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  saveAccessibilityHint?: string;
};

function ActionsBody({
  saveLabel,
  onSave,
  saving = false,
  status = 'idle',
  savedLabel,
  errorLabel,
  secondaryLabel,
  onSecondary,
  saveAccessibilityHint,
}: SharedProps) {
  const theme = useTheme();
  return (
    <View style={styles.body}>
      {status === 'saved' && savedLabel ? (
        <ThemedText
          style={[styles.status, Cairo.semibold, { color: theme.successFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {savedLabel}
        </ThemedText>
      ) : null}
      {status === 'error' && errorLabel ? (
        <ThemedText
          style={[styles.status, Cairo.semibold, { color: theme.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {errorLabel}
        </ThemedText>
      ) : null}
      {/* The ONE forced bottom CTA: always a full-width filled teal rectangle, only
          busy-gated by `saving` — never disabled-greyed. Validation lives in the
          caller's onSave (an invalid press shows inline field errors, not a submit). */}
      <FigmaFooterPrimaryButton
        label={saveLabel}
        onPress={onSave}
        loading={saving}
        accessibilityHint={saveAccessibilityHint}
      />
      {secondaryLabel && onSecondary ? (
        <FormButton label={secondaryLabel} onPress={onSecondary} variant="secondary" disabled={saving} />
      ) : null}
    </View>
  );
}

/**
 * Inline form actions: a primary save button (plus optional secondary), with an
 * inline saved/error status. Use at the logical end of a form. Kept visually
 * clear of any destructive actions on the screen.
 */
export function FormActions(props: SharedProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.inline, props.style]}>
      <ActionsBody {...props} />
    </View>
  );
}

/**
 * Sticky bottom action container for long forms. Render it as a sibling AFTER the
 * scrollable content (not inside the ScrollView) so it stays reachable while the
 * form scrolls. Adds a top divider and respects the bottom safe-area inset.
 */
export function StickyFormActions(props: SharedProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <ThemedView
      style={[
        styles.sticky,
        { borderTopColor: theme.divider, paddingBottom: Spacing.three + insets.bottom },
      ]}>
      <View style={styles.stickyInner}>
        <ActionsBody {...props} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  inline: { marginTop: Spacing.two },
  body: { gap: Spacing.two },
  status: { fontSize: 14, fontWeight: '600' },
  sticky: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  stickyInner: { width: '100%', maxWidth: MaxFormWidth, alignSelf: 'center' },
});
