import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gutter } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FigmaScreenProps = {
  children: ReactNode;
  /** Disable the scroll view for a single non-scrolling view. */
  scroll?: boolean;
  /** Vertical gap between direct children. */
  gap?: number;
};

/**
 * The list/detail screen container: a full-bleed, RTL-aware column with the
 * themed background, the 20px gutter, and the device safe-area on top/bottom. No
 * max-width centering — these are full-bleed phone layouts. Use this instead of
 * the legacy `Screen` primitive on the redesigned feature screens.
 */
export function FigmaScreen({ children, scroll = true, gap = 16 }: FigmaScreenProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  const padding = {
    paddingHorizontal: Gutter,
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 24,
  };

  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: c.background }]}>
        <View style={[styles.fill, padding, { gap }]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[padding, { gap }]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
