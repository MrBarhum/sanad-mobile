import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
 * A responsive, scannable contact card for a doctor or emergency contact: a clear
 * name, an optional qualifier, secondary details, a prominent one-tap phone row
 * (rendered LTR so the number reads correctly in the RTL layout) and an actions
 * slot. Uses the full available width and keeps a strong, calm hierarchy suited to
 * older users.
 */
export function ContactCard({ name, subtitle, details, phone, callLabel, notes, children }: ContactCardProps) {
  const theme = useTheme();
  const detailLines = (details ?? []).filter(Boolean) as string[];

  function call() {
    if (!phone) return;
    const sanitized = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${sanitized}`).catch(() => {
      // Device may not support telephony (tablet / emulator) — ignore quietly.
    });
  }

  return (
    <Surface style={styles.card}>
      <View style={styles.headerText}>
        <ThemedText type="cardTitle">{name}</ThemedText>
        {subtitle ? (
          <ThemedText type="smallBold" themeColor="primaryText">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {detailLines.map((line, i) => (
        <ThemedText key={i} themeColor="textSecondary">
          {line}
        </ThemedText>
      ))}

      {phone ? (
        <Pressable
          onPress={call}
          accessibilityRole="button"
          accessibilityLabel={callLabel ?? phone}
          style={({ pressed }) => [
            styles.phoneRow,
            { backgroundColor: theme.primaryBg, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={styles.phoneGlyph} accessibilityElementsHidden>
            📞
          </ThemedText>
          <LtrText style={[styles.phoneText, { color: theme.primaryText }]} selectable>
            {phone}
          </LtrText>
        </Pressable>
      ) : null}

      {notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {notes}
        </ThemedText>
      ) : null}

      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  headerText: { gap: Spacing.half },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TouchTarget.comfortable,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  phoneGlyph: { fontSize: 18 },
  phoneText: { fontSize: 18, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
