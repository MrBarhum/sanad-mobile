import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { fieldErrors } from '@/utils/form';

import type { FamilyVisit } from './api';
import { visitSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Editable visit draft kept as form-friendly strings. */
export type VisitDraft = {
  visitorName: string;
  visitDate: string;
  startTime: string;
  endTime: string;
  notes: string;
};

export function defaultVisitDraft(): VisitDraft {
  return { visitorName: '', visitDate: '', startTime: '', endTime: '', notes: '' };
}

export function visitDraftFromRow(row: FamilyVisit): VisitDraft {
  return {
    visitorName: row.visitor_name,
    visitDate: row.visit_date,
    startTime: row.start_time ? row.start_time.slice(0, 5) : '',
    endTime: row.end_time ? row.end_time.slice(0, 5) : '',
    notes: row.notes ?? '',
  };
}

/** The validated, persistable subset of a visit (visitor account is contextual). */
export type VisitFieldsValue = {
  visitor_name: string;
  visit_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

type PreparedVisit =
  | { ok: true; value: VisitFieldsValue }
  | { ok: false; errors: Partial<Record<string, string>> };

export function prepareVisit(draft: VisitDraft): PreparedVisit {
  const parsed = visitSchema.safeParse({
    visitor_name: draft.visitorName,
    visit_date: draft.visitDate,
    start_time: draft.startTime,
    end_time: draft.endTime,
    notes: draft.notes,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  return {
    ok: true,
    value: {
      visitor_name: parsed.data.visitor_name,
      visit_date: parsed.data.visit_date,
      start_time: parsed.data.start_time === '' ? null : parsed.data.start_time,
      end_time: parsed.data.end_time === '' ? null : parsed.data.end_time,
      notes: nullify(parsed.data.notes),
    },
  };
}

/** Controlled inputs for a visit, shared by the create + edit screens. */
export function VisitFieldset({
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
    <View style={styles.fields}>
      <FormField
        label={t('visits.fields.visitorName')}
        value={draft.visitorName}
        onChangeText={(value) => onChange({ visitorName: value })}
        placeholder={t('visits.placeholders.visitorName')}
        error={fieldError(errors.visitor_name)}
      />
      <DateField
        label={t('visits.fields.visitDate')}
        value={draft.visitDate}
        onChange={(value) => onChange({ visitDate: value })}
        error={fieldError(errors.visit_date)}
      />
      <TimeField
        label={t('visits.fields.startTime')}
        value={draft.startTime}
        onChange={(value) => onChange({ startTime: value })}
        clearable
        error={fieldError(errors.start_time)}
      />
      <TimeField
        label={t('visits.fields.endTime')}
        value={draft.endTime}
        onChange={(value) => onChange({ endTime: value })}
        clearable
        error={fieldError(errors.end_time)}
      />
      <FormField
        label={t('visits.fields.notes')}
        value={draft.notes}
        onChangeText={(value) => onChange({ notes: value })}
        placeholder={t('visits.placeholders.notes')}
        multiline
        error={fieldError(errors.notes)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.three },
});
