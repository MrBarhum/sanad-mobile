import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { FormModal } from '@/components/form-modal';
import { ItemActions } from '@/components/item-actions';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { confirmDiscard } from '@/utils/confirm';
import { fieldErrors } from '@/utils/form';

import type { EmergencyContact } from './api';
import {
  useCreateEmergencyContact,
  useDeleteEmergencyContact,
  useEmergencyContacts,
  useUpdateEmergencyContact,
} from './hooks';
import { emergencyContactSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Emergency contacts list with add/edit/delete (managers only can mutate). */
export function EmergencyContactsManager({
  circleId,
  canManage,
}: {
  circleId: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const contacts = useEmergencyContacts(circleId);
  const deleteContact = useDeleteEmergencyContact(circleId);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EmergencyContact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const modalOpen = adding || editing !== null;
  const closeModal = () => {
    setAdding(false);
    setEditing(null);
  };

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteContact.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (contacts.isLoading) return <LoadingState />;
  if (contacts.isError) {
    return (
      <ErrorState
        message={t('emergencyContacts.loadError')}
        retryLabel={t('retry')}
        onRetry={() => contacts.refetch()}
      />
    );
  }

  const items = contacts.data ?? [];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canManage ? (
          <Button label={t('emergencyContacts.add')} onPress={() => setAdding(true)} />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title={t('emergencyContacts.emptyTitle')}
            subtitle={canManage ? t('emergencyContacts.emptySubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>
            {items.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                canManage={canManage}
                deleting={deletingId === contact.id}
                onEdit={() => setEditing(contact)}
                onDelete={() => onDelete(contact.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {modalOpen ? (
        <ContactFormModal
          key={editing?.id ?? 'new'}
          circleId={circleId}
          initial={editing}
          onClose={closeModal}
        />
      ) : null}
    </ThemedView>
  );
}

function ContactCard({
  contact,
  canManage,
  deleting,
  onEdit,
  onDelete,
}: {
  contact: EmergencyContact;
  canManage: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardName}>{contact.name}</ThemedText>
        {contact.is_primary ? (
          <ThemedView type="backgroundSelected" style={styles.badge}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('emergencyContacts.primaryBadge')}
            </ThemedText>
          </ThemedView>
        ) : null}
      </View>

      {contact.relationship ? (
        <ThemedText type="small" themeColor="textSecondary">
          {contact.relationship}
        </ThemedText>
      ) : null}

      <ThemedText style={styles.phone} selectable>
        {contact.phone}
      </ThemedText>

      {contact.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {contact.notes}
        </ThemedText>
      ) : null}

      {canManage ? (
        <ItemActions
          deleting={deleting}
          onEdit={onEdit}
          onDelete={onDelete}
          labels={{
            edit: t('common.edit'),
            delete: t('common.delete'),
            confirm: t('common.confirmDelete'),
            cancel: t('common.cancel'),
          }}
        />
      ) : null}
    </ThemedView>
  );
}

function ContactFormModal({
  circleId,
  initial,
  onClose,
}: {
  circleId: string;
  initial: EmergencyContact | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const create = useCreateEmergencyContact(circleId);
  const update = useUpdateEmergencyContact(circleId);

  const [name, setName] = useState(initial?.name ?? '');
  const [relationship, setRelationship] = useState(initial?.relationship ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { dirty } = useUnsavedChanges({ name, relationship, phone, isPrimary, notes });
  const submitting = create.isPending || update.isPending;

  function requestClose() {
    if (!dirty) {
      onClose();
      return;
    }
    confirmDiscard(
      {
        title: t('common.unsavedTitle'),
        message: t('common.unsavedMessage'),
        confirm: t('common.discardChanges'),
        cancel: t('common.keepEditing'),
      },
      onClose,
    );
  }

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'name':
        return t('emergencyContacts.errors.name');
      case 'phone':
        return t('emergencyContacts.errors.phone');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  async function onSubmit() {
    const parsed = emergencyContactSchema.safeParse({
      name,
      relationship,
      phone,
      is_primary: isPrimary,
      notes,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitError(null);
    const input = {
      name: parsed.data.name,
      relationship: nullify(parsed.data.relationship),
      phone: parsed.data.phone,
      is_primary: parsed.data.is_primary,
      notes: nullify(parsed.data.notes),
    };

    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, input });
      } else {
        await create.mutateAsync(input);
      }
      onClose();
    } catch {
      setSubmitError(t('emergencyContacts.saveFailed'));
    }
  }

  return (
    <FormModal
      visible
      title={initial ? t('emergencyContacts.editTitle') : t('emergencyContacts.addTitle')}
      submitLabel={initial ? t('common.saveChanges') : t('emergencyContacts.add')}
      cancelLabel={t('common.cancel')}
      closeLabel={t('common.close')}
      submitting={submitting}
      submitDisabled={!dirty}
      error={submitError}
      onSubmit={onSubmit}
      onClose={requestClose}>
      <FormField
        label={t('emergencyContacts.fields.name')}
        value={name}
        onChangeText={setName}
        error={fieldError(errors.name)}
      />
      <FormField
        label={t('emergencyContacts.fields.relationship')}
        value={relationship}
        onChangeText={setRelationship}
        placeholder={t('emergencyContacts.placeholders.relationship')}
        error={fieldError(errors.relationship)}
      />
      <FormField
        label={t('emergencyContacts.fields.phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        error={fieldError(errors.phone)}
      />
      <View style={styles.switchRow}>
        <ThemedText type="smallBold">{t('emergencyContacts.fields.isPrimary')}</ThemedText>
        <Switch
          value={isPrimary}
          onValueChange={setIsPrimary}
          trackColor={{ true: theme.text, false: theme.backgroundSelected }}
          accessibilityLabel={t('emergencyContacts.fields.isPrimary')}
        />
      </View>
      <FormField
        label={t('emergencyContacts.fields.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('emergencyContacts.placeholders.notes')}
        multiline
        error={fieldError(errors.notes)}
      />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  list: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardName: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  badge: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  phone: { fontSize: 16 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
