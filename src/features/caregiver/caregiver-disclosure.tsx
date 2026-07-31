import { Check, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaMutedNote, FigmaSectionLabel } from '@/components/figma/figma-form-screen';
import { Icon } from '@/components/icon';
import { Surface } from '@/components/surface';
import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The hired-caregiver disclosure rows, in reading order. These mirror the
 * least-privilege RLS the database actually enforces — a family must be able to
 * read exactly what this person will and will not see BEFORE they are given the
 * role, by whichever route.
 */
const SEES_KEYS = ['doses', 'tasks', 'emergency', 'own'] as const;
const HIDDEN_KEYS = ['members', 'pulse', 'schedule', 'others'] as const;
/** Location is deliberately FIRST — the absence of location tracking is the
 *  deliverable of this feature, not a footnote. No shift/attendance/clock-in
 *  tracking exists anywhere in the product. */
const NOT_RECORDED_KEYS = ['location', 'background', 'mic', 'photos'] as const;

/**
 * The three plain-language caregiver-scope cards (sees / does not see / is never
 * recorded) plus the mutual-protection note.
 *
 * It lives here, not inside the invite form, because there are TWO routes into
 * the caregiver role — creating an invitation with that role, and changing an
 * existing member's role to it — and both grant the identical RLS scope. When the
 * disclosure lived only on the invite screen, a manager could hand out the whole
 * scope through the role-change sheet having read a single sentence. Same grant,
 * same disclosure.
 *
 * This is an EXTRACTION, not a second variant: the invite screen renders exactly
 * what it rendered before, from here.
 */
export function CaregiverDisclosure() {
  const { t } = useTranslation();
  const c = useTheme();

  return (
    <>
      <DisclosureCard
        title={t('caregiver.invite.disclosureTitle')}
        glyph={<Check size={16} color={c.successFg} strokeWidth={2.2} />}
        rows={SEES_KEYS.map((key) => ({ key, text: t(`caregiver.invite.sees.${key}`) }))}
      />
      <DisclosureCard
        title={t('caregiver.invite.hiddenTitle')}
        // A scope statement, not a warning — the muted tone, never `errorFg`.
        glyph={<X size={16} color={c.textSecondary} strokeWidth={2.2} />}
        rows={HIDDEN_KEYS.map((key) => ({ key, text: t(`caregiver.invite.hidden.${key}`) }))}
      />
      <DisclosureCard
        title={t('caregiver.invite.notRecordedTitle')}
        glyph={<Icon name="shield" size="sm" color="primaryText" />}
        rows={NOT_RECORDED_KEYS.map((key) => ({
          key,
          text: t(`caregiver.invite.notRecorded.${key}`),
        }))}
      />
      {/* The sentence that makes the feature defensible — kept directly under
          the three cards, never buried below the rest of the form. */}
      <FigmaMutedNote>{t('caregiver.invite.mutualNote')}</FigmaMutedNote>
    </>
  );
}

/**
 * One card of the disclosure: a `Surface` + a `FigmaSectionLabel` and four
 * hand-composed glyph/text rows. Module-private on purpose — this is NOT a new
 * shared primitive and NOT a parallel variant of anything: `FigmaListRow` and
 * `GlyphChip` both take a semantic `iconName` and neither renders a bare glyph
 * beside a wrapping paragraph, which is exactly what a disclosure line is. The
 * glyph element is supplied by the caller and reused across the four rows; the
 * fixed-size box keeps it optically centred on the first text line for both the
 * lucide (SVG) and the registry (glyph-font) icons.
 */
function DisclosureCard({
  title,
  glyph,
  rows,
}: {
  title: string;
  glyph: ReactNode;
  rows: { key: string; text: string }[];
}) {
  const c = useTheme();
  return (
    <Surface tone="card" radius={Radius.card} padded={16} gap={12}>
      <FigmaSectionLabel>{title}</FigmaSectionLabel>
      <View style={styles.disclosureRows}>
        {rows.map((row) => (
          <View key={row.key} style={styles.disclosureRow}>
            <View style={styles.disclosureGlyph}>{glyph}</View>
            <Text style={[styles.disclosureText, { color: c.text }]}>{row.text}</Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  // A glyph box sized to the first text line so the icon sits optically centred
  // on it however far the sentence wraps.
  disclosureRows: { gap: 12 },
  disclosureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  disclosureGlyph: {
    width: 16,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disclosureText: { flex: 1, fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },
});
