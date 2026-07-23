import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormScreen, FigmaMutedNote } from '@/components/figma/figma-form-screen';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme';
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
 * (FigmaFormScreen header + grouped Surface cards + body-rendered teal save CTA),
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
  // Only managers edit visit details, relink, or delete. A linked visitor may
  // record the outcome (completed/cancelled) only — matching the server's
  // status-only trigger and manager-only delete introduced in Phase 2E-1.
  const canMarkOutcome = canCollaborate && isOwner;

  return (
    <>
      {/* The Figma editor draws its own header; hide the native one. */}
      <Stack.Screen options={{ headerShown: false }} />
      {canManage ? (
        <VisitEditScreen
          key={visit.data.id}
          circleId={circleId}
          initial={visit.data}
          canManage={canManage}
        />
      ) : (
        <VisitViewScreen circleId={circleId} visit={visit.data} canMarkOutcome={canMarkOutcome} />
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
    <FigmaFormScreen
      title={t('visits.detailTitle')}
      subtitle={t('visits.managerEditSubtitle')}
      onBack={() => router.back()}
      disclaimer={t('visits.disclaimer')}>
      <UnsavedChangesGuard when={dirty} />

      <Surface tone="card" radius={Radius.lg} padded={16} gap={16}>
        <FigmaVisitFields draft={draft} onChange={patch} errors={errors} />
        {canManage ? (
          <View>
            <View style={[styles.divider, { backgroundColor: theme.backgroundSunken }]} />
            <MemberSelect
              circleId={circleId}
              value={linkedUserId}
              label={t('visits.fields.linkToMember')}
              onChange={relink}
            />
          </View>
        ) : null}
      </Surface>

      <StatusSection circleId={circleId} visit={initial} canMarkOutcome canReopen />

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
  canMarkOutcome,
}: {
  circleId: string;
  visit: FamilyVisit;
  canMarkOutcome: boolean;
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
      <FigmaMutedNote>{t(canMarkOutcome ? 'visits.statusOnly' : 'visits.readOnly')}</FigmaMutedNote>

      <Surface tone="card" radius={Radius.lg} padded={16} gap={16}>
        <Text style={[styles.title, { color: theme.text }]}>{visit.visitor_name}</Text>
        <ReadOnlyRow label={t('visits.whenLabel')} value={when} />
        {responsible ? (
          <ReadOnlyRow label={t('visits.linkedToLabel')} value={responsible.label} />
        ) : null}
        {visit.notes ? <ReadOnlyRow label={t('visits.fields.notes')} value={visit.notes} /> : null}
      </Surface>

      <StatusSection circleId={circleId} visit={visit} canMarkOutcome={canMarkOutcome} canReopen={false} />
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

/**
 * Status card. `canMarkOutcome` (a manager, or the linked visitor) may move a
 * planned visit to completed/cancelled — a plain status write the server's
 * status-only trigger permits for the linked visitor. `canReopen` (managers only)
 * may move a closed visit back to planned; a linked visitor cannot reopen.
 */
function StatusSection({
  circleId,
  visit,
  canMarkOutcome,
  canReopen,
}: {
  circleId: string;
  visit: FamilyVisit;
  canMarkOutcome: boolean;
  canReopen: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setVisitStatus = useSetVisitStatus(circleId);
  const [pending, setPending] = useState(false);
  // Two-step confirm on the outcome (a stray tap must not irreversibly close a
  // visit); reopening is already an explicit, reversible manager action.
  const [confirm, setConfirm] = useState<'completed' | 'cancelled' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(status: VisitStatus) {
    setPending(true);
    setError(null);
    try {
      await setVisitStatus.mutateAsync({ id: visit.id, status });
      setConfirm(null);
    } catch {
      setError(t('visits.saveFailed'));
    } finally {
      setPending(false);
    }
  }

  const showOutcome = canMarkOutcome && visit.status === 'planned';
  const showReopen = canReopen && visit.status !== 'planned';

  return (
    <Surface tone="card" radius={Radius.lg} padded={16} gap={16}>
      <View style={styles.statusHeader}>
        <Text style={[styles.statusLabel, { color: theme.text }]}>{t('visits.fields.status')}</Text>
        <StatusBadge
          tone={STATUS_TONE[visit.status]}
          glyph={STATUS_GLYPH[visit.status]}
          label={t(`visits.status.${visit.status}`)}
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
                  ? 'visits.confirmCompletedBody'
                  : 'visits.confirmCancelledBody',
              )}
            </Text>
            {/* Complete = the proven body-rendered CTA (Button variant="primary"
                renders dark in this nested form); could-not = red danger. */}
            {confirm === 'completed' ? (
              <FigmaFooterPrimaryButton
                label={t('visits.markCompleted')}
                onPress={() => run(confirm)}
                loading={pending}
              />
            ) : (
              <Button
                label={t('visits.markCancelled')}
                variant="danger"
                loading={pending}
                onPress={() => run(confirm)}
              />
            )}
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={pending}
              onPress={() => setConfirm(null)}
            />
          </View>
        ) : (
          <View style={styles.statusActionsRow}>
            <View style={styles.actionCol}>
              <FigmaFooterPrimaryButton
                label={t('visits.markCompleted')}
                onPress={() => setConfirm('completed')}
              />
            </View>
            <View style={styles.actionCol}>
              <Button
                label={t('visits.markCancelled')}
                variant="secondary"
                onPress={() => setConfirm('cancelled')}
              />
            </View>
          </View>
        )
      ) : showReopen ? (
        <Button
          label={t('visits.reopen')}
          variant="secondary"
          loading={pending}
          disabled={pending}
          onPress={() => run('planned')}
        />
      ) : null}
    </Surface>
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

  // Flat single-affordance delete (frame 10g): the danger button IS the bordered
  // element — no outer card. The two-step confirm swaps it for a confirm/cancel row.
  return confirming ? (
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
    <Button label={t('visits.deleteVisit')} variant="danger" iconName="delete" onPress={() => setConfirming(true)} />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  // In-card separator before «ربط بعضو» — the frame draws a 2px `sunken` rule (a
  // softer in-card break than a border-colored line), not a hairline.
  divider: { height: BorderWidth.standard, marginTop: Spacing.half, marginBottom: 12 },
  footer: { gap: Spacing.two },
  statusText: { fontSize: 14, fontFamily: FontFamily.semibold, textAlign: 'center' },
  title: { fontSize: 18, fontFamily: FontFamily.bold },
  row: { gap: 2 },
  rowLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  rowValue: { fontSize: 16, fontFamily: FontFamily.regular },
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
  // Frame 10g outcome pair: «تمت الزيارة» + «تعذّرت الزيارة» sit side by side.
  statusActionsRow: { flexDirection: 'row', gap: Spacing.two },
  confirmStack: { gap: Spacing.two },
  confirmBody: { fontSize: 14, fontFamily: FontFamily.regular, lineHeight: 21 },
});
