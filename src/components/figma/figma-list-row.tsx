import { ChevronLeft } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { IconChip } from './icon-chip';
import { FigmaColors, FigmaFont, FigmaRadius, withAlpha } from './figma-tokens';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type FigmaListRowProps = {
  /** Leading lucide icon (rendered in a tinted chip). */
  Icon?: IconCmp;
  /** Chip / accent color for the icon (default primary). */
  color?: string;
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
 * A Figma grouped-list row: a tinted icon chip (or letter avatar) + title +
 * optional subtitle + a trailing chevron. Designed to sit inside a `FigmaCard`
 * (padding 0) as a hairline-separated group — the Figma Explore / Account /
 * Members list idiom.
 */
export function FigmaListRow({
  Icon,
  color,
  avatarText,
  title,
  subtitle,
  onPress,
  trailing,
  topDivider = false,
}: FigmaListRowProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
  const accent = color ?? c.primary;

  const body = (
    <>
      {Icon ? (
        <IconChip Icon={Icon} color={accent} size={44} radius={FigmaRadius.r16} iconSize={22} />
      ) : avatarText != null ? (
        <View style={[styles.avatar, { backgroundColor: withAlpha(accent, 0.15) }]}>
          <Text style={[styles.avatarText, { color: accent }]}>{avatarText}</Text>
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing !== undefined ? trailing : onPress ? <ChevronLeft size={18} color={c.muted} /> : null}
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
        android_ripple={{ color: c.elevated }}
        style={({ pressed }) => [rowStyle, pressed && styles.pressed]}>
        {body}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{body}</View>;
}

/** A small Figma section label (eyebrow) above a grouped list. */
export function FigmaSectionLabel({ label }: { label: string }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
  return <Text style={[styles.sectionLabel, { color: c.muted }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 16, minHeight: 68 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontFamily: FigmaFont.semibold },
  // Older-adult floor: meaningful secondary text ≥14 (was 12).
  subtitle: { fontSize: 14, fontFamily: FigmaFont.regular },
  avatar: { width: 44, height: 44, borderRadius: FigmaRadius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontFamily: FigmaFont.bold },
  sectionLabel: { fontSize: 13, fontFamily: FigmaFont.bold, letterSpacing: 0.5, marginBottom: 10 },
  pressed: { opacity: 0.85 },
});
