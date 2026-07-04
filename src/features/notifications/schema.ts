import type { NotificationPreferencesInput } from './api';

/** Strict 24-hour HH:MM (matches the medication schedule time format). */
export const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidHm(value: string): boolean {
  return HM_RE.test(value);
}

/** The boolean preference fields, in display order. */
export type BooleanPreferenceKey =
  | 'medicationReminders'
  | 'missedDoseAlerts'
  | 'taskReminders'
  | 'appointmentReminders'
  | 'visitReminders'
  | 'visitUpdates'
  | 'careUpdates'
  | 'emergencyAlerts'
  | 'remoteSummary';

export type PreferenceToggle = {
  key: BooleanPreferenceKey;
  labelKey: string;
  descriptionKey: string;
};

/**
 * Drives the per-circle toggle list on the settings screen. Order groups the
 * day-to-day reminders first, then follow-up/summary controls.
 */
export const PREFERENCE_TOGGLES: PreferenceToggle[] = [
  {
    key: 'medicationReminders',
    labelKey: 'notificationSettings.toggles.medicationReminders.label',
    descriptionKey: 'notificationSettings.toggles.medicationReminders.description',
  },
  {
    key: 'missedDoseAlerts',
    labelKey: 'notificationSettings.toggles.missedDoseAlerts.label',
    descriptionKey: 'notificationSettings.toggles.missedDoseAlerts.description',
  },
  {
    key: 'taskReminders',
    labelKey: 'notificationSettings.toggles.taskReminders.label',
    descriptionKey: 'notificationSettings.toggles.taskReminders.description',
  },
  {
    key: 'appointmentReminders',
    labelKey: 'notificationSettings.toggles.appointmentReminders.label',
    descriptionKey: 'notificationSettings.toggles.appointmentReminders.description',
  },
  {
    // Phase 2F: gates the new `visit_upcoming` reminder, whose Edge producer already
    // exists, so this toggle is live now. The other 3 new preference columns
    // (assignment_alerts / activity_updates / available_to_claim_digest) stay in the
    // API input layer but are intentionally NOT shown here yet: their producers are
    // deferred, so a visible toggle would be a dead switch (see the 2F-5A audit).
    key: 'visitReminders',
    labelKey: 'notificationSettings.toggles.visitReminders.label',
    descriptionKey: 'notificationSettings.toggles.visitReminders.description',
  },
  {
    key: 'visitUpdates',
    labelKey: 'notificationSettings.toggles.visitUpdates.label',
    descriptionKey: 'notificationSettings.toggles.visitUpdates.description',
  },
  {
    key: 'careUpdates',
    labelKey: 'notificationSettings.toggles.careUpdates.label',
    descriptionKey: 'notificationSettings.toggles.careUpdates.description',
  },
  {
    key: 'emergencyAlerts',
    labelKey: 'notificationSettings.toggles.emergencyAlerts.label',
    descriptionKey: 'notificationSettings.toggles.emergencyAlerts.description',
  },
  {
    key: 'remoteSummary',
    labelKey: 'notificationSettings.toggles.remoteSummary.label',
    descriptionKey: 'notificationSettings.toggles.remoteSummary.description',
  },
];

/** Quiet hours need both bounds when enabled (mirrors the DB CHECK + RPC guard). */
export function quietHoursValid(input: NotificationPreferencesInput): boolean {
  if (!input.quietHoursEnabled) return true;
  return (
    !!input.quietHoursStart &&
    !!input.quietHoursEnd &&
    isValidHm(input.quietHoursStart) &&
    isValidHm(input.quietHoursEnd)
  );
}
