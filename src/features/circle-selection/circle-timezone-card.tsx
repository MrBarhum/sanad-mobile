import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LtrText } from '@/components/ltr-text';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { TimezonePicker } from '@/components/timezone-picker';
import { findTimezoneOption } from '@/constants/timezones';
import { Spacing } from '@/constants/theme';
import { getDeviceTimezone } from '@/features/notifications/device';

import { useSetCircleTimezone } from './hooks';
import { useCircleSelection } from './provider';

/**
 * Care-circle timezone settings. The circle's timezone is the canonical zone for
 * scheduled medication/task wall-clock times â€” it must match the cared-for
 * person's location, NOT each member's device. A newly created circle is seeded
 * from the creator's device; this card shows the current value (with a friendly
 * city/country label when known), prompts a manager to confirm it when it is
 * still the default 'UTC', and lets a manager change it via a searchable picker
 * with a confirmation step. Only the IANA identifier is stored; the RPC validates
 * it server-side and remains authoritative.
 */
export function CircleTimezoneCard() {
  const { t, i18n } = useTranslation();
  const { activeCircle } = useCircleSelection();
  const setTz = useSetCircleTimezone();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!activeCircle) return null;

  const circleId = activeCircle.circleId;
  const current = activeCircle.timezone;
  const deviceTz = getDeviceTimezone();
  const isArabic = i18n.language.toLowerCase().startsWith('ar');

  function friendlyLabel(id: string): string {
    const option = findTimezoneOption(id);
    if (!option) return id;
    return isArabic
      ? `${option.city.ar}ØŒ ${option.country.ar}`
      : `${option.city.en}, ${option.country.en}`;
  }

  function onPick(id: string) {
    setPickerOpen(false);
    setError(null);
    setSelected(id === current ? null : id);
  }

  async function apply() {
    if (!selected) return;
    setError(null);
    try {
      await setTz.mutateAsync({ circleId, timezone: selected });
      setSelected(null);
    } catch (e) {
      const message = (e as { message?: string })?.message?.toLowerCase() ?? '';
      setError(message.includes('invalid') ? t('circleTimezone.invalid') : t('circleTimezone.error'));
    }
  }

  const friendlyCurrent = friendlyLabel(current);

  return (
    <Surface style={styles.card}>
      <ThemedText type="cardTitle">{t('circleTimezone.title')}</ThemedText>
      <ThemedText type="cardTitle">{friendlyCurrent}</ThemedText>
      {friendlyCurrent !== current ? (
        <LtrText type="small" themeColor="textSecondary">
          {current}
        </LtrText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('circleTimezone.explain')}
      </ThemedText>

      {current === 'UTC' && activeCircle.canManage ? (
        <ThemedText type="small" themeColor="warningFg">
          {t('circleTimezone.confirmPrompt')}
        </ThemedText>
      ) : null}

      {!activeCircle.canManage ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('circleTimezone.managerOnly')}
        </ThemedText>
      ) : selected ? (
        <View style={styles.actions}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('circleTimezone.confirmChange', { from: current, to: selected })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('circleTimezone.impact', { tz: friendlyLabel(selected) })}
          </ThemedText>
          <Button
            size="sm"
            label={t('circleTimezone.confirm')}
            loading={setTz.isPending}
            disabled={setTz.isPending}
            onPress={apply}
          />
          <Button
            size="sm"
            variant="secondary"
            label={t('common.cancel')}
            disabled={setTz.isPending}
            onPress={() => setSelected(null)}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            size="sm"
            label={current === 'UTC' ? t('circleTimezone.select') : t('circleTimezone.change')}
            onPress={() => {
              setError(null);
              setPickerOpen(true);
            }}
          />
        </View>
      )}

      {error ? (
        <ThemedText type="small" themeColor="errorFg" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      <TimezonePicker
        visible={pickerOpen}
        currentId={current}
        deviceTz={deviceTz}
        onSelect={onPick}
        onClose={() => setPickerOpen(false)}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.one },
});
