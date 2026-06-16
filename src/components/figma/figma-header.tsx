import { useRouter } from 'expo-router';
import { ArrowRight, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaColors, FigmaFont, FigmaLayout, FigmaRadius } from './figma-tokens';

type FigmaHeaderProps = {
  title: string;
  /** Show the round teal add button. */
  onAdd?: () => void;
  addAccessibilityLabel?: string;
  /** Custom back handler (defaults to router.back()). */
  onBack?: () => void;
  /** Optional trailing node in place of the add button. */
  trailing?: ReactNode;
};

/**
 * The Figma screen header: a round back button (start), a centered title, and an
 * optional round teal "+" add button (end). Matches the Figma `*Screen.tsx`
 * headers. RTL handles side placement (back sits at the right). Use as the first
 * child inside `FigmaScreen` (which already provides the top safe-area inset).
 */
export function FigmaHeader({ title, onAdd, addAccessibilityLabel, onBack, trailing }: FigmaHeaderProps) {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel="back"
        style={[styles.action, { backgroundColor: c.card, borderColor: c.border }]}>
        <ArrowRight size={20} color={c.text} />
      </Pressable>

      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>

      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : onAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addAccessibilityLabel ?? 'add'}
          style={[styles.action, { backgroundColor: c.primary }]}>
          <Plus size={20} color={c.onPrimary} />
        </Pressable>
      ) : (
        <View style={styles.action} />
      )}
    </View>
  );
}

const SIZE = FigmaLayout.headerActionSize;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: {
    width: SIZE,
    height: SIZE,
    borderRadius: FigmaRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: { minWidth: SIZE, alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: FigmaFont.bold },
});
