import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedView } from './themed-view';

type ScreenEdges = { top?: boolean; bottom?: boolean };

type ScreenProps = {
  children: ReactNode;
  /**
   * Wrap content in a vertical ScrollView (default true). Use false for a single
   * non-scrolling view (e.g. a centered empty/error state).
   */
  scroll?: boolean;
  /** Max content width; the column centers on wider (tablet/web) screens. */
  maxWidth?: number;
  /** Horizontal gutter (edge padding). Phones use the full width minus this. */
  gutter?: number;
  /** Vertical gap between the direct children of the content column. */
  gap?: number;
  /**
   * Which safe-area insets to honor as padding. Default: bottom only — most
   * screens sit under a native Stack header that already owns the top inset. Tab
   * screens (no native header) should pass `{ top: true }`.
   */
  edges?: ScreenEdges;
  /** Extra bottom padding inside the scroll content (e.g. to clear a tab bar). */
  contentBottomInset?: number;
  /** Sticky footer rendered OUTSIDE the scroll area (e.g. StickyFormActions). */
  footer?: ReactNode;
  /** Fixed element rendered above the scroll area (rare — prefer native headers). */
  header?: ReactNode;
  /** Center the column vertically when content is short (good for empty states). */
  center?: boolean;
  /** Wrap body + footer in a KeyboardAvoidingView so a sticky footer rises with
   *  the keyboard and focused fields stay visible. Use on long forms. */
  keyboardAvoiding?: boolean;
  /** A <RefreshControl/> for pull-to-refresh (scroll mode only). */
  refreshControl?: ScrollViewProps['refreshControl'];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_EDGES: ScreenEdges = { top: false, bottom: true };

/**
 * The canonical responsive screen container. Fixes the app-wide clipping bug: the
 * ScrollView fills the full available width (never `alignItems:'center'` on the
 * parent), and a single inner column caps at `maxWidth` and centers — so on phones
 * content uses the full width (minus gutters) and text wraps, while on tablet/web
 * it stays readable and centered. Honors safe-area insets and keeps a generous
 * bottom inset so the last item clears the Android navigation bar. RTL-agnostic
 * (no directional padding).
 */
export function Screen({
  children,
  scroll = true,
  maxWidth = MaxContentWidth,
  gutter = Gutter,
  gap = Spacing.three,
  edges = DEFAULT_EDGES,
  contentBottomInset = 0,
  footer,
  header,
  center = false,
  keyboardAvoiding = false,
  refreshControl,
  contentContainerStyle,
  style,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padTop = (edges.top ? insets.top : 0) + Spacing.four;
  const padBottom = (edges.bottom ? insets.bottom : 0) + Spacing.five + contentBottomInset;

  const column = <View style={[styles.column, { maxWidth, gap }]}>{children}</View>;

  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[
        styles.scrollContent,
        center && styles.center,
        { paddingHorizontal: gutter, paddingTop: padTop, paddingBottom: padBottom },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      {column}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.fill,
        styles.static,
        center && styles.center,
        { paddingHorizontal: gutter, paddingTop: padTop, paddingBottom: padBottom },
        contentContainerStyle,
      ]}>
      {column}
    </View>
  );

  const inner = (
    <>
      {header}
      {body}
      {footer}
    </>
  );

  return (
    <ThemedView style={[styles.fill, style]} testID={testID}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  static: { width: '100%' },
  scrollContent: { flexGrow: 1 },
  center: { justifyContent: 'center' },
  // width:100% of the (already gutter-padded) content area; maxWidth caps it and
  // alignSelf centers it on wide screens. Children stretch to this width.
  column: { width: '100%', alignSelf: 'center' },
});
