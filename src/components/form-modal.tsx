import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MaxFormWidth, Spacing } from '@/constants/theme';

import { Button } from './button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const DANGER = '#dc2626';

type FormModalProps = {
  visible: boolean;
  title: string;
  submitLabel: string;
  cancelLabel: string;
  closeLabel: string;
  submitting?: boolean;
  /** Disable the submit button (e.g. no changes yet, or validation failing). */
  submitDisabled?: boolean;
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
  submitDisabled = false,
  error,
  onSubmit,
  onClose,
  children,
}: FormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
              {title}
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              hitSlop={Spacing.two}>
              <ThemedText style={styles.close}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {children}

            {error ? (
              <ThemedText
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.actions}>
              <Button
                label={submitLabel}
                onPress={onSubmit}
                loading={submitting}
                disabled={submitting || submitDisabled}
                style={styles.action}
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
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '90%',
    paddingTop: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 24, lineHeight: 32, flexShrink: 1 },
  close: { fontSize: 20, fontWeight: '600', padding: Spacing.one },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  error: { color: DANGER },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  action: { width: '100%' },
});
