import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Button } from './button';

type ItemActionsLabels = {
  edit: string;
  delete: string;
  confirm: string;
  cancel: string;
};

/**
 * Edit + delete actions for a list row with an inline two-step delete confirm.
 * Deliberately avoids `Alert.alert` (which is unreliable on react-native-web):
 * tapping delete swaps the buttons for a confirm/cancel pair in place, so it
 * behaves identically on web and native.
 */
export function ItemActions({
  onEdit,
  onDelete,
  deleting = false,
  disabled = false,
  labels,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
  disabled?: boolean;
  labels: ItemActionsLabels;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <View style={styles.row}>
        <Button
          size="sm"
          variant="danger"
          label={labels.confirm}
          loading={deleting}
          onPress={onDelete}
        />
        <Button
          size="sm"
          variant="secondary"
          label={labels.cancel}
          disabled={deleting}
          onPress={() => setConfirming(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Button
        size="sm"
        variant="secondary"
        label={labels.edit}
        disabled={disabled}
        onPress={onEdit}
      />
      <Button
        size="sm"
        variant="danger"
        label={labels.delete}
        disabled={disabled}
        onPress={() => setConfirming(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
