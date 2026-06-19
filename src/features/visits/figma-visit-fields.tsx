import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { FigmaFieldLabel, FigmaFormField } from '@/components/figma/figma-form-screen';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';

import type { VisitDraft } from './visit-fields';

/**
 * Figma-faithful visit fields (visitor name, date, optional start/end times,
 * notes) — a fragment (no card) so the form can wrap them in one card together
 * with the RLS-correct self-link control. Start/end times stay OPTIONAL as in the
 * real app. Date/time use the protected wheel pickers.
 */
export function FigmaVisitFields({
  draft,
  onChange,
  errors,
}: {
  draft: VisitDraft;
  onChange: (patch: Partial<VisitDraft>) => void;
  errors: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation();

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'visitorName':
        return t('visits.errors.visitorName');
      case 'visitDate':
        return t('visits.errors.visitDate');
      case 'startTime':
        return t('visits.errors.startTime');
      case 'endTime':
        return t('visits.errors.endTime');
      case 'endBeforeStart':
        return t('visits.errors.endBeforeStart');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  return (
    <>
      <FigmaFormField
        label={t('visits.fields.visitorName')}
        value={draft.visitorName}
        onChangeText={(value) => onChange({ visitorName: value })}
        placeholder={t('visits.placeholders.visitorName')}
        required
        error={fieldError(errors.visitor_name)}
      />

      <View style={styles.field}>
        <FigmaFieldLabel label={t('visits.fields.visitDate')} required />
        <DateField
          value={draft.visitDate}
          onChange={(value) => onChange({ visitDate: value })}
          accessibilityLabel={t('visits.fields.visitDate')}
          error={fieldError(errors.visit_date)}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <FigmaFieldLabel label={t('visits.fields.startTime')} />
          <TimeField
            value={draft.startTime}
            onChange={(value) => onChange({ startTime: value })}
            clearable
            accessibilityLabel={t('visits.fields.startTime')}
            error={fieldError(errors.start_time)}
          />
        </View>
        <View style={styles.col}>
          <FigmaFieldLabel label={t('visits.fields.endTime')} />
          <TimeField
            value={draft.endTime}
            onChange={(value) => onChange({ endTime: value })}
            clearable
            accessibilityLabel={t('visits.fields.endTime')}
            error={fieldError(errors.end_time)}
          />
        </View>
      </View>

      <FigmaFormField
        label={t('visits.fields.notes')}
        value={draft.notes}
        onChangeText={(value) => onChange({ notes: value })}
        placeholder={t('visits.placeholders.notes')}
        multiline
        error={fieldError(errors.notes)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three },
  col: { flex: 1, gap: Spacing.two },
});
