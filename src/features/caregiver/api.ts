import type { Database } from '@/types/supabase';

import { supabase } from '../../../lib/supabase';

export type MedicationLogStatus = Database['public']['Enums']['medication_log_status'];

/**
 * The PRIVATE storage bucket that holds dose-proof photos (Milestone 7 · A5,
 * already applied in production). Private is load-bearing: a dose photo is
 * medical-adjacent, so reads go through a short-lived `createSignedUrl()` and
 * NEVER `getPublicUrl()`.
 */
export const DOSE_PROOF_BUCKET = 'dose-proof';

/** Signed-URL lifetime for a proof read (seconds). Short by design. */
const PROOF_URL_TTL_SECONDS = 600;

export const caregiverKeys = {
  all: ['caregiver'] as const,
  /** One signed URL per stored object path. */
  doseProof: (objectPath: string | null | undefined) =>
    ['caregiver', 'dose-proof', objectPath ?? null] as const,
};

/** A photo picked on the device but not yet uploaded. */
export type DosePhoto = {
  /** Local file URI — for the on-device preview only, never persisted. */
  uri: string;
  /** Raw base64 payload (no data: prefix), as returned by the picker. */
  base64: string;
  /** One of the bucket's allowed types: image/jpeg · image/png · image/webp. */
  mimeType: string;
};

export type RecordDoseInput = {
  circleId: string;
  medicationId: string;
  scheduleId: string | null;
  doseDate: string;
  scheduledTime: string;
  status: MedicationLogStatus;
  recordedBy: string | null;
  /** Set when the dose already has a log row (a correction, not a first record). */
  existingLogId: string | null;
};

/**
 * Records one dose AND RETURNS ITS LOG ID.
 *
 * The id is load-bearing and is why this does not reuse `insertLog()` from the
 * medications feature (which returns void): a proof object must live at exactly
 * `<circle_id>/<medication_id>/<log_id>.<ext>`, and a CHECK constraint on
 * `medication_logs` refuses any `proof_object_path` that does not match the row's
 * own ids. So the only possible order is: INSERT the log → read back its id →
 * upload at that path → UPDATE the row's `proof_object_path`.
 */
export async function recordDose(input: RecordDoseInput): Promise<string> {
  if (input.existingLogId) {
    const { data, error } = await supabase
      .from('medication_logs')
      .update({
        status: input.status,
        recorded_by: input.recordedBy,
        recorded_at: new Date().toISOString(),
      })
      .eq('id', input.existingLogId)
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase
    .from('medication_logs')
    .insert({
      circle_id: input.circleId,
      medication_id: input.medicationId,
      schedule_id: input.scheduleId,
      dose_date: input.doseDate,
      scheduled_time: input.scheduledTime,
      status: input.status,
      recorded_by: input.recordedBy,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Mime → the file extension the bucket + storage policies allow. */
export function extensionForMime(mimeType: string): 'jpg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * The ONE object-path convention (see the A5 migration). Any other shape is
 * rejected by `medication_logs_proof_object_path_scoped` and by the storage
 * policies, which read circle_id from segment 1 and medication_id from segment 2.
 */
export function doseProofObjectPath(params: {
  circleId: string;
  medicationId: string;
  logId: string;
  extension: string;
}): string {
  return `${params.circleId}/${params.medicationId}/${params.logId}.${params.extension}`;
}

/**
 * Decodes a base64 payload to bytes without pulling in a dependency (the
 * milestone forbids new packages, and Hermes ships no `atob`/`Buffer`). Throws
 * on malformed input so the caller surfaces an upload failure rather than
 * writing a corrupt object.
 */
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/[\r\n\s]/g, '').replace(/=+$/, '');
  const length = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(length);
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const index = B64_ALPHABET.indexOf(clean[i]);
    if (index < 0) throw new Error('dose-proof: malformed base64 payload');
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out] = (buffer >> bits) & 0xff;
      out += 1;
    }
  }
  return bytes;
}

/** Uploads (or replaces) the proof object. `upsert` covers a re-photograph. */
export async function uploadDoseProof(params: {
  objectPath: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<void> {
  const { error } = await supabase.storage
    .from(DOSE_PROOF_BUCKET)
    .upload(params.objectPath, params.bytes, {
      contentType: params.contentType,
      upsert: true,
    });
  if (error) throw error;
}

/** Points a dose log at its proof object (or clears it). */
export async function setDoseProofPath(logId: string, objectPath: string | null): Promise<void> {
  const { error } = await supabase
    .from('medication_logs')
    .update({ proof_object_path: objectPath })
    .eq('id', logId);
  if (error) throw error;
}

/**
 * A short-lived signed URL for a stored proof. The bucket is private, so this is
 * the only read path — the URL is never persisted anywhere.
 */
export async function createDoseProofSignedUrl(objectPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOSE_PROOF_BUCKET)
    .createSignedUrl(objectPath, PROOF_URL_TTL_SECONDS);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('dose-proof: no signed url returned');
  return data.signedUrl;
}
