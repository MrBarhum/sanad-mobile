import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaButton } from '@/components/figma/figma-button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormCard, FigmaFormScreen, FigmaMutedNote } from '@/components/figma/figma-form-screen';
import { FigmaFont } from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { Spacing } from '@/constants/theme';
import type { Doctor } from '@/features/doctors/api';
import { useDoctors } from '@/features/doctors/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
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
 * (FigmaFormScreen header + grouped FigmaFormCards + body-rendered teal save CTA),
 * matching the Add-Appointment form. Managers get the same FigmaAppointmentFields
 * as /appointments/new plus a status card and a two-step delete; everyone else gets
 * a read-only card layout. Real hooks, the appointment-type schema, validation
 * (prepareAppointment), status transitions, and permissions are all preserved.
 */
export function AppointmentEditor({
  circleId,
  canManage,
  appointmentId,
}: {
  circleId: string;
  canManage: boolean;
  appointmentId: string;
}) {
  const { t } = useTranslation();
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

      <FigmaAppointmentFields draft={draft} onChange={patch} errors={errors} doctors={doctors} />

      <StatusSection circleId={circleId} appointment={initial} canManage />

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
}: {
  circleId: string;
  appointment: CareAppointment;
  doctors: Doctor[];
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

  return (
    <FigmaFormScreen title={t('appointments.detailTitle')} onBack={() => router.back()}>
      <FigmaMutedNote>{t('appointments.readOnly')}</FigmaMutedNote>

      <FigmaFormCard>
        <Text style={[styles.title, { color: theme.text }]}>{appointment.title}</Text>
        <ReadOnlyRow
          label={t('appointments.fields.type')}
          value={t(`appointments.type.${appointment.appointment_type}`)}
        />
        <ReadOnlyRow label={t('appointments.whenLabel')} value={when} />
        {appointment.location ? (
          <ReadOnlyRow label={t('appointments.locationLabel')} value={appointment.location} />
        ) : null}
        {doctorName ? <ReadOnlyRow label={t('appointments.doctorLabel')} value={doctorName} /> : null}
        {appointment.notes ? (
          <ReadOnlyRow label={t('appointments.fields.notes')} value={appointment.notes} />
        ) : null}
      </FigmaFormCard>

      <StatusSection circleId={circleId} appointment={appointment} canManage={false} />
    </FigmaFormScreen>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function StatusSection({
  circleId,
  appointment,
  canManage,
}: {
  circleId: string;
  appointment: CareAppointment;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setStatus = useSetAppointmentStatus(circleId);
  const [pending, setPending] = useState(false);

  async function run(status: AppointmentStatus) {
    setPending(true);
    try {
      await setStatus.mutateAsync({ id: appointment.id, status });
    } finally {
      setPending(false);
    }
  }

  return (
    <FigmaFormCard>
      <View style={styles.statusHeader}>
        <Text style={[styles.statusLabel, { color: theme.text }]}>{t('appointments.fields.status')}</Text>
        <StatusBadge
          tone={STATUS_TONE[appointment.status]}
          glyph={STATUS_GLYPH[appointment.status]}
          label={t(`appointments.status.${appointment.status}`)}
        />
      </View>

      {canManage ? (
        appointment.status === 'scheduled' ? (
          <View style={styles.actionRow}>
            <View style={styles.actionCol}>
              <FigmaButton
                label={t('appointments.markCompleted')}
                loading={pending}
                disabled={pending}
                onPress={() => run('completed')}
              />
            </View>
            <View style={styles.actionCol}>
              <FigmaButton
                label={t('appointments.markCancelled')}
                variant="secondary"
                disabled={pending}
                onPress={() => run('cancelled')}
              />
            </View>
          </View>
        ) : (
          <FigmaButton
            label={t('appointments.reopen')}
            variant="secondary"
            loading={pending}
            disabled={pending}
            onPress={() => run('scheduled')}
          />
        )
      ) : null}
    </FigmaFormCard>
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
    <FigmaFormCard>
      {confirming ? (
        <View style={styles.actionRow}>
          <View style={styles.actionCol}>
            <FigmaButton
              label={t('common.confirmDelete')}
              variant="danger"
              loading={pending}
              onPress={onDelete}
            />
          </View>
          <View style={styles.actionCol}>
            <FigmaButton
              label={t('common.cancel')}
              variant="secondary"
              disabled={pending}
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : (
        <FigmaButton
          label={t('appointments.deleteAppointment')}
          variant="danger"
          onPress={() => setConfirming(true)}
        />
      )}
    </FigmaFormCard>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  footer: { gap: Spacing.two },
  statusText: { fontSize: 13, fontFamily: FigmaFont.semibold, textAlign: 'center' },
  title: { fontSize: 18, fontFamily: FigmaFont.bold },
  row: { gap: 2 },
  rowLabel: { fontSize: 13, fontFamily: FigmaFont.semibold },
  rowValue: { fontSize: 16, fontFamily: FigmaFont.regular },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusLabel: { fontSize: 14, fontFamily: FigmaFont.semibold },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  actionCol: { flex: 1 },
});
