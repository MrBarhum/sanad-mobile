import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/constants/glyphs';
import { TIMEZONES, type TimezoneOption } from '@/constants/timezones';
import { FontFamily, MaxFormWidth, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { LtrText } from './ltr-text';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

function isArabic(language: string): boolean {
  return language.toLowerCase().startsWith('ar');
}

/** Localized "City, Country" label for an option in the active language. */
function primaryLabel(option: TimezoneOption, language: string): string {
  return isArabic(language)
    ? `${option.city.ar}، ${option.country.ar}`
    : `${option.city.en}, ${option.country.en}`;
}

function matches(option: TimezoneOption, query: string): boolean {
  const haystack = [
    option.id,
    option.city.en,
    option.city.ar,
    option.country.en,
    option.country.ar,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * Searchable, touch-friendly timezone selector. Shows a localized city/country
 * label with the IANA identifier as a secondary line, a "use this device's
 * timezone" shortcut, and a search box that matches city or country in either
 * language (or the raw IANA id). Selecting a row returns only the IANA `id`; the
 * caller is responsible for confirming and persisting it. No backdrop dismissal —
 * close is explicit, matching the app's other modals.
 */
export function TimezonePicker({
  visible,
  currentId,
  deviceTz,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentId: string;
  deviceTz: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return TIMEZONES;
    return TIMEZONES.filter((option) => matches(option, q));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={[styles.sheet, { borderColor: theme.border }]}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.header}>
            <ThemedText type="sectionTitle" style={styles.title} accessibilityRole="header">
              {t('circleTimezone.pickerTitle')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={Spacing.two}
              style={styles.closeButton}>
              <ThemedText style={styles.close}>{Glyph.cross}</ThemedText>
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('circleTimezone.searchPlaceholder')}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('circleTimezone.searchPlaceholder')}
            style={[
              styles.search,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          />

          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: Spacing.five + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* This device shortcut */}
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('circleTimezone.deviceSection')}
            </ThemedText>
            <Row
              primary={t('circleTimezone.useDevice', { tz: deviceTz })}
              secondary={deviceTz}
              selected={currentId === deviceTz}
              onPress={() => onSelect(deviceTz)}
            />

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('circleTimezone.otherSection')}
            </ThemedText>
            {filtered.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                {t('circleTimezone.noResults')}
              </ThemedText>
            ) : (
              filtered.map((option) => (
                <Row
                  key={option.id}
                  primary={primaryLabel(option, i18n.language)}
                  secondary={option.id}
                  selected={currentId === option.id}
                  currentLabel={currentId === option.id ? t('circleTimezone.currentLabel') : undefined}
                  onPress={() => onSelect(option.id)}
                />
              ))
            )}
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Row({
  primary,
  secondary,
  selected,
  currentLabel,
  onPress,
}: {
  primary: string;
  secondary: string;
  selected: boolean;
  currentLabel?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? theme.primaryBg : theme.backgroundSelected,
          borderColor: selected ? 'transparent' : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <View style={styles.rowText}>
        <ThemedText
          themeColor={selected ? 'primaryText' : 'text'}
          style={[styles.rowPrimary, selected && styles.rowPrimarySelected]}>
          {selected ? `${Glyph.check} ${primary}` : primary}
        </ThemedText>
        <LtrText type="small" themeColor="textSecondary">
          {secondary}
        </LtrText>
      </View>
      {currentLabel ? (
        <ThemedText type="small" themeColor="primaryText">
          {currentLabel}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '92%',
    paddingTop: Spacing.two,
  },
  // Visual bottom-sheet affordance (dismissal stays explicit via the close button).
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radius.pill,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { flexShrink: 1 },
  closeButton: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { fontSize: 20, fontWeight: '600' },
  search: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    minHeight: TouchTarget.comfortable,
  },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  sectionLabel: { marginTop: Spacing.two },
  empty: { paddingVertical: Spacing.three },
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: { flexShrink: 1, gap: Spacing.half },
  rowPrimary: { fontFamily: FontFamily.semibold, fontSize: 16, fontWeight: '600' },
  rowPrimarySelected: { fontFamily: FontFamily.bold, fontWeight: '700' },
});
