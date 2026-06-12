import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatusBadge } from '@/components/status-badge';
import { MaxFormWidth, Spacing } from '@/constants/theme';

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
      <Surface
        onPress={multiple ? () => setOpen(true) : undefined}
        disabled={!multiple}
        accessibilityHint={multiple ? t('circleSwitcher.switch') : undefined}
        accessibilityLabel={activeCircle.circleName}
        style={styles.cardGap}>
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
        <ThemedText type="sectionTitle">{activeCircle.circleName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {activeCircle.recipientName ?? t('careCircle.dashboard.noRecipient')}
        </ThemedText>
      </Surface>

      {multiple ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable
            style={styles.backdrop}
            accessibilityLabel={t('common.close')}
            onPress={() => setOpen(false)}>
            <Pressable style={styles.sheetWrap} onPress={() => {}}>
              <ThemedView style={styles.sheet}>
                <ThemedText type="sectionTitle" accessibilityRole="header">
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
  return (
    <Surface
      tone={current ? 'selected' : 'card'}
      onPress={onPress}
      selected={current}
      accessibilityLabel={`${circleName}، ${recipientName ?? roleLabel}${current ? `، ${currentLabel}` : ''}`}
      style={styles.circleRow}>
      <View style={styles.rowMain}>
        <ThemedText type="cardTitle">{circleName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {recipientName ?? roleLabel}
        </ThemedText>
      </View>
      {current ? (
        <StatusBadge tone="success" label={currentLabel} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {roleLabel}
        </ThemedText>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  cardGap: { gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
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
  list: { flexGrow: 0 },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.two,
    minHeight: 60,
  },
  rowMain: { flex: 1, gap: Spacing.half },
});
