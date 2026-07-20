import { Pencil, Phone, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { GlyphChip } from '@/components/glyph-chip';
import { EmptyState } from '@/components/states';
import { isolateLtr } from '@/components/ltr-text';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Doctor } from './api';
import { DoctorFormModal } from './doctor-form-modal';
import { useDeleteDoctor, useDoctors } from './hooks';

/**
 * The Dar DoctorsScreen, wired to real Sanad data (mirrors `DoctorsScreen.tsx`):
 * the green sub-screen header (back + title + add), then bordered doctor cards —
 * a green doctor icon square, name + specialty + clinic, a tinted one-tap CALL
 * circle (tel: via Linking), and a sunken phone well with the number LTR-isolated.
 *
 * Managers additionally get Edit and Delete actions on each card (delete behind a
 * two-step inline confirm), reusing the validated `DoctorFormModal` and the
 * `useDeleteDoctor` hook. Cairo + Dar tokens, both themes, RTL.
 */
export function FigmaDoctors({ circleId, canManage }: { circleId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const c = useTheme();

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
          <SkeletonList />
        ) : doctorsQuery.isError ? (
          <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
            <Text style={[styles.errorText, { color: c.errorFg }]}>{t('doctors.loadError')}</Text>
            <Pressable
              onPress={() => doctorsQuery.refetch()}
              accessibilityRole="button"
              style={[styles.retry, { backgroundColor: c.primary, borderColor: c.border }]}>
              <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
            </Pressable>
          </View>
        ) : doctors.length === 0 ? (
          <EmptyState
            iconName="doctor"
            title={t('figma.doctors.emptyTitle')}
            subtitle={canManage ? t('figma.doctors.emptySubtitle') : undefined}
          />
        ) : (
          <>
            {deleteError ? (
              <Text
                style={[styles.deleteError, { color: c.errorFg }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                {deleteError}
              </Text>
            ) : null}
            <View style={styles.list}>
              {doctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
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
  canManage,
  deleting,
  onEdit,
  onDelete,
}: {
  doctor: Doctor;
  canManage: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
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
    <Surface tone="card" radius={Radius.card} padded={16}>
      <View style={styles.cardTop}>
        <GlyphChip iconName="doctor" tone="primary" size="md" />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: c.text }]} numberOfLines={1}>
            {doctor.name}
          </Text>
          {specialty ? (
            <Text style={[styles.cardMeta, { color: c.textSecondary }]} numberOfLines={1}>
              {specialty}
            </Text>
          ) : null}
          {clinic ? (
            <Text style={[styles.cardMeta, { color: c.textSecondary }]} numberOfLines={1}>
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
              { backgroundColor: c.primaryBg, borderColor: c.border },
              pressed && styles.pressed,
            ]}>
            <Phone size={20} color={c.primaryText} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {phone ? (
        <View style={[styles.phoneWell, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
          <Text style={[styles.phoneText, { color: c.textSecondary }]} selectable>
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
              />
              <ActionButton
                label={t('common.cancel')}
                tone="muted"
                disabled={deleting}
                onPress={() => setConfirming(false)}
              />
            </>
          ) : (
            <>
              <ActionButton Icon={Pencil} label={t('common.edit')} tone="muted" onPress={onEdit} />
              <ActionButton
                Icon={Trash2}
                label={t('common.delete')}
                tone="danger"
                onPress={() => setConfirming(true)}
              />
            </>
          )}
        </View>
      ) : null}
    </Surface>
  );
}

/** A compact card-footer action pill (≥48dp): icon + label, RTL-safe, Dar-toned. */
function ActionButton({
  label,
  Icon,
  tone,
  filled = false,
  loading = false,
  disabled = false,
  onPress,
}: {
  label: string;
  Icon?: typeof Pencil;
  tone: 'muted' | 'danger';
  filled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const danger = tone === 'danger';
  // Restrained danger: outline (card + err border + err text); the confirm step
  // is the one solid fill (dangerSolid + onError). Muted = sunken + line + ink.
  const fg = filled ? c.onError : danger ? c.errorFg : c.text;
  const bg = filled ? c.dangerSolid : danger ? c.backgroundElement : c.backgroundSunken;
  const border = filled ? c.dangerSolid : danger ? c.errorFg : c.border;

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
          {Icon ? <Icon size={16} color={fg} strokeWidth={2} /> : null}
          <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  deleteError: { fontSize: 14, fontFamily: FontFamily.medium },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  list: { gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1, minWidth: 0, gap: 2 },
  cardName: { fontSize: 16, fontFamily: FontFamily.bold },
  cardMeta: { fontSize: 14, fontFamily: FontFamily.medium },
  callButton: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: { opacity: 0.7 },
  phoneWell: {
    marginTop: 12,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  phoneText: { fontSize: 14, fontFamily: FontFamily.medium, writingDirection: 'ltr' },
  // Manager actions footer
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: BorderWidth.standard,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 12,
  },
  actionLabel: { fontSize: 14, fontFamily: FontFamily.bold },
});
