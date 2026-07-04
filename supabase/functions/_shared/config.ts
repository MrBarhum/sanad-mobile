// Centralized tuning for the reminder/notification engine. Every magic number
// lives here (no values scattered across the functions) so cadence, grace
// periods, and crash-recovery timeouts are reviewed in one place. Times are
// minutes unless the field name says otherwise.

export const REMINDER_CONFIG = {
  // How far ahead each run looks for due medication doses / tasks. Keep this >=
  // the scheduled run cadence so a dose is never skipped between runs.
  medicationLookaheadMinutes: 20,
  taskLookaheadMinutes: 20,

  // Overdue-task escalation: an OPEN task whose due time passed by this grace — but
  // not older than the max-age backstop — raises one `task_overdue` reminder to its
  // assigned owner (unassigned → nobody, per the responsibility resolver).
  taskOverdueGraceMinutes: 60,
  taskOverdueMaxAgeHours: 24,

  // Missed-dose escalation: a scheduled dose with no log this long after its time
  // raises a single neutral "not recorded" alert.
  missedDoseGraceMinutes: 60,
  // Don't backfill history: ignore doses whose time is older than this.
  missedDoseMaxAgeMinutes: 12 * 60,
  // Tier-2 manager escalation for a still-unrecorded dose of an ASSIGNED medication:
  // total minutes after the scheduled dose time before the circle's managers are
  // notified (data.tier='manager'). Must be > missedDoseGraceMinutes (the owner tier)
  // and <= missedDoseMaxAgeMinutes (still within the follow-up window). 120 = managers
  // 60 min after the owner tier.
  missedDoseManagerEscalationMinutes: 120,

  // Appointment reminder lead times (minutes before start); each dedupes alone.
  appointmentLeadMinutes: [24 * 60, 60],
  appointmentLookaheadMinutes: 20,

  // Visit reminders: a single conservative lead before a PLANNED family visit. A
  // date-only visit (no start_time) reminds at visitDateOnlyReminderHour circle-
  // local, mirroring date-only tasks.
  visitLeadMinutes: 60,
  visitLookaheadMinutes: 20,
  visitDateOnlyReminderHour: 9,

  // A task reminder expires this long after its due time (it also stays gated on
  // the task remaining `open` by source-validity). Appointment reminders expire at
  // the appointment start; medication-due at the missed-dose grace boundary;
  // medication-missed at the max-age backstop.
  taskReminderExpiryHours: 6,

  // Fan-out (logical outbox → per-device deliveries). Atomic in SQL.
  fanoutBatchSize: 200,
  fanoutMaxAttempts: 5,

  // Per-device push delivery (the external Expo send).
  deliveryBatchSize: 200,
  deliveryMaxAttempts: 5,
  // A 'processing' delivery whose lock is older than this is treated as a crashed
  // worker and reclaimed (crash recovery).
  deliveryLockTimeoutSeconds: 600,
  // Bounded backoff for transient send failures: retry_at = now + base * attempt.
  deliveryBackoffBaseSeconds: 120,

  // Expo limits a single push request to 100 messages.
  expoPushBatchSize: 100,
  expoReceiptBatchSize: 300,
  // Receipts settle minutes after send: don't poll a ticket younger than this, and
  // poll oldest-first so a steady stream of new tickets can't starve old ones.
  receiptMinAgeMinutes: 15,
  // Expo retains receipts ~24h. Past this, stop polling and mark 'unchecked'.
  receiptRetentionHours: 24,
  receiptRetentionSweepLimit: 500,

  // Safety caps on rows scanned per run.
  maxSchedulesPerRun: 2000,
  maxTasksPerRun: 2000,
  maxAppointmentsPerRun: 2000,
  maxVisitsPerRun: 2000,
  maxCirclesPerRun: 2000,
};
