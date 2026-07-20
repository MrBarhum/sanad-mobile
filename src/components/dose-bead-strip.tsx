import { Check, Clock, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isolateLtr } from '@/components/ltr-text';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** A dose's logged status (null = scheduled/upcoming, not yet logged). */
export type DoseBeadStatus = 'given' | 'postponed' | 'missed' | null;

export type DoseBead = {
  key: string;
  status: DoseBeadStatus;
  /** Display time, e.g. formatHm() output («7:00 ص»); rendered LTR-isolated. */
  time: string;
};

/** Per-status bead treatment (fill token · icon color token · icon · stroke). */
const BEAD: Record<'given' | 'postponed' | 'missed' | 'upcoming', {
  fill: ThemeColor;
  ink: ThemeColor;
  Icon: IconCmp;
  stroke: number;
}> = {
  given: { fill: 'primary', ink: 'onPrimary', Icon: Check, stroke: 2.8 },
  postponed: { fill: 'warningBg', ink: 'warningFg', Icon: Clock, stroke: 2.4 },
  missed: { fill: 'errorBg', ink: 'errorFg', Icon: X, stroke: 2.4 },
  upcoming: { fill: 'backgroundElement', ink: 'textSecondary', Icon: Clock, stroke: 2.4 },
};

type DoseBeadStripProps = {
  /** The visible doses (caller slices to ≤5 in scheduled order). */
  beads: DoseBead[];
  /**
   * The ONE spoken summary for the whole strip (e.g. «… : 3 من 5 جرعة تم إعطاؤها»).
   * The strip is a single accessible node with this label; individual beads are
   * hidden from the screen reader — preserving the care-loop ring's a11y contract
   * (one summary, never N announced beads).
   */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The Dar dose-bead strip — the home care-loop, replacing the SVG ring. One 40px
 * bordered cell (radius 6) per dose: given = `btn` fill + `btnInk` check;
 * postponed = `twarn` fill + `warn` clock; missed = `terr` fill + `err` X; upcoming
 * = `card` fill + `mut` clock. The LTR time sits 14/600 below each cell.
 */
export function DoseBeadStrip({ beads, accessibilityLabel, style }: DoseBeadStripProps) {
  const c = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={[styles.strip, style]}>
      {beads.map((bead) => {
        const cfg = BEAD[bead.status ?? 'upcoming'];
        const Icon = cfg.Icon;
        return (
          <View
            key={bead.key}
            style={styles.beadCol}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <View style={[styles.cell, { backgroundColor: c[cfg.fill], borderColor: c.border }]}>
              <Icon size={16} color={c[cfg.ink]} strokeWidth={cfg.stroke} />
            </View>
            <Text style={[styles.time, { color: c.textSecondary }]}>{isolateLtr(bead.time)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6 },
  beadCol: { flex: 1 },
  cell: {
    height: 40,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { textAlign: 'center', fontSize: 14, fontFamily: FontFamily.medium, marginTop: 3, writingDirection: 'ltr' },
});
