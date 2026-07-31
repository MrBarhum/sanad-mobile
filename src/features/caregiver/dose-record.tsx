import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { isolateLtr } from '@/components/ltr-text';
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme';
import type { DoseItem } from '@/features/medications/today';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/utils/confirm';
import { formatHm } from '@/utils/date';

import type { DosePhoto } from './api';
import { DosePhotoField } from './dose-photo';
import { useAttachDoseProof, useRecordDose } from './hooks';

/**
 * The per-dose record sheet — the one place a hired caregiver turns a scheduled
 * dose into a record. It wears the canonical bottom-sheet chrome and IS the
 * sanctioned bottom-sheet confirm for the dose write: the row never mutates on a
 * stray tap.
 *
 * The dose that is being recorded is retained in a ref so the copy stays correct
 * while the sheet slides out after a close.
 */
export function DoseRecordSheet({
  circleId,
  date,
  dose,
  onClose,
}: {
  circleId: string;
  date: string;
  dose: DoseItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The last non-null dose is retained so the copy stays correct while the sheet
  // slides out (iOS keeps the modal mounted through the dismiss animation).
  // Adjusted during render — React's documented pattern for deriving state from
  // a prop, and cheaper than a cascading effect.
  const [shown, setShown] = useState<DoseItem | null>(dose);
  if (dose !== null && dose !== shown) setShown(dose);

  return (
    <FigmaBottomSheet
      visible={dose !== null}
      onClose={onClose}
      title={t('caregiver.today.recordTitle')}>
      {shown ? (
        // Keyed by the dose so opening a DIFFERENT dose starts from a clean
        // slate (no photo, no stale error) without an effect. Reopening the SAME
        // dose keeps its state on purpose: the only way back here is a failure,
        // and her already-taken photo should still be attached.
        <DoseRecordBody
          key={shown.key}
          circleId={circleId}
          date={date}
          dose={shown}
          onClose={onClose}
        />
      ) : null}
    </FigmaBottomSheet>
  );
}

/**
 * The sheet body. The two writes are deliberately separate and ordered: the dose
 * is saved FIRST and on its own, and only then is an optional photo uploaded and
 * linked (the proof object path must contain the log id, and a CHECK constraint
 * enforces it). If the upload then fails, this stays open and says plainly that
 * the DOSE was saved — a worker who believes her record was lost because a photo
 * failed would give the dose again, so that copy is a safety control.
 */
function DoseRecordBody({
  circleId,
  date,
  dose,
  onClose,
}: {
  circleId: string;
  date: string;
  dose: DoseItem;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const record = useRecordDose(circleId, date);
  const attach = useAttachDoseProof(circleId, date);

  const [photo, setPhoto] = useState<DosePhoto | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [savedLogId, setSavedLogId] = useState<string | null>(null);

  const pending = record.isPending || attach.isPending;

  /**
   * The dose is written; a photo is still waiting to be sent.
   *
   * The branch used to key off `uploadFailed`, which `onRetryUpload` clears
   * BEFORE the upload starts. React Query flips `isPending` back to false on
   * rejection in an earlier microtask than the `catch` that re-sets the flag, so
   * a render committed with `pending === false`, `uploadFailed === false` and a
   * saved log — and in that frame the sheet fell back to the dose-write branch:
   * an ENABLED «تسجيل الجرعة» over an already-recorded dose. Keying on the fact
   * instead of on the error flag means that, once the dose is saved, this sheet
   * can never present the dose write again.
   */
  const photoOutstanding = savedLogId !== null && photo !== null;

  async function uploadPhoto(logId: string, picked: DosePhoto) {
    try {
      await attach.mutateAsync({ logId, medicationId: dose.medicationId, photo: picked });
      onClose();
    } catch {
      // The DOSE is saved. Only the photo failed — say exactly that.
      setUploadFailed(true);
    }
  }

  async function onSubmit() {
    // Belt and braces with `photoOutstanding` above: a dose is recorded ONCE.
    // `recordDose` reads `existingLogId` from the dose PROP, which is still null
    // after our own save, so a second call here would INSERT a duplicate
    // `medication_logs` row rather than correcting the first — a duplicate
    // record implying a duplicate dose, which is the one thing this sheet's copy
    // exists to prevent.
    if (savedLogId) {
      await onRetryUpload();
      return;
    }
    setSaveError(null);
    setUploadFailed(false);
    let logId: string;
    try {
      logId = await record.mutateAsync({ dose, status: 'given' });
    } catch {
      setSaveError(t('caregiver.today.saveError'));
      return;
    }
    setSavedLogId(logId);
    if (!photo) {
      onClose();
      return;
    }
    await uploadPhoto(logId, photo);
  }

  async function onRetryUpload() {
    if (!savedLogId || !photo) return;
    setUploadFailed(false);
    await uploadPhoto(savedLogId, photo);
  }

  const detail = [dose.dosage, dose.instructions].filter(Boolean).join('  ·  ');

  return (
    <>
      <View style={[styles.summary, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
          {dose.medicationName}
        </Text>
        {detail ? <Text style={[styles.detail, { color: c.textSecondary }]}>{detail}</Text> : null}
        <View style={styles.timeRow}>
          <Clock size={16} color={c.primaryText} strokeWidth={2.2} />
          <Text style={[styles.time, { color: c.text }]}>
            {isolateLtr(formatHm(dose.scheduledTime))}
          </Text>
        </View>
      </View>

      {uploadFailed ? (
        <Text
          style={[styles.alert, { color: c.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {t('caregiver.photo.uploadFailed')}
        </Text>
      ) : null}

      {saveError ? (
        <Text
          style={[styles.alert, { color: c.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}

      {photoOutstanding ? null : (
        <DosePhotoField photo={photo} onChange={setPhoto} disabled={pending} />
      )}

      {attach.isPending ? (
        <Text style={[styles.progress, { color: c.textSecondary }]} accessibilityLiveRegion="polite">
          {t('caregiver.photo.uploading')}
        </Text>
      ) : null}

      {photoOutstanding ? (
        <View style={styles.actions}>
          <Button
            label={t('caregiver.photo.retry')}
            loading={attach.isPending}
            disabled={pending}
            onPress={() => void onRetryUpload()}
          />
          {/* The dose is saved, so «إغلاق» costs only the photo — but it costs it
              PERMANENTLY: the row is a status pill by now, so this sheet has no
              second entry point and nothing else can attach a proof to an
              existing log. Guarded with the sanctioned lightweight confirm (an OS
              alert, not a nested sheet). The drawn label is unchanged. */}
          <Button
            label={t('common.close')}
            variant="secondary"
            disabled={pending}
            onPress={() =>
              confirmAction(
                {
                  title: t('caregiver.photo.discardTitle'),
                  message: t('caregiver.photo.discardMessage'),
                  confirm: t('caregiver.photo.discardConfirm'),
                  cancel: t('common.cancel'),
                },
                onClose,
                { destructive: true },
              )
            }
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={t('caregiver.today.give')}
            loading={pending}
            disabled={pending}
            onPress={() => void onSubmit()}
          />
          {/* Nothing is at stake before the dose is written — a bare close. */}
          <Button
            label={t('common.cancel')}
            variant="secondary"
            disabled={pending}
            onPress={onClose}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  name: { fontSize: 18, fontFamily: FontFamily.bold, lineHeight: 28 },
  detail: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  time: { fontSize: 16, fontFamily: FontFamily.bold, writingDirection: 'ltr' },
  alert: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 22 },
  progress: { fontSize: 14, fontFamily: FontFamily.medium },
  // The action pair is one unit at 8, inside the sheet body's 16dp rhythm. Local
  // on purpose — the shared sheet's uniform gap backs every other sheet.
  actions: { gap: Spacing.two },
});
