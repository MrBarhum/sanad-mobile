import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { StatusBadge } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { usePushRegistration, type EnableResult } from './hooks';

/**
 * Arabic-first explanation + enable control for push notifications. Shows WHY
 * Sanad asks (medication, task and appointment reminders), a short privacy
 * statement, and a single explicit "Enable" action — permission is never
 * requested automatically. Renders an honest status for every outcome: granted,
 * denied (with a hint to use OS settings), web/simulator unsupported, or a
 * missing EAS project id. Web is described plainly, never faked.
 */
export function PushStatusCard() {
  const { t } = useTranslation();
  const { support, permission, isWorking, hasActiveDeviceToken, enable, disable } =
    usePushRegistration();
  const [result, setResult] = useState<EnableResult | null>(null);

  async function onEnable() {
    setResult(await enable());
  }

  const enabled = support === 'supported' && permission === 'granted' && hasActiveDeviceToken;

  return (
    <Surface style={styles.card}>
      <ThemedText type="cardTitle">{t('notificationSettings.push.explainTitle')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('notificationSettings.push.explainBody')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('notificationSettings.push.privacy')}
      </ThemedText>

      {support === 'web-unsupported' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('notificationSettings.push.web')}
        </ThemedText>
      ) : support === 'no-device' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('notificationSettings.push.noDevice')}
        </ThemedText>
      ) : enabled ? (
        <View style={styles.statusRow}>
          <StatusBadge tone="success" label={t('notificationSettings.push.granted')} />
          <Button
            size="sm"
            variant="secondary"
            label={t('notificationSettings.push.disable')}
            loading={isWorking}
            onPress={() => {
              setResult(null);
              void disable();
            }}
          />
        </View>
      ) : (
        <Button
          label={t('notificationSettings.push.enable')}
          loading={isWorking}
          onPress={onEnable}
        />
      )}

      {result && result !== 'enabled' ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityLiveRegion="polite">
          {t(`notificationSettings.push.results.${result}`)}
        </ThemedText>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  note: { marginTop: Spacing.one },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
    flexWrap: 'wrap',
  },
});
