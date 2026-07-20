import { useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderWidth, FontFamily, Gutter, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FigmaHeaderProps = {
  title: string;
  /** Show the filled add square. */
  onAdd?: () => void;
  addAccessibilityLabel?: string;
  /** Custom back handler (defaults to router.back()). */
  onBack?: () => void;
  /** Optional trailing node in place of the add square. */
  trailing?: ReactNode;
};

/**
 * The Dar sub-screen header: a full-bleed deep-green band with a 44dp bordered
 * back square (start), a centered 20/800 title, and a 44dp filled add square (end).
 * Rendered as the FIRST child inside `FigmaScreen`; it breaks out of the screen's
 * gutter + top padding with negative margins and supplies its own top safe-area
 * inset so the green fill runs to the top edge under the status bar. RTL handles
 * side placement (back sits at the right).
 */
export function FigmaHeader({ title, onAdd, addAccessibilityLabel, onBack, trailing }: FigmaHeaderProps) {
  const router = useRouter();
  const c = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.band,
        {
          backgroundColor: c.band,
          // Break out of FigmaScreen's gutter + its (insets.top + 8) top padding so
          // the band is full-bleed and reaches the top edge, then re-add the inset.
          marginHorizontal: -Gutter,
          marginTop: -(insets.top + 8),
          paddingTop: insets.top + 18,
        },
      ]}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={[styles.action, styles.bordered, { borderColor: c.bandInk }]}>
        <ChevronRight size={20} color={c.bandInk} strokeWidth={2.4} />
      </Pressable>

      <Text style={[styles.title, { color: c.bandInk }]} numberOfLines={1}>
        {title}
      </Text>

      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : onAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addAccessibilityLabel ?? t('common.add')}
          style={[styles.action, { backgroundColor: c.bandInk }]}>
          <Plus size={20} color={c.band} strokeWidth={2.6} />
        </Pressable>
      ) : (
        <View style={styles.action} />
      )}
    </View>
  );
}

const SIZE = 44;

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  action: {
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bordered: { borderWidth: BorderWidth.standard },
  trailing: { minWidth: SIZE, alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: FontFamily.bold },
});
