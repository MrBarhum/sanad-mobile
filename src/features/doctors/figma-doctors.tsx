import { Pencil, Phone, Stethoscope, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { IconChip } from '@/components/figma/icon-chip';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaLayout,
  FigmaRadius,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';

import type { Doctor } from './api';
import { DoctorFormModal } from './doctor-form-modal';
import { useDeleteDoctor, useDoctors } from './hooks';

/** Per-doctor Stethoscope-chip accent, cycled by index (Figma uses varied hues). */
const CHIP_COLORS = [
  FigmaCategory.green,
  FigmaCategory.blue,
  FigmaCategory.gold,
  FigmaCategory.purple,
  FigmaCategory.teal,
] as const;

/**
 * The Figma Make DoctorsScreen, recreated as literally as possible in React Native
 * and wired to real Sanad data. Mirrors `DoctorsScreen.tsx`: a back/title/teal-"+"
 * header and a list of bordered cards — each a Stethoscope icon chip (category
 * color), the doctor name, specialty, and clinic/hospital line, plus a round
 * one-tap CALL button (tel: via Linking) and a quiet phone well with the number
 * LTR-isolated.
 *
 * Managers additionally get Edit and Delete actions on each card (delete behind a
 * two-step inline confirm) — previously these lived only in the unrouted legacy
 * DoctorsManager, so a manager could add and call a doctor but never correct or
 * remove one. Reuses the manager's validated `DoctorFormModal` for both add and
 * edit and the `useDeleteDoctor` hook; Cairo + Figma tokens, RTL.
 */
export function FigmaDoctors({ circleId, canManage }: { circleId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  const doctorsQuery = useDoctors(circleId);
  const deleteDoctor = useDeleteDoctor(circleId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const doctors = doctorsQuery.data ?? [];
  const modalOpen = adding || editing !== null;

  function closeModal() {
    setAdding(false);
    setEditing(null);
  }

  async function onDelete(id: string) {
    setDeleteError(null);
    setDeletingId(id);
    try {
      await deleteDoctor.mutateAsync(id);
    } catch {
      setDeleteError(t('doctors.saveFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <FigmaScreen>
        <FigmaHeader
          title={t('figma.doctors.title')}
          onAdd={canManage ? () => setAdding(true) : undefined}
          addAccessibilityLabel={t('doctors.add')}
        />

        {doctorsQuery.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : doctorsQuery.isError ? (
          <FigmaCard tone="card" radius={FigmaRadius.r16}>
            <Text style={[styles.errorText, { color: c.error }]}>{t('doctors.loadError')}</Text>
            <Pressable
              onPress={() => doctorsQuery.refetch()}
              accessibilityRole="button"
              style={[styles.retry, { backgroundColor: c.primary }]}>
              <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
            </Pressable>
          </FigmaCard>
        ) : doctors.length === 0 ? (
          <View style={styles.empty}>
            <Stethoscope size={40} color={c.muted} strokeWidth={1} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {t('figma.doctors.emptyTitle')}
            </Text>
            {canManage ? (
              <Text style={[styles.emptySubtitle, { color: c.muted }]}>
                {t('figma.doctors.emptySubtitle')}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            {deleteError ? (
              <Text
                style={[styles.deleteError, { color: c.error }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                {deleteError}
              </Text>
            ) : null}
            <View style={styles.list}>
              {doctors.map((doctor, index) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  chipColor={CHIP_COLORS[index % CHIP_COLORS.length]}
                  scheme={scheme}
                  canManage={canManage}
                  deleting={deletingId === doctor.id}
                  onEdit={() => setEditing(doctor)}
                  onDelete={() => onDelete(doctor.id)}
                />
              ))}
            </View>
          </>
        )}
      </FigmaScreen>

      {modalOpen ? (
        <DoctorFormModal
          key={editing?.id ?? 'new'}
          circleId={circleId}
          initial={editing}
          onClose={closeModal}
        />
      ) : null}
    </>
  );
}

function DoctorCard({
  doctor,
  chipColor,
  scheme,
  canManage,
  deleting,
  onEdit,
  onDelete,
}: {
  doctor: Doctor;
  chipColor: string;
  scheme: FigmaScheme;
  canManage: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];
  const [confirming, setConfirming] = useState(false);

  const phone = doctor.phone ?? null;
  const specialty = doctor.specialty ?? null;
  const clinic = doctor.clinic_name ?? null;

  // Existing one-tap call pattern (mirrors ContactCard): sanitize, then tel:.
  function call() {
    if (!phone) return;
    const sanitized = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${sanitized}`).catch(() => {
      // Device may not support telephony (tablet / emulator) — ignore quietly.
    });
  }

  return (
    <FigmaCard tone="card" radius={FigmaRadius.r24} padding={16}>
      <View style={styles.cardTop}>
        <IconChip
          Icon={Stethoscope}
          color={chipColor}
          size={FigmaLayout.iconChip.xl}
          radius={FigmaRadius.pill}
          iconSize={24}
        />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: c.text }]} numberOfLines={1}>
            {doctor.name}
          </Text>
          {specialty ? (
            <Text style={[styles.cardSpecialty, { color: c.muted }]} numberOfLines={1}>
              {specialty}
            </Text>
          ) : null}
          {clinic ? (
            <Text style={[styles.cardClinic, { color: c.muted }]} numberOfLines={1}>
              {clinic}
            </Text>
          ) : null}
        </View>
        {phone ? (
          <Pressable
            onPress={call}
            accessibilityRole="button"
            accessibilityLabel={`${t('common.call')} ${doctor.name}`}
            style={({ pressed }) => [
              styles.callButton,
              { backgroundColor: withAlpha(c.primary, 0.12) },
              pressed && styles.pressed,
            ]}>
            <Phone size={20} color={c.primary} />
          </Pressable>
        ) : null}
      </View>

      {phone ? (
        <View style={[styles.phoneWell, { backgroundColor: c.elevated, borderColor: c.border }]}>
          <Text style={[styles.phoneText, { color: c.muted }]} selectable>
            {isolateLtr(phone)}
          </Text>
        </View>
      ) : null}

      {canManage ? (
        <View style={[styles.actions, { borderTopColor: c.border }]}>
          {confirming ? (
            <>
              <ActionButton
                Icon={Trash2}
                label={t('common.confirmDelete')}
                tone="danger"
                filled
                loading={deleting}
                onPress={onDelete}
                scheme={scheme}
              />
              <ActionButton
                label={t('common.cancel')}
                tone="muted"
                disabled={deleting}
                onPress={() => setConfirming(false)}
                scheme={scheme}
              />
            </>
          ) : (
            <>
              <ActionButton
                Icon={Pencil}
                label={t('common.edit')}
                tone="muted"
                onPress={onEdit}
                scheme={scheme}
              />
              <ActionButton
                Icon={Trash2}
                label={t('common.delete')}
                tone="danger"
                onPress={() => setConfirming(true)}
                scheme={scheme}
              />
            </>
          )}
        </View>
      ) : null}
    </FigmaCard>
  );
}

/** A compact card-footer action pill (≥48dp), icon + label, RTL-safe, theme-tinted. */
function ActionButton({
  label,
  Icon,
  tone,
  filled = false,
  loading = false,
  disabled = false,
  onPress,
  scheme,
}: {
  label: string;
  Icon?: typeof Pencil;
  tone: 'muted' | 'danger';
  filled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  scheme: FigmaScheme;
}) {
  const c = FigmaColors[scheme];
  const danger = tone === 'danger';
  const fg = filled ? '#FFFFFF' : danger ? c.error : c.text;
  const bg = filled ? c.error : danger ? withAlpha(c.error, 0.1) : c.elevated;
  const border = filled ? 'transparent' : danger ? withAlpha(c.error, 0.25) : c.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading || disabled, busy: loading }}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: bg, borderColor: border },
        (pressed || disabled) && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={16} color={fg} /> : null}
          <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: FigmaFont.medium, textAlign: 'center' },
  deleteError: { fontSize: 14, fontFamily: FigmaFont.medium },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: FigmaRadius.r12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 13, fontFamily: FigmaFont.semibold },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: FigmaFont.semibold, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, fontFamily: FigmaFont.regular, textAlign: 'center' },
  list: { gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 17, fontFamily: FigmaFont.bold },
  cardSpecialty: { fontSize: 14, fontFamily: FigmaFont.regular },
  cardClinic: { fontSize: 13, fontFamily: FigmaFont.regular },
  callButton: {
    width: FigmaLayout.iconChip.xl,
    height: FigmaLayout.iconChip.xl,
    borderRadius: FigmaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  phoneWell: {
    marginTop: 12,
    borderRadius: FigmaRadius.r12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  phoneText: { fontSize: 13, fontFamily: FigmaFont.regular, writingDirection: 'ltr' },
  // Manager actions footer
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: FigmaRadius.r12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  actionLabel: { fontSize: 14, fontFamily: FigmaFont.semibold },
});
