import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Gutter, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FigmaBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * The action bottom sheet: a rounded-top card sliding up over a scrim, with a grab
 * handle and a title. Dismisses on backdrop tap; the caller supplies the actions
 * as `children` (this is the action-sheet variant — no submit/close footer).
 *
 * Shares the ONE canonical sheet chrome (M5 sheet ruling — law) with FormModal and
 * PickerSheet: a centered `backgroundElement` card, `Radius.card` top corners, a
 * hairline border, and an 8dp `backgroundSelected` grab handle. The three sheets
 * differ only in their behavior contract (dismissal / footer / keyboard), never in
 * their chrome.
 */
export function FigmaBottomSheet({ visible, onClose, title, children }: FigmaBottomSheetProps) {
  const c = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: c.overlay }]}
        accessibilityLabel={t('common.close')}
        onPress={onClose}>
        {/* Swallow taps inside the sheet so they don't reach the backdrop. */}
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <ThemedView
            type="backgroundElement"
            style={[styles.sheet, { borderColor: c.border, paddingBottom: insets.bottom + Spacing.four }]}>
            <View style={[styles.grabber, { backgroundColor: c.backgroundSelected }]} />
            <ThemedText type="sectionTitle" accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              {children}
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { width: '100%', maxWidth: MaxFormWidth, alignSelf: 'center' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '85%',
    paddingTop: Spacing.two,
    paddingHorizontal: Gutter,
  },
  // Visual bottom-sheet affordance (dismissal is the backdrop tap).
  grabber: { alignSelf: 'center', width: 48, height: 8, borderRadius: Radius.pill, marginBottom: Spacing.three },
  title: { marginBottom: Spacing.three },
  body: { gap: Spacing.three, paddingBottom: Spacing.two },
});
