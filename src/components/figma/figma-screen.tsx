import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FigmaColors, FigmaLayout } from './figma-tokens';

type FigmaScreenProps = {
  children: ReactNode;
  /** Disable the scroll view for a single non-scrolling view. */
  scroll?: boolean;
  /** Vertical gap between direct children. */
  gap?: number;
};

/**
 * The Figma exact-copy screen container: a full-bleed, RTL-aware column with the
 * Figma background, the Figma 20px gutter, and the device safe-area on top/bottom
 * (replacing the export's fake `pt-14` status-bar inset). No max-width centering
 * — the Figma screens are full-bleed phone layouts. Use this instead of the
 * legacy `Screen` primitive on Figma-faithful screens.
 */
export function FigmaScreen({ children, scroll = true, gap = 16 }: FigmaScreenProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
  const insets = useSafeAreaInsets();

  const padding = {
    paddingHorizontal: FigmaLayout.gutter,
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
