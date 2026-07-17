import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** True while the OS "reduce motion" setting is on (subscribes to changes). */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A single placeholder block that gently pulses while content loads. Calm and
 * short (opacity only, ~1s); honors the OS reduce-motion setting by holding a
 * static tone instead of animating. Pure-JS — no native dep.
 */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const c = useTheme();
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  const opacity = reduce ? 0.6 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: c.backgroundSunken, opacity }, style]}
    />
  );
}

/**
 * A list-loading placeholder: a few card-shaped skeletons matching the feature
 * lists' rhythm (a leading chip + two text lines). Drop it in place of a spinner
 * in a list screen's loading branch. Announces "loading" once for screen readers.
 */
export function SkeletonList({ count = 4 }: { count?: number }) {
  const c = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <Skeleton width={44} height={44} radius={Radius.pill} />
          <View style={styles.lines}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="45%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  lines: { flex: 1, gap: Spacing.two },
});
