import { useRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/constants/glyphs';
import { MaxFormWidth, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Cairo } from './figma/form-typography';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const ROW_HEIGHT = TouchTarget.min; // 48 — large, easy targets for older users
const VISIBLE_ROWS = 5;

/**
 * Bottom-sheet chrome for the native date / time pickers. Holds a title, a close
 * affordance, the picker body (`children` — a row of `WheelColumn`s) and
 * Done / Clear / Cancel actions. Tapping the backdrop or the close icon cancels
 * (discards the in-progress selection); the caller commits only on Done. The sheet
 * caps its height and honors the bottom safe-area inset so the actions are always
 * reachable on short and tall devices. Cross-platform-safe, but only the native
 * field variants import it — the web variants use real HTML inputs.
 */
export function PickerSheet({
  visible,
  title,
  doneLabel,
  cancelLabel,
  clearLabel,
  closeLabel,
  onDone,
  onCancel,
  onClear,
  children,
}: {
  visible: boolean;
  title: string;
  doneLabel: string;
  cancelLabel: string;
  clearLabel: string;
  /** Accessible label for the header close icon (defaults to the cancel label). */
  closeLabel?: string;
  onDone: () => void;
  onCancel: () => void;
  /** When provided, a Clear action is shown (for optional fields). */
  onClear?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        accessibilityLabel={cancelLabel}
        onPress={onCancel}>
        {/* Swallow taps inside the sheet so they don't reach the backdrop. */}
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <ThemedView
            type="backgroundElement"
            style={[
              styles.sheet,
              { borderColor: theme.border, paddingBottom: Spacing.four + insets.bottom },
            ]}>
            <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.header}>
              <ThemedText type="sectionTitle" accessibilityRole="header" style={[styles.title, Cairo.bold]}>
                {title}
              </ThemedText>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={closeLabel ?? cancelLabel}
                hitSlop={Spacing.two}
                style={styles.close}>
                <ThemedText style={[styles.closeGlyph, Cairo.semibold]}>{Glyph.cross}</ThemedText>
              </Pressable>
            </View>

            <View style={styles.body}>{children}</View>

            {/* Centered, vertically-stacked text actions. Done is high-contrast
                Sanad teal; Clear and Cancel are high-contrast (near-white in dark)
                — never dim/right-aligned. Behavior: Done commits, Cancel/backdrop
                discards, Clear (when provided) clears. */}
            <View style={styles.actions}>
              <Pressable
                onPress={onDone}
                accessibilityRole="button"
                accessibilityLabel={doneLabel}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed ? { backgroundColor: theme.backgroundSelected } : null,
                ]}>
                <ThemedText style={[styles.actionLabel, Cairo.bold, { color: theme.primary }]}>
                  {doneLabel}
                </ThemedText>
              </Pressable>
              {onClear ? (
                <Pressable
                  onPress={onClear}
                  accessibilityRole="button"
                  accessibilityLabel={clearLabel}
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed ? { backgroundColor: theme.backgroundSelected } : null,
                  ]}>
                  <ThemedText style={[styles.actionLabel, Cairo.semibold, { color: theme.text }]}>
                    {clearLabel}
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed ? { backgroundColor: theme.backgroundSelected } : null,
                ]}>
                <ThemedText style={[styles.actionLabel, Cairo.semibold, { color: theme.text }]}>
                  {cancelLabel}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * A single scrollable selection column (year, month, day, hour or minute). Taps
 * select a value; the selected row is highlighted (filled + bold + a check) so
 * the choice is never communicated by color alone. On mount it scrolls the
 * selected value into view. Numbers only — formatting (e.g. zero-padding) via
 * `formatValue`.
 */
export function WheelColumn({
  label,
  values,
  selected,
  onSelect,
  formatValue,
  accessibilityLabel,
}: {
  label?: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  formatValue?: (value: number) => string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const ref = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  const selectedIndex = Math.max(0, values.indexOf(selected));

  // Scroll the selected value roughly to the middle, once, after layout.
  function maybeScrollToSelected() {
    if (scrolled.current) return;
    scrolled.current = true;
    const y = Math.max(0, (selectedIndex - 2) * ROW_HEIGHT);
    ref.current?.scrollTo({ y, animated: false });
  }

  return (
    <View style={styles.column}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary" style={[styles.columnLabel, Cairo.regular]}>
          {label}
        </ThemedText>
      ) : null}
      <ScrollView
        ref={ref}
        style={[styles.columnScroll, { borderColor: theme.divider, backgroundColor: theme.backgroundSunken }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        onContentSizeChange={maybeScrollToSelected}
        accessibilityLabel={accessibilityLabel}>
        {values.map((value) => {
          const isSelected = value === selected;
          const text = formatValue ? formatValue(value) : String(value);
          return (
            <Pressable
              key={value}
              onPress={() => onSelect(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.row, isSelected && { backgroundColor: theme.primaryBg }]}>
              <ThemedText
                themeColor={isSelected ? 'primaryText' : 'text'}
                style={[styles.rowText, isSelected ? Cairo.bold : Cairo.regular, isSelected && styles.rowTextSelected]}>
                {isSelected ? `${Glyph.check} ${text}` : text}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { width: '100%', maxWidth: MaxFormWidth, alignSelf: 'center' },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  // Visual bottom-sheet affordance (dismissal stays explicit via Cancel/close).
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radius.pill,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  title: { flexShrink: 1 },
  close: { minWidth: TouchTarget.min, minHeight: TouchTarget.min, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 20, fontWeight: '600' },
  // A plain full-width block (column direction): the child wheel-row (the field's
  // own `columns` View) stretches to the full width, which is what keeps its
  // flex:1 WheelColumns from collapsing to zero width — the cause of the blank
  // Android picker. Do NOT make this a row.
  body: { width: '100%' },
  actions: { gap: Spacing.one },
  actionRow: {
    minHeight: TouchTarget.min,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 17, lineHeight: 24, textAlign: 'center' },
  column: { flex: 1, gap: Spacing.one },
  columnLabel: { textAlign: 'center' },
  columnScroll: {
    height: ROW_HEIGHT * VISIBLE_ROWS,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { fontSize: 18 },
  rowTextSelected: { fontWeight: '700' },
});
