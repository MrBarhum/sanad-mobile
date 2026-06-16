import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { FigmaColors, FigmaFont, FigmaRing } from './figma-tokens';

type CareLoopRingProps = {
  /** Doses given today. */
  given: number;
  /** Doses scheduled today. */
  total: number;
};

/**
 * The Figma signature "care loop" arc, copied verbatim from the Figma Make
 * `HomeScreen.tsx` → `CareLoopArc` geometry, drawn with `react-native-svg`
 * (NOT the old bordered-View ring):
 *   144×144, cx/cy 72, r 54, stroke 10, round caps, a 60° bottom gap (300° arc),
 *   start angle 120°, teal fill over a faint track, with `given/total` +
 *   "جرعات اليوم" centered in Cairo.
 *
 * The progress sweep is proportional to given/total (clamped, total=0 safe). The
 * SVG is decorative (hidden from screen readers); the wrapper carries one spoken
 * label describing the dose loop.
 */
export function CareLoopRing({ given, total }: CareLoopRingProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  const { size, cx, cy, radius, stroke, gapAngle, startAngle } = FigmaRing;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * ((360 - gapAngle) / 360);
  const safeGiven = total > 0 ? Math.max(0, Math.min(given, total)) : 0;
  const progress = total > 0 ? (safeGiven / total) * arcLength : 0;

  const a11yLabel =
    total > 0
      ? t('careCircle.dashboard.today.loopA11y', { given: safeGiven, total })
      : t('careCircle.dashboard.today.loopA11yNone');

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}>
      <Svg
        width={size}
        height={size}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <G rotation={startAngle} originX={cx} originY={cy}>
          {/* Track — the full 300° arc, faint. */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={c.ringTrack}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={[arcLength, circumference]}
          />
          {/* Progress — teal, proportional to given/total. */}
          {total > 0 ? (
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={c.primary}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={[progress, circumference]}
            />
          ) : null}
        </G>
      </Svg>

      <View
        style={styles.center}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text style={[styles.count, { color: c.text }]}>
          {safeGiven}
          <Text style={[styles.total, { color: c.muted }]}>/{total}</Text>
        </Text>
        <Text style={[styles.label, { color: c.muted }]}>{t('medications.todayTitle')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: FigmaRing.size, height: FigmaRing.size },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  // Keep "given/total" in LTR order even inside the RTL UI (it is a numeric run).
  count: { fontFamily: FigmaFont.bold, fontSize: 26, lineHeight: 30, writingDirection: 'ltr' },
  total: { fontFamily: FigmaFont.regular, fontSize: 15 },
  label: { fontFamily: FigmaFont.regular, fontSize: 11, lineHeight: 16, marginTop: 2 },
});
