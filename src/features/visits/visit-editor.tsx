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
import { MemberSelect, useMemberLookup } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';
import { formatHm } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { FigmaVisitFields } from './figma-visit-fields';
import { useDeleteVisit, useSetVisitStatus, useUpdateVisit, useVisit } from './hooks';
import { prepareVisit, visitDraftFromRow, type VisitDraft } from './visit-fields';

const STATUS_TONE: Record<VisitStatus, StatusTone> = {
  planned: 'info',
  completed: 'success',
  cancelled: 'error',
};

/** Visit status → badge glyph (planned reads as "upcoming"). */
const STATUS_GLYPH: Record<VisitStatus, string> = {
  planned: Glyph.clock,
  completed: Glyph.check,
  cancelled: Glyph.cross,
};

/**
 * View / edit a single family visit — rebuilt in the Figma editor language
 * (FigmaFormScreen header + grouped FigmaFormCards + body-rendered teal save CTA),
 * matching the Add-Visit form. Editors (managers, or collaborators on their own
 * visit) get the same FigmaVisitFields as /visits/new — including the optional
 * start/end times — plus a status card and a two-step delete; others get a
 * read-only layout. The account link (visitor_user_id) is preserved on save so RLS
 * (own-visit / manager) still holds; real hooks, validation, and permissions are
 * unchanged.
 */
export function VisitEditor({
  circleId,
  canManage,
  canCollaborate,
  visitId,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
  visitId: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const visit = useVisit(visitId);

  if (visit.isLoading) return <LoadingState />;
  if (visit.isError) {
    return (
      <ErrorState message={t('visits.loadError')} retryLabel={t('retry')} onRetry={() => visit.refetch()} />
    );
  }
  if (!visit.data) {
    return (
      <ThemedView style={styles.centered}>
        <EmptyState icon={Glyph.visit} title={t('visits.notFound')} />
      </ThemedView>
    );
  }

  const isOwner = visit.data.visitor_user_id !== null && visit.data.visitor_user_id === userId;
  const canEdit = canManage || (canCollaborate && isOwner);

  return (
    <>
      {/* The Figma editor draws its own header; hide the native one. */}
      <Stack.Screen options={{ headerShown: false }} />
      {canEdit ? (
        <VisitEditScreen
          key={visit.data.id}
          circleId={circleId}
          initial={visit.data}
          canManage={canManage}
        />
      ) : (
        <VisitViewScreen circleId={circleId} visit={visit.data} canAct={false} />
      )}
    </>
  );
}

function VisitEditScreen({
  circleId,
  initial,
  canManage,
}: {
  circleId: string;
  initial: FamilyVisit;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateVisit(circleId);

  const [draft, setDraft] = useState<VisitDraft>(() => visitDraftFromRow(initial));
  // Managers may relink the visit to any active doer member; collaborators keep
  // their own account link (seeded from the row, preserved on save).
  const [linkedUserId, setLinkedUserId] = useState(initial.visitor_user_id ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges({ draft, linkedUserId });
  const submitting = update.isPending;

  function patch(part: Partial<VisitDraft>) {
    setDraft((current) => ({ ...current, ...part }));
    if (status !== 'idle') setStatus('idle');
  }

  function relink(value: string) {
    setLinkedUserId(value);
    if (status !== 'idle') setStatus('idle');
  }

  async function onSubmit() {
    const prepared = prepareVisit(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) {
      setStatus('idle');
      return;
    }
    try {
      // Managers may relink to any active member; collaborators keep their own
      // link, so RLS (own-visit / manager) still holds either way.
      const visitorUserId = canManage
        ? linkedUserId === ''
          ? null
          : linkedUserId
        : initial.visitor_user_id;
      await update.mutateAsync({
        id: initial.id,
        patch: { ...prepared.value, visitor_user_id: visitorUserId },
      });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <FigmaFormScreen title={t('visits.detailTitle')} onBack={() => router.back()}>
      <UnsavedChangesGuard when={dirty} />
      <FigmaMutedNote>{t('visits.disclaimer')}</FigmaMutedNote>

      <FigmaFormCard>
        <FigmaVisitFields draft={draft} onChange={patch} errors={errors} />
        {canManage ? (
          <View>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <MemberSelect
              circleId={circleId}
              value={linkedUserId}
              label={t('visits.fields.linkToMember')}
              onChange={relink}
            />
          </View>
        ) : null}
      </FigmaFormCard>

      <StatusSection circleId={circleId} visit={initial} canAct />

      <DeleteVisitRow circleId={circleId} id={initial.id} />

      {/* Save CTA — rendered in the body (not the footer prop, which did not render
          on Android). Final block, below the status + destructive delete cards. */}
      <View style={styles.footer}>
        {status === 'saved' ? (
          <Text style={[styles.statusText, { color: theme.successFg }]} accessibilityLiveRegion="polite">
            {t('visits.saved')}
          </Text>
        ) : null}
        {status === 'error' ? (
          <Text style={[styles.statusText, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('visits.saveFailed')}
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

function VisitViewScreen({
  circleId,
  visit,
  canAct,
}: {
  circleId: string;
  visit: FamilyVisit;
  canAct: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const responsible = useMemberLookup(circleId)(visit.visitor_user_id);
  const timeParts = [];
  if (visit.start_time) timeParts.push(isolateLtr(formatHm(visit.start_time)));
  if (visit.end_time) timeParts.push(isolateLtr(formatHm(visit.end_time)));
  const when =
    timeParts.length > 0 ? `${visit.visit_date} ${timeParts.join(' – ')}` : visit.visit_date;

  return (
    <FigmaFormScreen title={t('visits.detailTitle')} onBack={() => router.back()}>
      <FigmaMutedNote>{t('visits.readOnly')}</FigmaMutedNote>

      <FigmaFormCard>
        <Text style={[styles.title, { color: theme.text }]}>{visit.visitor_name}</Text>
        <ReadOnlyRow label={t('visits.whenLabel')} value={when} />
        {responsible ? (
          <ReadOnlyRow label={t('visits.linkedToLabel')} value={responsible.label} />
        ) : null}
        {visit.notes ? <ReadOnlyRow label={t('visits.fields.notes')} value={visit.notes} /> : null}
      </FigmaFormCard>

      <StatusSection circleId={circleId} visit={visit} canAct={canAct} />
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
  visit,
  canAct,
}: {
  circleId: string;
  visit: FamilyVisit;
  canAct: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setStatus = useSetVisitStatus(circleId);
  const [pending, setPending] = useState(false);

  async function run(status: VisitStatus) {
    setPending(true);
    try {
      await setStatus.mutateAsync({ id: visit.id, status });
    } finally {
      setPending(false);
    }
  }

  return (
    <FigmaFormCard>
      <View style={styles.statusHeader}>
        <Text style={[styles.statusLabel, { color: theme.text }]}>{t('visits.fields.status')}</Text>
        <StatusBadge
          tone={STATUS_TONE[visit.status]}
          glyph={STATUS_GLYPH[visit.status]}
          label={t(`visits.status.${visit.status}`)}
        />
      </View>

      {canAct ? (
        visit.status === 'planned' ? (
          <View style={styles.actionRow}>
            <View style={styles.actionCol}>
              <FigmaButton
                label={t('visits.markCompleted')}
                loading={pending}
                disabled={pending}
                onPress={() => run('completed')}
              />
            </View>
            <View style={styles.actionCol}>
              <FigmaButton
                label={t('visits.markCancelled')}
                variant="secondary"
                disabled={pending}
                onPress={() => run('cancelled')}
              />
            </View>
          </View>
        ) : (
          <FigmaButton
            label={t('visits.reopen')}
            variant="secondary"
            loading={pending}
            disabled={pending}
            onPress={() => run('planned')}
          />
        )
      ) : null}
    </FigmaFormCard>
  );
}

function DeleteVisitRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteVisit(circleId);
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
          label={t('visits.deleteVisit')}
          variant="danger"
          onPress={() => setConfirming(true)}
        />
      )}
    </FigmaFormCard>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: Spacing.three },
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
