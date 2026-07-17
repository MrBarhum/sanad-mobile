import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Tab = { key: string; label: string };

type FigmaSegmentedTabsProps = {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
};

/**
 * The in-screen segmented control (today/all, today/open/done,
 * upcoming/completed). Active = filled teal + on-primary; inactive = card +
 * hairline + secondary. Equal-width tabs, ≥44dp tall.
 */
export function FigmaSegmentedTabs({ tabs, activeKey, onChange }: FigmaSegmentedTabsProps) {
  const c = useTheme();

  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              active
                ? { backgroundColor: c.primary, borderColor: c.primary }
                : { backgroundColor: c.backgroundElement, borderColor: c.border },
            ]}>
            <Text
              style={[
                styles.label,
                {
                  color: active ? c.onPrimary : c.textSecondary,
                  fontFamily: active ? FontFamily.semibold : FontFamily.medium,
                },
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
  row: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  label: { fontSize: 14 },
});
