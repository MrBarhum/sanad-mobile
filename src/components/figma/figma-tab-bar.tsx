import { Compass, Home, User } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderWidth, FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
 * The Dar bottom tab bar: three tabs (الرئيسية / استكشاف / الحساب) on a `card` bar
 * with a 2px `line` top border. The ACTIVE tab is a solid `btn` (green) block with
 * `btnInk` icon + 800 label; idle tabs are `mut` on `card` with a 600 label and a
 * 2px `line` start-divider between them. Icon 22 (stroke 2.4 active / 2 idle). RTL
 * handles tab order automatically (the row mirrors, so Home sits at the right).
 */
export function FigmaTabBar({ activeIndex, routeNames, onSelect }: FigmaTabBarProps) {
  const { t } = useTranslation();
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.background, borderTopColor: c.border },
      ]}>
      {routeNames.map((routeName, index) => {
        const meta = TAB_META[routeName];
        if (!meta) return null;
        const active = index === activeIndex;
        const Icon = meta.Icon;
        const color = active ? c.onPrimary : c.textSecondary;
        const label = t(meta.labelKey);
        return (
          <Pressable
            key={routeName}
            onPress={() => onSelect(index)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={[
              styles.tab,
              { backgroundColor: active ? c.primary : c.backgroundElement, paddingBottom: 14 + insets.bottom },
              index > 0 && { borderStartWidth: BorderWidth.standard, borderStartColor: c.border },
            ]}>
            <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
            <Text
              style={[
                styles.label,
                { color, fontFamily: active ? FontFamily.bold : FontFamily.medium },
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
    alignItems: 'stretch',
    borderTopWidth: BorderWidth.standard,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    paddingTop: 12,
  },
  // 15px / 800 active · 600 idle — clears the 14 content floor. Needs runtime QA on
  // a narrow device / at 200% font scale for truncation of three short labels.
  label: { fontSize: 15, lineHeight: 20 },
});
