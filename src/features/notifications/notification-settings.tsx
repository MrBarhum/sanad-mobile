import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { LtrText } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimeField } from '@/components/time-field';
import { MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCircleSelection } from '@/features/circle-selection/provider';

import { preferencesToInput, type NotificationPreferencesInput } from './api';
import { getDeviceTimezone } from './device';
import { useNotificationPreferences, useUpsertPreferences } from './hooks';
import { scheduleLocalTestNotification, pushSupport } from './push-registration';
import { PushStatusCard } from './push-status-card';
import { PREFERENCE_TOGGLES, quietHoursValid, type BooleanPreferenceKey } from './schema';

/** The /notification-settings screen: push status, per-circle/global preferences,
 * quiet hours, timezone, and a safe local test action. */
export function NotificationSettings() {
  const { t } = useTranslation();
  const { circles, activeCircleId } = useCircleSelection();

  // null scope = the user's global default; otherwise a specific circle.
  const [scope, setScope] = useState<string | null>(activeCircleId ?? null);
  const prefsQuery = useNotificationPreferences(scope);
  const upsert = useUpsertPreferences(scope);

  const [input, setInput] = useState<NotificationPreferencesInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  // Sync the editable form from the loaded row whenever the scope/row changes.
  useEffect(() => {
    if (prefsQuery.isSuccess) {
      setInput(preferencesToInput(prefsQuery.data ?? null));
      setSaved(false);
      setError(null);
    }
  }, [prefsQuery.data, prefsQuery.isSuccess, scope]);

  const timezone = input?.timezone ?? getDeviceTimezone();

  const scopeLabel = useMemo(() => {
    if (scope === null) return t('notificationSettings.scope.global');
    return circles.find((c) => c.circleId === scope)?.circleName ?? t('notificationSettings.scope.circle');
  }, [scope, circles, t]);

  function update<K extends keyof NotificationPreferencesInput>(
    key: K,
    value: NotificationPreferencesInput[K],
  ) {
    setSaved(false);
    setInput((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  async function onSave() {
    if (!input) return;
    setError(null);
    if (!quietHoursValid(input)) {
      setError(t('notificationSettings.quietHours.invalid'));
      return;
    }
    try {
      await upsert.mutateAsync({ ...input, timezone });
      setSaved(true);
    } catch {
      setError(t('notificationSettings.saveError'));
    }
  }

  async function onTest() {
    setTestFeedback(null);
    try {
      await scheduleLocalTestNotification(
        t('notificationSettings.test.title'),
        t('notificationSettings.test.body'),
        5,
      );
      setTestFeedback(t('notificationSettings.test.scheduled'));
    } catch {
      setTestFeedback(t('notificationSettings.test.failed'));
    }
  }

  return (
    <Screen maxWidth={MaxFormWidth}>
      <PushStatusCard />

      {/* Scope: global default or a specific circle */}
      <Section title={t('notificationSettings.scope.title')} gap={Spacing.two}>
        <View style={styles.chips}>
          <ScopeChip
            label={t('notificationSettings.scope.global')}
            active={scope === null}
            onPress={() => setScope(null)}
          />
          {circles.map((c) => (
            <ScopeChip
              key={c.circleId}
              label={c.circleName}
              active={scope === c.circleId}
              onPress={() => setScope(c.circleId)}
            />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {scope === null
            ? t('notificationSettings.scope.globalHint')
            : t('notificationSettings.scope.circleHint', { circle: scopeLabel })}
        </ThemedText>
      </Section>

      {input ? (
        <>
          {/* Per-type toggles */}
          <View style={styles.section}>
            {PREFERENCE_TOGGLES.map((toggle) => (
              <ToggleRow
                key={toggle.key}
                label={t(toggle.labelKey)}
                description={t(toggle.descriptionKey)}
                value={input[toggle.key as BooleanPreferenceKey]}
                onValueChange={(v) => update(toggle.key, v)}
              />
            ))}
          </View>

          {/* Quiet hours */}
          <View style={styles.section}>
            <ToggleRow
              label={t('notificationSettings.quietHours.label')}
              description={t('notificationSettings.quietHours.description')}
              value={input.quietHoursEnabled}
              onValueChange={(v) => update('quietHoursEnabled', v)}
            />
            {input.quietHoursEnabled ? (
              <View style={styles.quietRow}>
                <View style={styles.quietCol}>
                  <TimeField
                    label={t('notificationSettings.quietHours.start')}
                    value={input.quietHoursStart ?? ''}
                    onChange={(v) => update('quietHoursStart', v === '' ? null : v)}
                  />
                </View>
                <View style={styles.quietCol}>
                  <TimeField
                    label={t('notificationSettings.quietHours.end')}
                    value={input.quietHoursEnd ?? ''}
                    onChange={(v) => update('quietHoursEnd', v === '' ? null : v)}
                  />
                </View>
              </View>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {t('notificationSettings.quietHours.note')}
            </ThemedText>
          </View>

          {/* Timezone (display only) */}
          <Surface style={styles.tzCard}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('notificationSettings.timezone.label')}
            </ThemedText>
            <LtrText>{timezone}</LtrText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('notificationSettings.timezone.hint')}
            </ThemedText>
          </Surface>

          {error ? (
            <ThemedText
              themeColor="errorFg"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
          {saved ? (
            <ThemedText type="small" themeColor="successFg" accessibilityLiveRegion="polite">
              {t('notificationSettings.saved')}
            </ThemedText>
          ) : null}

          <Button
            label={t('notificationSettings.save')}
            onPress={onSave}
            loading={upsert.isPending}
            disabled={upsert.isPending}
          />
        </>
      ) : null}

      {/* Local test (native only) */}
      {pushSupport() !== 'web-unsupported' ? (
        <Section title={t('notificationSettings.test.sectionTitle')} gap={Spacing.two}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('notificationSettings.test.description')}
          </ThemedText>
          <Button
            variant="secondary"
            label={t('notificationSettings.test.action')}
            onPress={onTest}
          />
          {testFeedback ? (
            <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
              {testFeedback}
            </ThemedText>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}

function ScopeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <ThemedText style={styles.toggleLabel}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.primary, false: Platform.OS === 'ios' ? undefined : theme.border }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  chip: { borderRadius: Radius.pill, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  section: { gap: Spacing.two },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 52,
  },
  toggleText: { flex: 1, gap: Spacing.half },
  toggleLabel: { fontSize: 16, fontWeight: '600' },
  quietRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  quietCol: { flexGrow: 1, flexBasis: 140 },
  tzCard: { gap: Spacing.one },
});
