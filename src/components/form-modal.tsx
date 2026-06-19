import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/constants/glyphs';
import { MaxFormWidth, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FigmaFooterPrimaryButton } from './figma/figma-footer-primary-button';
import { FormButton } from './figma/form-button';
import { Cairo } from './figma/form-typography';
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
            <ThemedText type="sectionTitle" style={[styles.title, Cairo.bold]} accessibilityRole="header">
              {title}
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              hitSlop={Spacing.two}
              style={styles.closeButton}>
              <ThemedText style={[styles.close, Cairo.semibold]}>{Glyph.cross}</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Spacing.five + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {children}

            {error ? (
              <ThemedText
                style={[{ color: theme.errorFg }, Cairo.regular]}
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
              <FormButton
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
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '92%',
    paddingTop: Spacing.two,
  },
  // Visual bottom-sheet affordance (dismissal stays explicit via Cancel/close).
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radius.pill,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { flexShrink: 1 },
  closeButton: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { fontSize: 20, fontWeight: '600' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  action: { width: '100%' },
});
