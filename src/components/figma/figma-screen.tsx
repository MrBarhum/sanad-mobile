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
  /**
   * Full-bleed Dar header band, rendered edge-to-edge ABOVE the padded content
   * (no horizontal gutter). It reaches the very top of the screen — the band node
   * supplies its own top safe-area inset and background so the fill runs under the
   * status bar. When omitted the content keeps the usual safe-area top padding.
   */
  band?: ReactNode;
  /** Horizontal padding for the content column (default Gutter; Dar bands pass 16). */
  contentGutter?: number;
};

/**
 * The tab/list/detail screen container: a full-bleed, RTL-aware column with the
 * themed background and the device safe-area on top/bottom. No max-width centering
 * — these are full-bleed phone layouts. Pass `band` for the Dar header band, which
 * escapes the gutter and runs to the top edge.
 */
export function FigmaScreen({
  children,
  scroll = true,
  gap = 16,
  band,
  contentGutter = Gutter,
}: FigmaScreenProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  // With a band, the band is full-bleed and owns the top inset; the content sits
  // below it with the gutter + a top gap. Without a band, keep the classic
  // safe-area-top padded column (backward compatible for every existing screen).
  const content = band ? (
    <>
      {band}
      <View style={{ paddingHorizontal: contentGutter, paddingTop: 16, gap }}>{children}</View>
    </>
  ) : (
    children
  );

  const containerStyle = band
    ? { paddingBottom: insets.bottom + 24 }
    : {
        paddingHorizontal: contentGutter,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 24,
        gap,
      };

  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: c.background }]}>
        <View style={[styles.fill, containerStyle]}>{content}</View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={containerStyle}
        showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
