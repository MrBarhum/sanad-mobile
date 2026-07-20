import { Phone } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSwitch } from '@/components/figma/figma-form-screen';
import { FormField } from '@/components/form-field';
import { FormModal } from '@/components/form-modal';
import { GlyphChip } from '@/components/glyph-chip';
import { ItemActions } from '@/components/item-actions';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { initialFor } from '@/constants/glyphs';
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme';
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

/** Open the dialer for a phone number (sanitize, then tel:). */
function callNumber(phone: string) {
  const sanitized = phone.replace(/[^\d+]/g, '');
  Linking.openURL(`tel:${sanitized}`).catch(() => {
    // Device may not support telephony (tablet / emulator) — ignore quietly.
  });
}

/**
 * The Dar emergency-contacts manager: the green sub-screen header (back + add),
 * bordered contact cards (letter avatar + name + relationship + LTR phone + a
 * tinted call circle + primary badge + manager edit/delete), and the add/edit
 * form sheet. Managers only can mutate. Cairo + Dar tokens, both themes, RTL.
 */
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

  if (contacts.isLoading) {
    return (
      <FigmaScreen>
        <FigmaHeader title={t('emergencyContacts.title')} />
        <LoadingState />
      </FigmaScreen>
    );
  }
  if (contacts.isError) {
    return (
      <FigmaScreen>
        <FigmaHeader title={t('emergencyContacts.title')} />
        <ErrorState
          message={t('emergencyContacts.loadError')}
          retryLabel={t('retry')}
          onRetry={() => contacts.refetch()}
        />
      </FigmaScreen>
    );
  }

  const items = contacts.data ?? [];

  return (
    <>
      <FigmaScreen>
        <FigmaHeader
          title={t('emergencyContacts.title')}
          onAdd={canManage ? () => setAdding(true) : undefined}
          addAccessibilityLabel={t('emergencyContacts.add')}
        />

        {items.length === 0 ? (
          <EmptyState
            iconName="member"
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
      </FigmaScreen>

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
  const c = useTheme();
  const phone = contact.phone ?? null;

  return (
    <Surface tone="card" radius={Radius.card} padded={14} gap={12}>
      <View style={styles.cardTop}>
        <GlyphChip glyph={initialFor(contact.name)} tone="primary" size="md" shape="circle" />
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {contact.name}
          </Text>
          {contact.relationship ? (
            <Text style={[styles.meta, { color: c.textSecondary }]} numberOfLines={1}>
              {contact.relationship}
            </Text>
          ) : null}
          {phone ? (
            <Text style={[styles.phone, { color: c.primaryText }]} numberOfLines={1} selectable>
              {isolateLtr(phone)}
            </Text>
          ) : null}
        </View>
        {phone ? (
          <Pressable
            onPress={() => callNumber(phone)}
            accessibilityRole="button"
            accessibilityLabel={`${t('common.call')} ${contact.name}`}
            style={({ pressed }) => [
              styles.callBtn,
              { backgroundColor: c.primaryBg, borderColor: c.border },
              pressed && styles.pressed,
            ]}>
            <Phone size={19} color={c.primaryText} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {contact.notes ? (
        <View style={[styles.notesWell, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
          <Text style={[styles.notesText, { color: c.textSecondary }]}>{contact.notes}</Text>
        </View>
      ) : null}

      {contact.is_primary ? (
        <View style={styles.badgeRow}>
          <StatusBadge tone="info" label={t('emergencyContacts.primaryBadge')} />
        </View>
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
    </Surface>
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, fontFamily: FontFamily.bold },
  meta: { fontSize: 14, fontFamily: FontFamily.medium },
  phone: { fontSize: 15, fontFamily: FontFamily.bold, marginTop: 2 },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: { opacity: 0.7 },
  notesWell: {
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notesText: { fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 23 },
  badgeRow: { flexDirection: 'row' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
