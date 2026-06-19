import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/constants/icons';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';

import { GlyphChip, type GlyphChipTone } from './glyph-chip';
import { LtrText } from './ltr-text';
import { Surface, type SurfaceTone } from './surface';
import { ThemedText } from './themed-text';

type DashboardTileProps = {
  /** Semantic icon for the tile's identity chip. */
  iconName: IconName;
  /** Short title (feature/destination). */
  title: string;
  /** Optional one concise meta/value line (wraps to at most two lines). */
  meta?: string;
  onPress: () => void;
  /** Identity-chip tone (default 'primary'). */
  tone?: GlyphChipTone;
  /** Tile background tone (default 'card'). */
  surfaceTone?: SurfaceTone;
  /** Title color override (e.g. 'errorFg'). */
  titleColor?: ThemeColor;
  accessibilityHint?: string;
  /** Layout override (e.g. width). Default width suits a 3-up quick-access grid. */
  style?: StyleProp<ViewStyle>;
};

/**
 * A light, compact tile for the **demoted** quick-access grid on Home — a calm
 * icon + label (+ optional one-line meta), sized for a 3-up grid. Deliberately
 * lighter than the rejected "wall of 2-column rectangles": no chevron, a single
 * identity chip, generous tap area. The whole tile is a Surface button (clear tap
 * affordance, ripple/opacity), meets the touch-target floor by minHeight, reads as
 * one node to screen readers, is RTL-safe (logical layout) and theme-tokenized.
 */
export function DashboardTile({
  iconName,
  title,
  meta,
  onPress,
  tone = 'primary',
  surfaceTone = 'card',
  titleColor = 'text',
  accessibilityHint,
  style,
}: DashboardTileProps) {
  return (
    <Surface
      tone={surfaceTone}
      onPress={onPress}
      padded={false}
      accessibilityLabel={meta ? `${title}. ${meta}` : title}
      accessibilityHint={accessibilityHint}
      style={[styles.tile, style]}>
      <GlyphChip iconName={iconName} tone={tone} size="sm" />
      <View style={styles.text}>
        <ThemedText type="cardTitle" themeColor={titleColor} numberOfLines={2}>
          {title}
        </ThemedText>
        {meta ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
    </Surface>
  );
}

type StatTileProps = {
  /** Semantic icon for the identity chip. */
  iconName: IconName;
  /** Chip tone (default 'primary'). */
  tone?: GlyphChipTone;
  /** The prominent value/headline (e.g. a count or a time). */
  value: string;
  /** The quiet label beneath the value. */
  label: string;
  onPress: () => void;
  /** Render the value as an LTR-isolated run (times, codes). */
  ltrValue?: boolean;
  accessibilityHint?: string;
  /** Layout override (e.g. width). Default width suits a 2-up summary row. */
  style?: StyleProp<ViewStyle>;
};

/**
 * A compact "today summary" stat for the Home secondary row — a small card with
 * an identity chip, a prominent value and a quiet label. Smaller and lighter than
 * the hero, so it never competes with it. One accessible node (label + value).
 */
export function StatTile({
  iconName,
  tone = 'primary',
  value,
  label,
  onPress,
  ltrValue = false,
  accessibilityHint,
  style,
}: StatTileProps) {
  return (
    <Surface
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={accessibilityHint}
      style={[styles.stat, style]}>
      <GlyphChip iconName={iconName} tone={tone} size="sm" />
      {ltrValue ? (
        <LtrText type="subtitle" numberOfLines={1}>
          {value}
        </LtrText>
      ) : (
        <ThemedText type="subtitle" numberOfLines={1}>
          {value}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {label}
      </ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31.5%',
    minHeight: 104,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    gap: Spacing.two,
  },
  text: { gap: Spacing.half },
  stat: {
    width: '48%',
    minHeight: 96,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    gap: Spacing.one,
  },
});
