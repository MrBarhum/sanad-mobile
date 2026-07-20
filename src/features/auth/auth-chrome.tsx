import { AlertCircle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The Dar auth brand mark — a care-ring drawn in the band ink. */
function BrandCareMark({ color }: { color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={11} r={7} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 4a7 7 0 0 1 7 7" stroke={color} strokeWidth={3.2} strokeLinecap="round" />
      <Path d="M8.5 20.5h7" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The shared Dar auth lockup (frame 7a): a 64×64 bordered deep-green band square
 * holding the brand care-mark, then the screen title (30/900) and subtitle
 * (16/600). Identical across sign-in / sign-up / forgot-password; both themes via
 * tokens, centered, RTL-aware (text aligns center so it reads in either direction).
 */
export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const c = useTheme();
  return (
    <View style={styles.header}>
      <View style={[styles.brandSquare, { backgroundColor: c.band, borderColor: c.border }]}>
        <BrandCareMark color={c.bandInk} />
      </View>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

/**
 * The calm auth error row (frame 7a alert): a restrained danger icon + a 15/700
 * message in `err`. Announced as a live alert; never alarm styling.
 */
export function AuthError({ message }: { message: string }) {
  const c = useTheme();
  return (
    <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AlertCircle size={15} color={c.errorFg} strokeWidth={2.4} />
      <Text style={[styles.errorText, { color: c.errorFg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  brandSquare: {
    width: 64,
    height: 64,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 30, fontFamily: FontFamily.black, lineHeight: 42, textAlign: 'center' },
  subtitle: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: 2,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold },
});
