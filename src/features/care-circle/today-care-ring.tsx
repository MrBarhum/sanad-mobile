import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LtrText } from '@/components/ltr-text';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sanad's signature "Today Care Ring" — a calm, no-dependency care-loop motif.
 *
 * It expresses how much of today's medication loop is closed: a bordered ring
 * badge (state-colored, with the given/total count or a check inside) paired with
 * a short segmented strip. It is implemented with plain Views + tokens + <Icon>
 * (no react-native-svg, no animation), so it has zero new dependencies and can
 * grow into the home/activity-feed signature later.
 *
 * Discipline honored here:
 *  - Never color-only: the visible `caption` always states the meaning in words,
 *    and a count/icon sits inside the ring.
 *  - No health judgment: this reflects *recorded dose completion* (a task loop),
 *    never a clinical interpretation; tones are accent ("today/now"), success
 *    ("loop closed") and neutral ("nothing scheduled") — not health colors.
 *  - RTL-safe: rows/segments use logical flex, so they mirror; no physical edges.
 *  - Dark mode: every color comes from theme tokens.
 * The ring graphic + strip are decorative (hidden from screen readers); the
 * parent surface carries the spoken label.
 */

type CareLoopState = 'loading' | 'empty' | 'progress' | 'complete';

type TodayCareRingProps = {
  given: number;
  total: number;
  loading?: boolean;
  /** Localized title shown beside the ring (e.g. "Today's care loop"). */
  title: string;
  /** Localized caption that states the loop status in words (carries the meaning). */
  caption: string;
};

const RING_DIAMETER = 84;
const RING_BORDER = 8;
/** Above this many doses the strip shows a proportional bar instead of one-per-dose. */
const MAX_SEGMENTS = 8;

function loopState(loading: boolean, given: number, total: number): CareLoopState {
  if (loading) return 'loading';
  if (total === 0) return 'empty';
  return given >= total ? 'complete' : 'progress';
}

export function TodayCareRing({ given, total, loading = false, title, caption }: TodayCareRingProps) {
  const theme = useTheme();
  const state = loopState(loading, given, total);

  const ringBorder: ThemeColor =
    state === 'complete' ? 'successFg' : state === 'progress' ? 'accentSolid' : 'border';
  const ringBg: ThemeColor =
    state === 'complete' ? 'successBg' : state === 'progress' ? 'accentBg' : 'backgroundSunken';
  const fill: ThemeColor = state === 'complete' ? 'successFg' : 'accentSolid';

  const showStrip = state === 'progress' || state === 'complete';
  const segmentCount = Math.min(total, MAX_SEGMENTS);
  const filledCount =
    total <= MAX_SEGMENTS ? given : Math.round((given / total) * MAX_SEGMENTS);

  return (
    <View style={styles.row}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.ring, { borderColor: theme[ringBorder], backgroundColor: theme[ringBg] }]}>
        {state === 'complete' ? (
          <Icon name="success" size="lg" color="successFg" />
        ) : state === 'progress' ? (
          <LtrText style={styles.count} themeColor="accentFg">
            {`${given}/${total}`}
          </LtrText>
        ) : (
          <Icon name="medication" size="lg" color="textSecondary" />
        )}
      </View>

      <View style={styles.text}>
        <ThemedText type="cardTitle">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {caption}
        </ThemedText>
        {showStrip ? (
          <View
            style={styles.segments}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {Array.from({ length: segmentCount }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  { backgroundColor: i < filledCount ? theme[fill] : theme.backgroundSelected },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  ring: {
    width: RING_DIAMETER,
    height: RING_DIAMETER,
    borderRadius: Radius.pill,
    borderWidth: RING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  text: { flex: 1, gap: Spacing.one },
  segments: { flexDirection: 'row', gap: Spacing.half, marginTop: Spacing.one },
  segment: { flex: 1, height: 6, borderRadius: Radius.pill },
});
