import { Compass, Home, User } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Route name → label key + lucide icon. */
const TAB_META: Record<string, { labelKey: string; Icon: IconCmp }> = {
  index: { labelKey: 'tabs.home', Icon: Home },
  explore: { labelKey: 'tabs.explore', Icon: Compass },
  account: { labelKey: 'tabs.account', Icon: User },
};

type FigmaTabBarProps = {
  /** Index of the active route within `routeNames`. */
  activeIndex: number;
  /** The tab route names, in navigator order (e.g. index, explore, account). */
  routeNames: string[];
  /** Activate the tab at this index. */
  onSelect: (index: number) => void;
};

/**
 * The bottom tab bar: three tabs (الرئيسية / استكشاف / الحساب), a teal active pill
 * (44×28) behind a 20px lucide icon (stroke 2.5 active), the label (600 active /
 * 400 idle), a hairline top border, and the card background. RTL handles tab order
 * automatically (the row mirrors, so Home sits at the right).
 */
export function FigmaTabBar({ activeIndex, routeNames, onSelect }: FigmaTabBarProps) {
  const { t } = useTranslation();
  const c = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const pillBg = withAlpha(c.primary, scheme === 'dark' ? 0.15 : 0.1);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.backgroundElement,
          borderTopColor: c.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}>
      {routeNames.map((routeName, index) => {
        const meta = TAB_META[routeName];
        if (!meta) return null;
        const active = index === activeIndex;
        const Icon = meta.Icon;
        const color = active ? c.primary : c.textSecondary;
        const label = t(meta.labelKey);
        return (
          <Pressable
            key={routeName}
            onPress={() => onSelect(index)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={styles.tab}>
            <View style={[styles.pill, active && { backgroundColor: pillBg }]}>
              <Icon size={20} color={color} strokeWidth={active ? 2.5 : 2} />
            </View>
            <Text
              style={[
                styles.label,
                { color, fontFamily: active ? FontFamily.semibold : FontFamily.regular },
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48, paddingVertical: 4 },
  pill: {
    width: 44,
    height: 28,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Raised to the 14 content floor (three short Arabic labels fit on flex-1 tabs).
  // Needs runtime QA on a narrow device / at 200% font scale for truncation.
  label: { fontSize: 14, lineHeight: 18 },
});
