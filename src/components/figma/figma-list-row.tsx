import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlyphChip, type GlyphChipTone } from '@/components/glyph-chip';
import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** GlyphChip tint props — either a semantic tone or a legacy identity color. */
type ChipTint = { tone: GlyphChipTone } | { color: ThemeColor };

type FigmaListRowProps = {
  /** Leading semantic icon, rendered in a tinted identity chip (GlyphChip). */
  iconName?: IconName;
  /** Semantic tint of the icon square (accent / success / warning / error …). */
  tone?: GlyphChipTone;
  /** Legacy per-feature identity color (overridden by `tone`); default primary. */
  color?: ThemeColor;
  /** Or a letterform avatar (e.g. a member initial) instead of an icon. */
  avatarText?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Trailing node; defaults to a back chevron when `onPress` is set. */
  trailing?: ReactNode;
  /** 2px separator above the row (every row but the first in a group). */
  topDivider?: boolean;
};

/**
 * The Dar grouped-list row: a 40dp tinted icon square (2px `line`, radius 6) + a
 * 16/800 title + optional 14/600 muted subtitle + a trailing back chevron. Sits
 * inside a `Surface` (padding 0) as a 2px-separated group — the Explore / Account /
 * Members list idiom, and the picker rows on forms.
 */
export function FigmaListRow({
  iconName,
  tone,
  color,
  avatarText,
  title,
  subtitle,
  onPress,
  trailing,
  topDivider = false,
}: FigmaListRowProps) {
  const c = useTheme();
  // `tone` wins (semantic Dar tint); else the legacy identity `color`; else primary.
  const chipTint: ChipTint = tone ? { tone } : { color: color ?? 'primary' };

  const body = (
    <>
      {iconName ? (
        <GlyphChip iconName={iconName} size="md" {...chipTint} />
      ) : avatarText != null ? (
        <GlyphChip glyph={avatarText} size="md" {...chipTint} />
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
        <ChevronLeft size={17} color={c.textSecondary} strokeWidth={2.2} />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    topDivider && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontFamily: FontFamily.bold },
  // Older-adult floor: meaningful secondary text ≥14.
  subtitle: { fontSize: 14, fontFamily: FontFamily.medium },
  // Section eyebrow raised 13 -> 14 to meet the content floor.
  sectionLabel: { fontSize: 14, fontFamily: FontFamily.bold, letterSpacing: 0.5, marginBottom: 10 },
  pressed: { opacity: 0.85 },
});
