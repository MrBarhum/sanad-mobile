import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { isolateLtr } from '@/components/ltr-text';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import type { DoseItem } from '@/features/medications/today';
import { useTheme } from '@/hooks/use-theme';
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

      {uploadFailed ? null : (
        <DosePhotoField photo={photo} onChange={setPhoto} disabled={pending} />
      )}

      {attach.isPending ? (
        <Text style={[styles.progress, { color: c.textSecondary }]} accessibilityLiveRegion="polite">
          {t('caregiver.photo.uploading')}
        </Text>
      ) : null}

      {uploadFailed ? (
        <>
          <Button
            label={t('caregiver.photo.retry')}
            loading={attach.isPending}
            disabled={pending}
            onPress={() => void onRetryUpload()}
          />
          <Button
            label={t('common.close')}
            variant="secondary"
            disabled={pending}
            onPress={onClose}
          />
        </>
      ) : (
        <>
          <Button
            label={t('caregiver.today.give')}
            loading={pending}
            disabled={pending}
            onPress={() => void onSubmit()}
          />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            disabled={pending}
            onPress={onClose}
          />
        </>
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
});
