import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FigmaBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * The add/edit bottom sheet: a rounded-top card sliding up over a scrim, with a
 * grab handle and a title. A foundation primitive for the sheet-based forms.
 */
export function FigmaBottomSheet({ visible, onClose, title, children }: FigmaBottomSheetProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: c.overlay }]}
        accessibilityLabel="close"
        onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <View style={[styles.sheet, { backgroundColor: c.backgroundElement, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.handle, { backgroundColor: withAlpha(c.textSecondary, 0.4) }]} />
            <Text style={[styles.title, { color: c.text }]}>{title}</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              {children}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { width: '100%' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  handle: { width: 48, height: 4, borderRadius: Radius.pill, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontFamily: FontFamily.bold, marginBottom: 16 },
  body: { gap: 12 },
});
