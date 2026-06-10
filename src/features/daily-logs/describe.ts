import type { useTranslation } from 'react-i18next';

import type { DailyCareLog } from './api';

type TFn = ReturnType<typeof useTranslation>['t'];

export type LogDetail = { key: string; label: string; value: string };

/** The recorded structured observations of a log, as label/value rows (skips unset). */
export function describeDailyLog(log: DailyCareLog, t: TFn): LogDetail[] {
  const out: LogDetail[] = [];
  if (log.mood) {
    out.push({ key: 'mood', label: t('dailyLogs.fields.mood'), value: t(`dailyLogs.mood.${log.mood}`) });
  }
  if (log.sleep_quality) {
    out.push({
      key: 'sleep',
      label: t('dailyLogs.fields.sleepQuality'),
      value: t(`dailyLogs.sleepQuality.${log.sleep_quality}`),
    });
  }
  if (log.appetite) {
    out.push({
      key: 'appetite',
      label: t('dailyLogs.fields.appetite'),
      value: t(`dailyLogs.appetite.${log.appetite}`),
    });
  }
  if (log.hydration) {
    out.push({
      key: 'hydration',
      label: t('dailyLogs.fields.hydration'),
      value: t(`dailyLogs.hydration.${log.hydration}`),
    });
  }
  if (log.pain_level !== null) {
    out.push({
      key: 'pain',
      label: t('dailyLogs.fields.painLevel'),
      value: t('dailyLogs.painValue', { value: log.pain_level }),
    });
  }
  if (log.mobility) {
    out.push({
      key: 'mobility',
      label: t('dailyLogs.fields.mobility'),
      value: t(`dailyLogs.mobility.${log.mobility}`),
    });
  }
  return out;
}

/** The free-text notes of a log, as label/value rows (skips empty). */
export function describeDailyLogNotes(log: DailyCareLog, t: TFn): LogDetail[] {
  const out: LogDetail[] = [];
  if (log.bathroom_notes) {
    out.push({ key: 'bathroom', label: t('dailyLogs.fields.bathroomNotes'), value: log.bathroom_notes });
  }
  if (log.food_notes) {
    out.push({ key: 'food', label: t('dailyLogs.fields.foodNotes'), value: log.food_notes });
  }
  if (log.activity_notes) {
    out.push({ key: 'activity', label: t('dailyLogs.fields.activityNotes'), value: log.activity_notes });
  }
  if (log.general_notes) {
    out.push({ key: 'general', label: t('dailyLogs.fields.generalNotes'), value: log.general_notes });
  }
  return out;
}
