import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlyphChip } from '@/components/glyph-chip';
import { type IconName } from '@/constants/icons';
import { FontFamily, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FigmaListRowProps = {
  /** Leading semantic icon, rendered in a tinted identity chip (GlyphChip). */
  iconName?: IconName;
  /** Chip / accent color as a theme key (category or tone; default primary). */
  color?: ThemeColor;
  /** Or a letterform avatar (e.g. a member initial) instead of an icon. */
  avatarText?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Trailing node; defaults to a forward chevron when `onPress` is set. */
  trailing?: ReactNode;
  /** Hairline separator above the row (every row but the first in a group). */
  topDivider?: boolean;
};

/**
 * A grouped-list row: a tinted identity chip (or letter avatar) + title + optional
 * subtitle + a trailing chevron. Designed to sit inside a `Surface` (padding 0) as
 * a hairline-separated group — the Explore / Account / Members list idiom.
 */
export function FigmaListRow({
  iconName,
  color,
  avatarText,
  title,
  subtitle,
  onPress,
  trailing,
  topDivider = false,
}: FigmaListRowProps) {
  const c = useTheme();
  const accent: ThemeColor = color ?? 'primary';

  const body = (
    <>
      {iconName ? (
        <GlyphChip iconName={iconName} color={accent} size="md" />
      ) : avatarText != null ? (
        <GlyphChip glyph={avatarText} color={accent} size="md" />
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing !== undefined ? (
        trailing
      ) : onPress ? (
        <ChevronLeft size={18} color={c.textSecondary} />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    topDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        android_ripple={{ color: c.backgroundSunken }}
        style={({ pressed }) => [rowStyle, pressed && styles.pressed]}>
        {body}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{body}</View>;
}

/** A small section label (eyebrow) above a grouped list. */
export function FigmaSectionLabel({ label }: { label: string }) {
  const c = useTheme();
  return <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 16, minHeight: 68 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontFamily: FontFamily.semibold },
  // Older-adult floor: meaningful secondary text ≥14.
  subtitle: { fontSize: 14, fontFamily: FontFamily.regular },
  // Section eyebrow raised 13 -> 14 to meet the content floor.
  sectionLabel: { fontSize: 14, fontFamily: FontFamily.bold, letterSpacing: 0.5, marginBottom: 10 },
  pressed: { opacity: 0.85 },
});
