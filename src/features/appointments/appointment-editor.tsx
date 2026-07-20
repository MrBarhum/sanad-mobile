import { Stack, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormScreen, FigmaMutedNote } from '@/components/figma/figma-form-screen';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import type { Doctor } from '@/features/doctors/api';
import { useDoctors } from '@/features/doctors/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import type { AppointmentStatus, CareAppointment } from './api';
import {
  appointmentDraftFromRow,
  prepareAppointment,
  type AppointmentDraft,
} from './appointment-fields';
import { FigmaAppointmentFields } from './figma-appointment-fields';
import {
  useAppointment,
  useDeleteAppointment,
  useSetAppointmentOutcome,
  useSetAppointmentStatus,
  useUpdateAppointment,
} from './hooks';

const STATUS_TONE: Record<AppointmentStatus, StatusTone> = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'error',
};

/** Appointment status → badge glyph (scheduled reads as "upcoming"). */
const STATUS_GLYPH: Record<AppointmentStatus, string> = {
  scheduled: Glyph.clock,
  completed: Glyph.check,
  cancelled: Glyph.cross,
};

/**
 * View / edit a single appointment — rebuilt in the Figma editor language
 * (FigmaFormScreen header + grouped Surface cards + body-rendered teal save CTA),
 * matching the Add-Appointment form. Managers get the same FigmaAppointmentFields
 * as /appointments/new plus a status card and a two-step delete; everyone else gets
 * a read-only card layout. Real hooks, the appointment-type schema, validation
 * (prepareAppointment), status transitions, and permissions are all preserved.
 */
export function AppointmentEditor({
  circleId,
  canManage,
  canCollaborate,
  appointmentId,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
  appointmentId: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const appointment = useAppointment(appointmentId);
  const doctorsQuery = useDoctors(circleId);

  if (appointment.isLoading) return <LoadingState />;
  if (appointment.isError) {
    return (
      <ErrorState
        message={t('appointments.loadError')}
        retryLabel={t('retry')}
        onRetry={() => appointment.refetch()}
      />
    );
  }
  if (!appointment.data) {
    return (
      <ThemedView style={styles.centered}>
        <EmptyState icon={Glyph.appointment} title={t('appointments.notFound')} />
      </ThemedView>
    );
  }

  const doctors = doctorsQuery.data ?? [];
  // A non-manager who is the assignee may record the outcome (completed/cancelled)
  // via the RPC, but never edit appointment details — managers keep the full editor.
  const canMarkOutcome =
    canCollaborate && !!user && appointment.data.assigned_to === user.id;

  return (
    <>
      {/* The Figma editor draws its own header; hide the native one. */}
      <Stack.Screen options={{ headerShown: false }} />
      {canManage ? (
        <AppointmentEditScreen
          key={appointment.data.id}
          circleId={circleId}
          initial={appointment.data}
          doctors={doctors}
        />
      ) : (
        <AppointmentViewScreen
          circleId={circleId}
          appointment={appointment.data}
          doctors={doctors}
          canMarkOutcome={canMarkOutcome}
        />
      )}
    </>
  );
}

function AppointmentEditScreen({
  circleId,
  initial,
  doctors,
}: {
  circleId: string;
  initial: CareAppointment;
  doctors: Doctor[];
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateAppointment(circleId);

  const [draft, setDraft] = useState<AppointmentDraft>(() => appointmentDraftFromRow(initial));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges(draft);
  const submitting = update.isPending;

  function patch(part: Partial<AppointmentDraft>) {
    setDraft((current) => ({ ...current, ...part }));
    if (status !== 'idle') setStatus('idle');
  }

  async function onSubmit() {
    const prepared = prepareAppointment(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) {
      setStatus('idle');
      return;
    }
    try {
      await update.mutateAsync({ id: initial.id, patch: prepared.input });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <FigmaFormScreen title={t('appointments.detailTitle')} onBack={() => router.back()}>
      <UnsavedChangesGuard when={dirty} />
      <FigmaMutedNote>{t('appointments.disclaimer')}</FigmaMutedNote>

      <FigmaAppointmentFields
        circleId={circleId}
        draft={draft}
        onChange={patch}
        errors={errors}
        doctors={doctors}
      />

      <StatusSection circleId={circleId} appointment={initial} canMarkOutcome canReopen />

      <DeleteAppointmentRow circleId={circleId} id={initial.id} />

      {/* Save CTA — rendered in the body (not the footer prop, which did not render
          on Android). Final block, below the status + destructive delete cards. */}
      <View style={styles.footer}>
        {status === 'saved' ? (
          <Text style={[styles.statusText, { color: theme.successFg }]} accessibilityLiveRegion="polite">
            {t('appointments.saved')}
          </Text>
        ) : null}
        {status === 'error' ? (
          <Text style={[styles.statusText, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('appointments.saveFailed')}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton
          label={t('common.saveChanges')}
          onPress={onSubmit}
          loading={submitting}
        />
      </View>
    </FigmaFormScreen>
  );
}

function AppointmentViewScreen({
  circleId,
  appointment,
  doctors,
  canMarkOutcome,
}: {
  circleId: string;
  appointment: CareAppointment;
  doctors: Doctor[];
  canMarkOutcome: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const when = appointment.ends_at
    ? isolateLtr(
        `${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)} – ${hmFromInstant(appointment.ends_at)}`,
      )
    : isolateLtr(`${ymdFromInstant(appointment.starts_at)} ${hmFromInstant(appointment.starts_at)}`);
  const doctorName = appointment.doctor_id
    ? (doctors.find((doctor) => doctor.id === appointment.doctor_id)?.name ?? null)
    : null;
  const responsible = useMemberLookup(circleId)(appointment.assigned_to);

  return (
    <FigmaScreen gap={12}>
      <FigmaHeader title={t('appointments.detailTitle')} onBack={() => router.back()} />

      {/* Permission note — a sunken bordered card with an info glyph (frame 7b). */}
      <Surface tone="sunken" padded={false} style={styles.note}>
        <Info size={18} color={theme.textSecondary} strokeWidth={2.2} />
        <Text style={[styles.noteText, { color: theme.textSecondary }]}>
          {t(canMarkOutcome ? 'appointments.statusOnly' : 'appointments.readOnly')}
        </Text>
      </Surface>

      {/* Main info card — title, hairline divider, labeled label/value rows. */}
      <Surface tone="card" padded={14}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>{appointment.title}</Text>
        <View style={[styles.divider, { backgroundColor: theme.backgroundSunken }]} />
        <View style={styles.rowsGroup}>
          <DetailRow
            label={t('appointments.fields.type')}
            value={t(`appointments.type.${appointment.appointment_type}`)}
          />
          <DetailRow label={t('appointments.whenLabel')} value={when} alignEnd />
          {appointment.location ? (
            <DetailRow label={t('appointments.locationLabel')} value={appointment.location} />
          ) : null}
          {doctorName ? (
            <DetailRow label={t('appointments.doctorLabel')} value={doctorName} />
          ) : null}
          {responsible ? (
            <DetailRow label={t('assignment.responsible')} value={responsible.label} />
          ) : null}
          {appointment.notes ? (
            <DetailRow label={t('appointments.fields.notes')} value={appointment.notes} notes />
          ) : null}
        </View>
      </Surface>

      <StatusSection
        circleId={circleId}
        appointment={appointment}
        canMarkOutcome={canMarkOutcome}
        canReopen={false}
      />
    </FigmaScreen>
  );
}

/**
 * A labeled read-only row: a muted label on the start, its value filling the rest.
 * `alignEnd` pushes an LTR value (the date/time) to the end of the row (frame 7b);
 * `notes` uses the lighter, taller body treatment for free-text.
 */
function DetailRow({
  label,
  value,
  alignEnd,
  notes,
}: {
  label: string;
  value: string;
  alignEnd?: boolean;
  notes?: boolean;
}) {
  const theme = useTheme();
  const valueStyle = notes
    ? styles.detailValueNotes
    : alignEnd
      ? styles.detailValueEnd
      : styles.detailValue;
  return (
    <View style={[styles.detailRow, alignEnd && styles.detailRowBetween]}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[valueStyle, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

/**
 * Status card. `canMarkOutcome` (a manager, or the assigned member) may move a
 * scheduled appointment to completed/cancelled through the
 * `set_assigned_appointment_outcome` RPC — status only, no detail edits.
 * `canReopen` (managers) may move a closed appointment back to scheduled via the
 * direct manager update (the outcome RPC intentionally does not allow reopening).
 */
function StatusSection({
  circleId,
  appointment,
  canMarkOutcome,
  canReopen,
}: {
  circleId: string;
  appointment: CareAppointment;
  canMarkOutcome: boolean;
  canReopen: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const outcome = useSetAppointmentOutcome(circleId);
  const reopenStatus = useSetAppointmentStatus(circleId);
  const [pending, setPending] = useState(false);
  // Two-step confirm so a stray tap can't irreversibly close a care appointment
  // (matches the list). Reopening is already an explicit, reversible manager action.
  const [confirm, setConfirm] = useState<'completed' | 'cancelled' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(status: 'completed' | 'cancelled') {
    setPending(true);
    setError(null);
    try {
      await outcome.mutateAsync({ id: appointment.id, status });
      setConfirm(null);
    } catch {
      setError(t('appointments.saveFailed'));
    } finally {
      setPending(false);
    }
  }

  async function reopen() {
    setPending(true);
    setError(null);
    try {
      await reopenStatus.mutateAsync({ id: appointment.id, status: 'scheduled' as AppointmentStatus });
    } catch {
      setError(t('appointments.saveFailed'));
    } finally {
      setPending(false);
    }
  }

  const showOutcome = canMarkOutcome && appointment.status === 'scheduled';
  const showReopen = canReopen && appointment.status !== 'scheduled';

  return (
    <Surface tone="card" radius={Radius.lg} padded={14} gap={12}>
      <View style={styles.statusHeader}>
        <Text style={[styles.statusLabel, { color: theme.text }]}>{t('appointments.fields.status')}</Text>
        <StatusBadge
          tone={STATUS_TONE[appointment.status]}
          glyph={STATUS_GLYPH[appointment.status]}
          label={t(`appointments.status.${appointment.status}`)}
        />
      </View>

      {error ? (
        <Text
          style={[styles.statusError, { color: theme.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {showOutcome ? (
        confirm ? (
          <View style={styles.confirmStack}>
            <Text style={[styles.confirmBody, { color: theme.textSecondary }]}>
              {t(
                confirm === 'completed'
                  ? 'appointments.confirmCompletedBody'
                  : 'appointments.confirmCancelledBody',
              )}
            </Text>
            <Button
              label={t(confirm === 'completed' ? 'appointments.markCompleted' : 'appointments.markCancelled')}
              variant={confirm === 'completed' ? 'primary' : 'danger'}
              loading={pending}
              onPress={() => mark(confirm)}
            />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={pending}
              onPress={() => setConfirm(null)}
            />
          </View>
        ) : (
          <View style={styles.actionRow}>
            <View style={styles.actionCol}>
              <Button
                label={t('appointments.markCompleted')}
                onPress={() => setConfirm('completed')}
              />
            </View>
            <View style={styles.actionCol}>
              <Button
                label={t('appointments.markCancelled')}
                variant="secondary"
                onPress={() => setConfirm('cancelled')}
              />
            </View>
          </View>
        )
      ) : showReopen ? (
        <Button
          label={t('appointments.reopen')}
          variant="secondary"
          loading={pending}
          disabled={pending}
          onPress={reopen}
        />
      ) : null}
    </Surface>
  );
}

function DeleteAppointmentRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteAppointment(circleId);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      await del.mutateAsync(id);
      router.back();
    } catch {
      setPending(false);
    }
  }

  return (
    <Surface tone="card" radius={Radius.lg} padded={16} gap={16}>
      {confirming ? (
        <View style={styles.actionRow}>
          <View style={styles.actionCol}>
            <Button
              label={t('common.confirmDelete')}
              variant="danger"
              loading={pending}
              onPress={onDelete}
            />
          </View>
          <View style={styles.actionCol}>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={pending}
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : (
        <Button
          label={t('appointments.deleteAppointment')}
          variant="danger"
          onPress={() => setConfirming(true)}
        />
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  footer: { gap: Spacing.two },
  statusText: { fontSize: 14, fontFamily: FontFamily.semibold, textAlign: 'center' },
  // Permission note (sunken card)
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  noteText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 22 },
  // Main info card
  infoTitle: { fontSize: 19, fontFamily: FontFamily.bold, lineHeight: 28 },
  divider: { height: BorderWidth.standard, alignSelf: 'stretch', marginVertical: 12 },
  rowsGroup: { gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
  detailRowBetween: { justifyContent: 'space-between' },
  detailLabel: { fontSize: 15, fontFamily: FontFamily.semibold, flexShrink: 0 },
  detailValue: { flex: 1, fontSize: 16, fontFamily: FontFamily.semibold, lineHeight: 24 },
  detailValueEnd: { flexShrink: 1, fontSize: 16, fontFamily: FontFamily.semibold, lineHeight: 24, writingDirection: 'ltr' },
  detailValueNotes: { flex: 1, fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusLabel: { fontSize: 16, fontFamily: FontFamily.bold },
  statusError: { fontSize: 14, fontFamily: FontFamily.semibold },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  actionCol: { flex: 1 },
  confirmStack: { gap: Spacing.two },
  confirmBody: { fontSize: 14, fontFamily: FontFamily.regular, lineHeight: 21 },
});
