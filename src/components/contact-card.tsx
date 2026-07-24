import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { initialFor } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GlyphChip } from './glyph-chip';
import { Icon } from './icon';
import { LtrText } from './ltr-text';
import { Surface } from './surface';
import { ThemedText } from './themed-text';

type ContactCardProps = {
  name: string;
  /** Short qualifier under the name (e.g. specialty, relationship). */
  subtitle?: string | null;
  /** Additional secondary lines (e.g. clinic name). */
  details?: (string | null | undefined)[];
  /** Phone number — rendered LTR and offered as a one-tap call. */
  phone?: string | null;
  /** Accessible label for the call affordance (e.g. "Call {name}"). */
  callLabel?: string;
  notes?: string | null;
  /** Action row (e.g. ItemActions edit/delete). */
  children?: ReactNode;
};

/**
 * A responsive, scannable contact card for a doctor or emergency contact: an
 * initial-letter avatar anchors the row, then a clear name, optional qualifier,
 * secondary details, a prominent one-tap call row (number rendered LTR so it
 * reads correctly in the RTL layout) and an actions slot separated by a divider.
 * Full width, strong calm hierarchy, suited to older users.
 */
export function ContactCard({ name, subtitle, details, phone, callLabel, notes, children }: ContactCardProps) {
  const theme = useTheme();
  const detailLines = (details ?? []).filter(Boolean) as string[];
  // First grapheme of the name as the avatar letterform (Arabic or Latin).
  const initial = initialFor(name);

  function call() {
    if (!phone) return;
    const sanitized = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${sanitized}`).catch(() => {
      // Device may not support telephony (tablet / emulator) — ignore quietly.
    });
  }

  return (
    <Surface style={styles.card}>
      <View style={styles.headerRow}>
        <GlyphChip glyph={initial} tone="primary" />
        <View style={styles.headerText}>
          <ThemedText type="cardTitle">{name}</ThemedText>
          {subtitle ? (
            <ThemedText type="smallBold" themeColor="primaryText">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {detailLines.length > 0 || notes ? (
        <View style={styles.details}>
          {detailLines.map((line, i) => (
            <ThemedText key={i} type="small" themeColor="textSecondary">
              {line}
            </ThemedText>
          ))}
          {notes ? (
            <ThemedText type="small" themeColor="textSecondary">
              {notes}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {phone ? (
        <Pressable
          onPress={call}
          accessibilityRole="button"
          accessibilityLabel={callLabel ?? phone}
          android_ripple={{ color: theme.backgroundSelected }}
          style={[
            styles.phoneRow,
            { backgroundColor: theme.primaryBg },
          ]}>
          <Icon name="call" size={20} color="primaryText" />
          <LtrText style={[styles.phoneText, { color: theme.primaryText }]} selectable>
            {phone}
          </LtrText>
        </Pressable>
      ) : null}

      {children ? (
        <View style={[styles.actions, { borderTopColor: theme.divider }]}>{children}</View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerText: { flex: 1, gap: Spacing.half },
  details: { gap: Spacing.one },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: TouchTarget.comfortable,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  phoneText: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
});
