import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCircleSelection } from './provider';

/**
 * Shows the active care circle (name + recipient) and, when the user belongs to
 * more than one, lets them switch. With a single circle it stays a compact,
 * non-interactive card. RTL-safe (no hardcoded text alignment; rows use
 * space-between so they mirror correctly).
 */
export function CircleSwitcher() {
  const { t } = useTranslation();
  const { circles, activeCircle, activeCircleId, setActiveCircle } = useCircleSelection();
  const [open, setOpen] = useState(false);

  if (!activeCircle) return null;

  const multiple = circles.length > 1;

  return (
    <>
      <Pressable
        onPress={multiple ? () => setOpen(true) : undefined}
        disabled={!multiple}
        accessibilityRole={multiple ? 'button' : undefined}
        accessibilityHint={multiple ? t('circleSwitcher.switch') : undefined}
        accessibilityLabel={activeCircle.circleName}
        style={({ pressed }) => [pressed && multiple && styles.pressed]}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('careCircle.dashboard.circleLabel')}
            </ThemedText>
            {multiple ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('circleSwitcher.switch')}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText style={styles.circleName}>{activeCircle.circleName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {activeCircle.recipientName ?? t('careCircle.dashboard.noRecipient')}
          </ThemedText>
        </ThemedView>
      </Pressable>

      {multiple ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable
            style={styles.backdrop}
            accessibilityLabel={t('common.close')}
            onPress={() => setOpen(false)}>
            <Pressable style={styles.sheetWrap} onPress={() => {}}>
              <ThemedView style={styles.sheet}>
                <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
                  {t('circleSwitcher.chooseTitle')}
                </ThemedText>
                <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
                  {circles.map((circle) => {
                    const current = circle.circleId === activeCircleId;
                    return (
                      <CircleRow
                        key={circle.circleId}
                        circleName={circle.circleName}
                        recipientName={circle.recipientName}
                        roleLabel={t(`circleMembers.roles.${circle.role}`)}
                        current={current}
                        currentLabel={t('circleSwitcher.current')}
                        onPress={() => {
                          setActiveCircle(circle.circleId);
                          setOpen(false);
                        }}
                      />
                    );
                  })}
                </ScrollView>
              </ThemedView>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

function CircleRow({
  circleName,
  recipientName,
  roleLabel,
  current,
  currentLabel,
  onPress,
}: {
  circleName: string;
  recipientName: string | null;
  roleLabel: string;
  current: boolean;
  currentLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView
        type={current ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.circleRow}>
        <View style={styles.rowMain}>
          <ThemedText style={styles.rowName}>{circleName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {recipientName ?? roleLabel}
          </ThemedText>
        </View>
        {current ? (
          <ThemedText type="small" style={{ color: theme.text }}>
            ✓ {currentLabel}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {roleLabel}
          </ThemedText>
        )}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  circleName: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { width: '100%', maxWidth: MaxFormWidth, alignSelf: 'center' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    maxHeight: '80%',
  },
  title: { fontSize: 22, lineHeight: 30 },
  list: { flexGrow: 0 },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    minHeight: 60,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  rowName: { fontSize: 18, fontWeight: '600' },
});
