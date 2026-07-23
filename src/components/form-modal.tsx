import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderWidth, FontFamily, Gutter, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FigmaFooterPrimaryButton } from './figma/figma-footer-primary-button';
import { Button } from './button';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type FormModalProps = {
  visible: boolean;
  title: string;
  submitLabel: string;
  cancelLabel: string;
  closeLabel: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Bottom-sheet modal hosting an add/edit form. Cross-platform (react-native
 * Modal renders as an overlay on web too). Closing is explicit via the header
 * close button or Cancel — no backdrop-tap dismissal — to avoid losing input by
 * accident and to keep behavior identical on web and native. The caller owns the
 * form fields (`children`) and validation; this only provides the chrome.
 */
export function FormModal({
  visible,
  title,
  submitLabel,
  cancelLabel,
  closeLabel,
  submitting = false,
  error,
  onSubmit,
  onClose,
  children,
}: FormModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView type="backgroundElement" style={[styles.sheet, { borderColor: theme.border }]}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              hitSlop={Spacing.two}
              style={[
                styles.closeSquare,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}>
              {/* 34dp visual per the frame; hitSlop lifts the tap target back over
                  the 44dp floor (older-adult accessibility). */}
              <Icon name="close" size={18} color="text" />
            </Pressable>
            <ThemedText style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              {title}
            </ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Spacing.five + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {children}

            {error ? (
              <ThemedText
                style={{ color: theme.errorFg }}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.actions}>
              {/* The ONE forced bottom CTA: always a full-width filled teal
                  rectangle, only busy-gated by `loading` — never disabled-greyed.
                  Validation lives in the caller's onSubmit (an invalid press shows
                  inline errors, not a submit). */}
              <FigmaFooterPrimaryButton
                label={submitLabel}
                onPress={onSubmit}
                loading={submitting}
              />
              <Button
                label={cancelLabel}
                onPress={onClose}
                variant="secondary"
                disabled={submitting}
                style={styles.action}
              />
            </View>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: BorderWidth.standard,
    maxHeight: '92%',
    paddingTop: Spacing.two,
  },
  // Visual bottom-sheet affordance (dismissal stays explicit via Cancel/close).
  grabber: {
    alignSelf: 'center',
    width: 48,
    height: 8,
    borderRadius: Radius.pill,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Gutter,
    gap: Spacing.two,
  },
  // Centered 18/800 title, balanced by the close square (start) + an equal spacer.
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: FontFamily.bold },
  closeSquare: {
    width: 34,
    height: 34,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 34 },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  action: { width: '100%' },
});
