import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Tab = { key: string; label: string };

type FigmaSegmentedTabsProps = {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
};

/**
 * The Dar in-screen segmented control (today/all, today/open/done,
 * upcoming/completed): ONE 2px-bordered container (radius 8, clipped), equal-width
 * cells split by 2px `line` dividers. Active cell = solid `btn` fill + `btnInk`
 * 16/800; inactive = `card` + `mut` 16/700.
 */
export function FigmaSegmentedTabs({ tabs, activeKey, onChange }: FigmaSegmentedTabsProps) {
  const c = useTheme();

  return (
    <View style={[styles.container, { borderColor: c.border }]}>
      {tabs.map((tab, i) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              { backgroundColor: active ? c.primary : c.backgroundElement },
              i > 0 && { borderStartWidth: BorderWidth.standard, borderStartColor: c.border },
            ]}>
            <Text
              style={[
                active ? styles.activeLabel : styles.label,
                { color: active ? c.onPrimary : c.textSecondary },
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  activeLabel: { fontSize: 16, fontFamily: FontFamily.bold },
  label: { fontSize: 16, fontFamily: FontFamily.semibold },
});
