import { Image } from 'expo-image';
import { Camera, Info, ImageOff, RefreshCw, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { DosePhoto } from './api';
import { useDoseProofUrl } from './hooks';

// ---------------------------------------------------------------------------
// The guarded picker
// ---------------------------------------------------------------------------

type PickerAsset = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
};
type PickerResult = { canceled: boolean; assets?: PickerAsset[] | null };
type PickerModule = {
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchCameraAsync: (options: Record<string, unknown>) => Promise<PickerResult>;
};

let cachedPicker: PickerModule | null | undefined;

/**
 * `expo-image-picker` is NOT a dependency of this project. The milestone forbids
 * new native dependencies, so nothing here declares it in package.json or
 * app.json, and photo capture is therefore INERT in every build shipped today —
 * `isDosePhotoCaptureAvailable()` returns false and the field renders the calm
 * `caregiver.photo.unavailable` note instead of a camera button.
 *
 * This require sits alone inside a `try` block on purpose: Metro treats a require
 * in that exact position as an OPTIONAL dependency (`allowOptionalDependencies`,
 * on by default in @expo/metro-config), so the bundle builds with the package
 * absent and the module simply throws at runtime — which lands here as `null`.
 * Everything else on the screen keeps working.
 *
 * To LIGHT IT UP, the maintainer runs `npx expo install expo-image-picker` (which
 * updates package-lock.json), adds `"expo-image-picker"` to app.json `plugins`,
 * and makes a new EAS build. Adding either half without the other breaks the
 * repo: package.json without the lockfile fails `npm ci`, and the app.json plugin
 * without the installed module fails `expo config` / `expo prebuild` / `eas build`.
 */
function loadPicker(): PickerModule | null {
  if (cachedPicker !== undefined) return cachedPicker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-image-picker') as Partial<PickerModule>;
    cachedPicker =
      typeof mod?.launchCameraAsync === 'function' &&
      typeof mod?.requestCameraPermissionsAsync === 'function'
        ? (mod as PickerModule)
        : null;
  } catch {
    cachedPicker = null;
  }
  return cachedPicker;
}

/** True when this build can actually open the camera. */
export function isDosePhotoCaptureAvailable(): boolean {
  return loadPicker() !== null;
}

export type CaptureOutcome =
  | { kind: 'photo'; photo: DosePhoto }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'denied' }
  | { kind: 'failed' };

/** Only the three types the private bucket accepts. */
function normalizeMime(value: string | null | undefined): string {
  if (value === 'image/png' || value === 'image/webp') return value;
  return 'image/jpeg';
}

/**
 * Opens the camera and returns a base64 photo, never throwing — every failure
 * mode is a value the caller renders as calm copy.
 */
export async function captureDosePhoto(): Promise<CaptureOutcome> {
  const picker = loadPicker();
  if (!picker) return { kind: 'unavailable' };
  try {
    const permission = await picker.requestCameraPermissionsAsync();
    if (!permission?.granted) return { kind: 'denied' };
    const result = await picker.launchCameraAsync({
      // Compressed on the way out — the bucket caps an object at 2 MiB.
      quality: 0.5,
      base64: true,
      allowsEditing: false,
      exif: false,
    });
    if (result?.canceled) return { kind: 'cancelled' };
    const asset = result?.assets?.[0];
    if (!asset?.base64) return { kind: 'failed' };
    return {
      kind: 'photo',
      photo: { uri: asset.uri, base64: asset.base64, mimeType: normalizeMime(asset.mimeType) },
    };
  } catch {
    return { kind: 'failed' };
  }
}

// ---------------------------------------------------------------------------
// The capture field (inside the dose record sheet)
// ---------------------------------------------------------------------------

/**
 * The optional photo affordance on the dose record sheet. The framing is the
 * point: this is HER record that the dose was given (`caregiver.photo.purpose`),
 * never evidence collected for anyone else — so it is always optional, nothing
 * leaves the device until she saves, and an unavailable camera reads as a calm
 * note rather than an error.
 */
export function DosePhotoField({
  photo,
  onChange,
  disabled = false,
}: {
  photo: DosePhoto | null;
  onChange: (photo: DosePhoto | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const available = isDosePhotoCaptureAvailable();

  async function onCapture() {
    setNotice(null);
    const outcome = await captureDosePhoto();
    if (outcome.kind === 'photo') onChange(outcome.photo);
    else if (outcome.kind === 'denied') setNotice(t('caregiver.photo.permissionDenied'));
    else if (outcome.kind === 'failed') setNotice(t('caregiver.photo.captureFailed'));
    else if (outcome.kind === 'unavailable') setNotice(t('caregiver.photo.unavailable'));
  }

  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={[styles.fieldTitle, { color: c.text }]}>{t('caregiver.photo.addLabel')}</Text>
        <View style={[styles.optionalPill, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}>
          <Text style={[styles.optionalText, { color: c.textSecondary }]}>
            {t('caregiver.photo.optional')}
          </Text>
        </View>
      </View>
      <Text style={[styles.fieldPurpose, { color: c.textSecondary }]}>
        {t('caregiver.photo.purpose')}
      </Text>

      {!available ? (
        <View
          style={[styles.note, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}
          accessibilityRole="text">
          <Info size={16} color={c.textSecondary} strokeWidth={2.2} />
          <Text style={[styles.noteText, { color: c.textSecondary }]}>
            {t('caregiver.photo.unavailable')}
          </Text>
        </View>
      ) : photo ? (
        <View style={styles.preview}>
          <Image
            source={{ uri: photo.uri }}
            style={[styles.previewImage, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}
            contentFit="cover"
            accessibilityLabel={t('caregiver.proof.photoLabel')}
          />
          <View style={styles.previewActions}>
            <Pressable
              onPress={() => void onCapture()}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t('caregiver.photo.replace')}
              android_ripple={{ color: c.backgroundSelected }}
              style={[styles.smallAction, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
              <RefreshCw size={16} color={c.primaryText} strokeWidth={2.2} />
              <Text style={[styles.smallActionText, { color: c.text }]}>
                {t('caregiver.photo.replace')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onChange(null)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t('caregiver.photo.remove')}
              android_ripple={{ color: c.backgroundSelected }}
              style={[styles.smallAction, { borderColor: c.errorFg, backgroundColor: c.backgroundElement }]}>
              <X size={16} color={c.errorFg} strokeWidth={2.4} />
              <Text style={[styles.smallActionText, { color: c.errorFg }]}>
                {t('caregiver.photo.remove')}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.noteText, { color: c.textSecondary }]}>
            {t('caregiver.photo.sendOnSave')}
          </Text>
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => void onCapture()}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('caregiver.photo.addLabel')}
            accessibilityHint={t('caregiver.photo.sendOnSave')}
            android_ripple={{ color: c.backgroundSelected }}
            style={[styles.addButton, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
            <Camera size={20} color={c.primaryText} strokeWidth={2.2} />
            <Text style={[styles.addButtonText, { color: c.text }]}>
              {t('caregiver.photo.addLabel')}
            </Text>
          </Pressable>
          <Text style={[styles.noteText, { color: c.textSecondary }]}>
            {t('caregiver.photo.sendOnSave')}
          </Text>
        </>
      )}

      {notice ? (
        <Text
          style={[styles.notice, { color: c.errorFg }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The stored proof (family side — Unit D imports this)
// ---------------------------------------------------------------------------

/**
 * Renders a stored dose proof from a SIGNED url (the bucket is private), with
 * four honest states: absent, loading, loaded, failed. Props are deliberately
 * minimal and stable — `objectPath` is all a caller ever has.
 */
export function DoseProofImage({ objectPath }: { objectPath: string | null }) {
  const { t } = useTranslation();
  const c = useTheme();
  const query = useDoseProofUrl(objectPath);
  const [imageFailed, setImageFailed] = useState(false);

  if (!objectPath) {
    return (
      <View
        style={[styles.proofNote, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}
        accessibilityRole="text">
        <ImageOff size={16} color={c.textSecondary} strokeWidth={2.2} />
        <View style={styles.proofNoteText}>
          <Text style={[styles.proofNoteTitle, { color: c.text }]}>
            {t('caregiver.proof.noPhoto')}
          </Text>
          <Text style={[styles.noteText, { color: c.textSecondary }]}>
            {t('caregiver.proof.noPhotoHint')}
          </Text>
        </View>
      </View>
    );
  }

  if (query.isLoading) {
    return <Skeleton height={180} radius={Radius.card} />;
  }

  if (query.isError || !query.data || imageFailed) {
    return (
      <View
        style={[styles.proofNote, { borderColor: c.errorFg, backgroundColor: c.errorBg }]}
        accessibilityRole="text">
        <ImageOff size={16} color={c.errorFg} strokeWidth={2.2} />
        <Text style={[styles.noteText, { color: c.errorFg }]}>
          {t('caregiver.proof.loadError')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.proof}>
      <Image
        source={{ uri: query.data }}
        style={[styles.proofImage, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}
        contentFit="cover"
        onError={() => setImageFailed(true)}
        accessibilityLabel={t('caregiver.proof.photoLabel')}
      />
      <Text style={[styles.noteText, { color: c.textSecondary }]}>
        {t('caregiver.proof.ownerNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldTitle: { fontSize: 16, fontFamily: FontFamily.bold },
  optionalPill: {
    borderWidth: BorderWidth.thin,
    borderRadius: Radius.tiny,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  optionalText: { fontSize: 14, fontFamily: FontFamily.semibold },
  fieldPurpose: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
  },
  addButtonText: { fontSize: 16, fontFamily: FontFamily.bold },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  noteText: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 22 },
  notice: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 22 },
  preview: { gap: 8 },
  previewImage: {
    width: '100%',
    height: 160,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
  },
  previewActions: { flexDirection: 'row', gap: 8 },
  smallAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    paddingHorizontal: 12,
  },
  smallActionText: { fontSize: 14, fontFamily: FontFamily.bold },
  proof: { gap: 8 },
  proofImage: {
    width: '100%',
    height: 180,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
  },
  proofNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  proofNoteText: { flex: 1, gap: 2 },
  proofNoteTitle: { fontSize: 16, fontFamily: FontFamily.bold },
});
