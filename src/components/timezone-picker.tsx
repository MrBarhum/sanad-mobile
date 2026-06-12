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

import { TIMEZONES, type TimezoneOption } from '@/constants/timezones';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return TIMEZONES;
    return TIMEZONES.filter((option) => matches(option, q));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
              {t('circleTimezone.pickerTitle')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={Spacing.two}>
              <ThemedText style={styles.close}>✕</ThemedText>
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('circleTimezone.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('circleTimezone.searchPlaceholder')}
            style={[
              styles.search,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
            ]}
          />

          <ScrollView
            contentContainerStyle={styles.list}
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView
        type={selected ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.row}>
        <View style={styles.rowText}>
          <ThemedText style={styles.rowPrimary}>{primary}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {secondary}
          </ThemedText>
        </View>
        {currentLabel ? (
          <ThemedText type="small" themeColor="textSecondary">
            {currentLabel}
          </ThemedText>
        ) : null}
        {selected ? <ThemedText style={styles.check}>✓</ThemedText> : null}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '90%',
    paddingTop: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 24, lineHeight: 32, flexShrink: 1 },
  close: { fontSize: 20, fontWeight: '600', padding: Spacing.one },
  search: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: 52,
  },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  sectionLabel: { marginTop: Spacing.two },
  empty: { paddingVertical: Spacing.three },
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: { flexShrink: 1, gap: Spacing.half },
  rowPrimary: { fontSize: 16, fontWeight: '600' },
  check: { fontSize: 18, fontWeight: '700' },
});
