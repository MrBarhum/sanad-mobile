import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ContactCard } from '@/components/contact-card';
import { FigmaSwitch } from '@/components/figma/figma-form-screen';
import { FormField } from '@/components/form-field';
import { FormModal } from '@/components/form-modal';
import { ItemActions } from '@/components/item-actions';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Glyph } from '@/constants/glyphs';
import { Spacing } from '@/constants/theme';
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
    <>
      <Screen>
        {canManage ? (
          <Button glyph={Glyph.plus} label={t('emergencyContacts.add')} onPress={() => setAdding(true)} />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={Glyph.contact}
            title={t('emergencyContacts.emptyTitle')}
            subtitle={canManage ? t('emergencyContacts.emptySubtitle') : undefined}
          />
        ) : (
          <View style={styles.list}>
            {items.map((contact) => (
              <ContactRow
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
      </Screen>

      {modalOpen ? (
        <ContactFormModal
          key={editing?.id ?? 'new'}
          circleId={circleId}
          initial={editing}
          onClose={closeModal}
        />
      ) : null}
    </>
  );
}

function ContactRow({
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
    <ContactCard
      name={contact.name}
      subtitle={contact.relationship}
      phone={contact.phone}
      callLabel={`${t('common.call')} ${contact.name}`}
      notes={contact.notes}>
      {contact.is_primary ? (
        <StatusBadge tone="info" label={t('emergencyContacts.primaryBadge')} />
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
    </ContactCard>
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
        <FigmaSwitch
          value={isPrimary}
          onValueChange={setIsPrimary}
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
  list: { gap: Spacing.three },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
