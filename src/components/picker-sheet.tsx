import { useRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;

/**
 * Bottom-sheet chrome for the native date / time pickers. Holds a title, the
 * picker body (`children` — usually a row of `WheelColumn`s) and Done / Clear /
 * Cancel actions. Tapping the backdrop cancels (discards the in-progress
 * selection); the caller commits only on Done. Cross-platform-safe, but only the
 * native field variants import it — the web variants use real HTML inputs.
 */
export function PickerSheet({
  visible,
  title,
  doneLabel,
  cancelLabel,
  clearLabel,
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
  onDone: () => void;
  onCancel: () => void;
  /** When provided, a Clear action is shown (for optional fields). */
  onClear?: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        accessibilityLabel={cancelLabel}
        onPress={onCancel}>
        {/* Swallow taps inside the sheet so they don't reach the backdrop. */}
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
              {title}
            </ThemedText>

            <View style={styles.body}>{children}</View>

            <View style={styles.actions}>
              <Button label={doneLabel} onPress={onDone} style={styles.action} />
              {onClear ? (
                <Button
                  label={clearLabel}
                  variant="secondary"
                  onPress={onClear}
                  style={styles.action}
                />
              ) : null}
              <Button
                label={cancelLabel}
                variant="secondary"
                onPress={onCancel}
                style={styles.action}
              />
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * A single scrollable selection column (year, month, day, hour or minute). Taps
 * select a value; the selected row is highlighted. On mount it scrolls the
 * selected value into view. Numbers only — formatting (e.g. zero-padding) is via
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
        <ThemedText type="small" themeColor="textSecondary" style={styles.columnLabel}>
          {label}
        </ThemedText>
      ) : null}
      <ScrollView
        ref={ref}
        style={styles.columnScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        onContentSizeChange={maybeScrollToSelected}
        accessibilityLabel={accessibilityLabel}>
        {values.map((value) => {
          const isSelected = value === selected;
          return (
            <Pressable
              key={value}
              onPress={() => onSelect(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.row, isSelected && { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText
                themeColor={isSelected ? 'text' : 'textSecondary'}
                style={[styles.rowText, isSelected && styles.rowTextSelected]}>
                {formatValue ? formatValue(value) : String(value)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { width: '100%', maxWidth: MaxFormWidth, alignSelf: 'center' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  title: { fontSize: 22, lineHeight: 30 },
  body: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
  actions: { gap: Spacing.two },
  action: { width: '100%' },
  column: { flex: 1, gap: Spacing.one, alignItems: 'stretch' },
  columnLabel: { textAlign: 'center' },
  columnScroll: { height: ROW_HEIGHT * VISIBLE_ROWS },
  row: {
    height: ROW_HEIGHT,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { fontSize: 18 },
  rowTextSelected: { fontWeight: '700' },
});
