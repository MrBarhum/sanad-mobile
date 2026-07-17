import { useRouter } from 'expo-router';
import { ArrowRight, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
 * The screen header: a round back button (start), a centered title, and an
 * optional round teal "+" add button (end). RTL handles side placement (back
 * sits at the right). Use as the first child inside `FigmaScreen` (which already
 * provides the top safe-area inset).
 */
export function FigmaHeader({ title, onAdd, addAccessibilityLabel, onBack, trailing }: FigmaHeaderProps) {
  const router = useRouter();
  const c = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={[styles.action, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
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
          accessibilityLabel={addAccessibilityLabel ?? t('common.add')}
          style={[styles.action, { backgroundColor: c.primary }]}>
          <Plus size={20} color={c.onPrimary} />
        </Pressable>
      ) : (
        <View style={styles.action} />
      )}
    </View>
  );
}

/** Round header action button diameter (bell / back / add). */
const SIZE = 44;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: {
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: { minWidth: SIZE, alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: FontFamily.bold },
});
