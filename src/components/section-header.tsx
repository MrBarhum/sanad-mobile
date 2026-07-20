import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SectionHeaderProps = {
  title: string;
  /** Convenience: an underlined accent link on the end side (e.g. «عرض الكل»). */
  linkLabel?: string;
  onLinkPress?: () => void;
  /** Custom trailing content on the end side (overrides linkLabel) — e.g. a
   *  share icon next to the link. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The Dar section header: a 10×10 solid `btn`-colored square + a 16/800 title, with
 * an optional underlined `acc` link (or custom `trailing`) on the end side. Group
 * label for a screen section — matches the HTML section headers exactly.
 */
export function SectionHeader({ title, linkLabel, onLinkPress, trailing, style }: SectionHeaderProps) {
  const c = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleGroup}>
        <View style={[styles.square, { backgroundColor: c.primary }]} />
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {trailing ??
        (linkLabel ? (
          <Pressable onPress={onLinkPress} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.link, { color: c.primaryText }]}>{linkLabel}</Text>
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  square: { width: 10, height: 10 },
  title: { fontSize: 16, fontFamily: FontFamily.bold, flexShrink: 1 },
  link: { fontSize: 15, fontFamily: FontFamily.semibold, textDecorationLine: 'underline' },
});
