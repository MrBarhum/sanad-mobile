import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaColors, FigmaFont, FigmaRadius } from './figma-tokens';

type Tab = { key: string; label: string };

type FigmaSegmentedTabsProps = {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
};

/**
 * The Figma in-screen segmented control (today/all, today/open/done,
 * upcoming/completed). Active = filled teal + white; inactive = card + hairline +
 * muted. Equal-width tabs, ≥48dp tall.
 */
export function FigmaSegmentedTabs({ tabs, activeKey, onChange }: FigmaSegmentedTabsProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

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
                : { backgroundColor: c.card, borderColor: c.border },
            ]}>
            <Text
              style={[
                styles.label,
                { color: active ? c.onPrimary : c.muted, fontFamily: active ? FigmaFont.semibold : FigmaFont.medium },
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
    borderRadius: FigmaRadius.r12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  label: { fontSize: 14 },
});
