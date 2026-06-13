import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { GlyphChip, type GlyphChipTone } from './glyph-chip';
import { Surface } from './surface';
import { ThemedText } from './themed-text';

type InfoBannerProps = {
  /** Main message. */
  text: string;
  /** Optional second line styled as a link/action hint (e.g. "Manage settings â€º"). */
  actionText?: string;
  tone?: Extract<GlyphChipTone, 'info' | 'warning' | 'neutral' | 'accent'>;
  /** Tapping the whole banner triggers this (e.g. open notification settings). */
  onPress?: () => void;
  accessibilityLabel?: string;
};

const GLYPH_BY_TONE = { info: 'i', warning: '!', neutral: 'i', accent: 'âœ¦' } as const;

/**
 * A contained, tinted notice row: small tone chip + message (+ optional action
 * line). Replaces floating gray disclaimer paragraphs and emoji hint rows with
 * one calm, consistent treatment that reads as deliberate UI, not leftover text.
 */
export function InfoBanner({ text, actionText, tone = 'info', onPress, accessibilityLabel }: InfoBannerProps) {
  const fgColor = tone === 'neutral' ? 'textSecondary' : (`${tone}Fg` as const);

  return (
    <Surface
      tone={tone === 'neutral' ? 'sunken' : tone}
      bordered={false}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={styles.banner}>
      <View style={styles.row}>
        <GlyphChip glyph={GLYPH_BY_TONE[tone]} tone={tone} size="sm" />
        <View style={styles.text}>
          <ThemedText type="small" themeColor={fgColor}>
            {text}
          </ThemedText>
          {actionText ? (
            <ThemedText type="smallBold" themeColor={fgColor}>
              {actionText}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  banner: { padding: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  text: { flex: 1, gap: Spacing.half },
});
