import { useRouter } from 'expo-router';
import {
  AlertCircle,
  AlertTriangle,
  Droplets,
  FileText,
  Heart,
  Pencil,
  Phone,
  Siren,
  Stethoscope,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Surface } from '@/components/surface';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { SectionHeader } from '@/components/section-header';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isolateLtr } from '@/components/ltr-text';
import { initialFor } from '@/constants/glyphs';
import { useDoctors } from '@/features/doctors/hooks';
import { useRecipient } from '@/features/recipient-profile/hooks';
import { approximateAgeYears } from '@/utils/date';

import { useEmergencyContacts } from './hooks';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Open the dialer for a phone number, mirroring the existing ContactCard pattern. */
function callNumber(phone: string) {
  const sanitized = phone.replace(/[^\d+]/g, '');
  Linking.openURL(`tel:${sanitized}`).catch(() => {
    // Device may not support telephony (tablet / emulator) — ignore quietly.
  });
}

/** A tinted-square tone pair (bg + fg) as theme tokens. */
type Tint = { bg: ThemeColor; fg: ThemeColor };
/** Per-contact avatar tint, cycling accent → amber → green (matches the 9e frame). */
const AVATAR_TINTS: Tint[] = [
  { bg: 'primaryBg', fg: 'primaryText' },
  { bg: 'warningBg', fg: 'warningFg' },
  { bg: 'successBg', fg: 'successFg' },
];

/**
 * The Dar emergency card (frame 9e) — a strictly read-only, restrained-red
 * reference wired to the SAME real data as the legacy card: the family-provided
 * recipient profile, emergency contacts, and doctors. A `terr`/`err` view-only
 * banner with the recipient identity, a toned medical-info grouped card, one-tap
 * call cards for contacts + doctors (a red call circle), and the family
 * disclaimer. No SOS dial, no add, no guaranteed-response copy. Cairo, Dar tokens,
 * both themes, RTL.
 */
export function FigmaEmergencyCard({
  circleId,
  canManage = false,
}: {
  circleId: string;
  canManage?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();

  const recipient = useRecipient(circleId);
  const contacts = useEmergencyContacts(circleId);
  const doctors = useDoctors(circleId);

  const isLoading = recipient.isLoading || contacts.isLoading || doctors.isLoading;
  const isError = recipient.isError || contacts.isError || doctors.isError;

  const muted = { color: c.textSecondary };

  if (isLoading) {
    return (
      <FigmaScreen>
        <FigmaHeader title={t('emergencyCard.title')} />
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </FigmaScreen>
    );
  }

  if (isError) {
    return (
      <FigmaScreen>
        <FigmaHeader title={t('emergencyCard.title')} />
        <View style={styles.center}>
          <Text style={[styles.errorText, muted]}>{t('emergencyCard.loadError')}</Text>
          <Pressable
            onPress={() => {
              recipient.refetch();
              contacts.refetch();
              doctors.refetch();
            }}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary, borderColor: c.border }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </View>
      </FigmaScreen>
    );
  }

  const person = recipient.data ?? null;
  const age = approximateAgeYears(person?.birth_date ?? null);
  const contactList = contacts.data ?? [];
  const doctorList = doctors.data ?? [];

  const name = person?.full_name ?? t('emergencyCard.noRecipient');
  const identityParts = [
    age != null ? t('figma.emergency.ageYears', { age }) : null,
    person?.birth_date && age == null ? person.birth_date : null,
  ].filter(Boolean) as string[];
  const identitySub = identityParts.join('  ·  ');

  const medicalRows: { key: string; label: string; value: string | null; tint: Tint; Icon: IconCmp; ltr?: boolean }[] = [
    {
      key: 'bloodType',
      label: t('recipientProfile.fields.bloodType'),
      value: person?.blood_type ?? null,
      tint: { bg: 'errorBg', fg: 'errorFg' },
      Icon: Droplets,
      ltr: true,
    },
    {
      key: 'allergies',
      label: t('recipientProfile.fields.allergies'),
      value: person?.allergies ?? null,
      tint: { bg: 'warningBg', fg: 'warningFg' },
      Icon: AlertTriangle,
    },
    {
      key: 'chronicConditions',
      label: t('recipientProfile.fields.chronicConditions'),
      value: person?.chronic_conditions ?? null,
      tint: { bg: 'errorBg', fg: 'errorFg' },
      Icon: Heart,
    },
    {
      key: 'emergencyNotes',
      label: t('recipientProfile.fields.emergencyNotes'),
      value: person?.emergency_notes ?? null,
      tint: { bg: 'primaryBg', fg: 'primaryText' },
      Icon: FileText,
    },
  ];

  const editTrailing = (route: string, label: string) => (
    <Pressable
      onPress={() => router.push(route as never)}
      accessibilityRole="button"
      accessibilityLabel={`${t('common.edit')} ${label}`}
      hitSlop={8}
      style={styles.editLink}>
      <Pencil size={13} color={c.primaryText} strokeWidth={2} />
      <Text style={[styles.editText, { color: c.primaryText }]}>{t('common.edit')}</Text>
    </Pressable>
  );

  return (
    <FigmaScreen>
      <FigmaHeader title={t('emergencyCard.title')} />

      {/* View-only banner + recipient identity */}
      <View style={[styles.banner, { backgroundColor: c.errorBg, borderColor: c.errorFg }]}>
        <View style={styles.viewOnly}>
          <AlertCircle size={14} color={c.errorFg} strokeWidth={2.2} />
          <Text style={[styles.viewOnlyText, { color: c.errorFg }]}>{t('figma.emergency.viewOnly')}</Text>
        </View>
        <View style={styles.heroRow}>
          <View style={[styles.heroChip, { borderColor: c.errorFg, backgroundColor: c.backgroundElement }]}>
            <Siren size={24} color={c.errorFg} strokeWidth={2} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroName, { color: c.text }]} numberOfLines={1}>
              {name}
            </Text>
            {identitySub ? (
              <Text style={[styles.heroSub, muted]} numberOfLines={1}>
                {identitySub}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Medical information */}
      <View style={styles.section}>
        <SectionHeader
          title={t('figma.emergency.medicalTitle')}
          trailing={canManage ? editTrailing('/recipient-profile', t('figma.emergency.medicalTitle')) : undefined}
        />
        <Surface tone="card" radius={Radius.card} padded={0}>
          {medicalRows.map((row, index) => {
            const has = !!(row.value && row.value.trim() !== '');
            const raw = has ? (row.value as string) : t('emergencyCard.notSpecified');
            const display = has && row.ltr ? isolateLtr(raw) : raw;
            return (
              <View
                key={row.key}
                style={[
                  styles.medRow,
                  index > 0 && { borderTopColor: c.border, borderTopWidth: BorderWidth.standard },
                ]}>
                <View style={[styles.medChip, { backgroundColor: c[row.tint.bg], borderColor: c.border }]}>
                  <row.Icon size={15} color={c[row.tint.fg]} strokeWidth={2} />
                </View>
                <View style={styles.medText}>
                  <Text style={[styles.medLabel, muted]}>{row.label}</Text>
                  <Text
                    style={[styles.medValue, { color: has ? c.text : c.textSecondary }]}
                    selectable={has}>
                    {display}
                  </Text>
                </View>
              </View>
            );
          })}
        </Surface>
      </View>

      {/* Emergency contacts */}
      <View style={styles.section}>
        <SectionHeader
          title={t('emergencyCard.contactsTitle')}
          trailing={canManage ? editTrailing('/emergency-contacts', t('emergencyCard.contactsTitle')) : undefined}
        />
        {contactList.length === 0 ? (
          <Surface tone="card" radius={Radius.card} padded={16}>
            <Text style={[styles.emptyText, muted]}>{t('emergencyCard.noContacts')}</Text>
          </Surface>
        ) : (
          <View style={styles.list}>
            {contactList.map((contact, i) => {
              const subParts = [
                contact.relationship?.trim() || null,
                contact.is_primary ? t('figma.emergency.primaryContact') : null,
              ].filter(Boolean) as string[];
              return (
                <CallRow
                  key={contact.id}
                  avatarText={initialFor(contact.name)}
                  avatarTint={AVATAR_TINTS[i % AVATAR_TINTS.length]}
                  name={contact.name}
                  subtitle={subParts.join('  ·  ')}
                  phone={contact.phone}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Doctors */}
      <View style={styles.section}>
        <SectionHeader title={t('emergencyCard.doctorsTitle')} />
        {doctorList.length === 0 ? (
          <Surface tone="card" radius={Radius.card} padded={16}>
            <Text style={[styles.emptyText, muted]}>{t('emergencyCard.noDoctors')}</Text>
          </Surface>
        ) : (
          <View style={styles.list}>
            {doctorList.map((doctor) => {
              const subParts = [
                doctor.specialty?.trim() || null,
                doctor.clinic_name?.trim() || null,
              ].filter(Boolean) as string[];
              return (
                <CallRow
                  key={doctor.id}
                  Icon={Stethoscope}
                  avatarTint={{ bg: 'successBg', fg: 'successFg' }}
                  name={doctor.name}
                  subtitle={subParts.join('  ·  ')}
                  phone={doctor.phone}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Disclaimer */}
      <View style={[styles.disclaimer, { backgroundColor: c.errorBg, borderColor: c.errorFg }]}>
        <AlertCircle size={17} color={c.errorFg} strokeWidth={2.2} />
        <Text style={[styles.disclaimerText, { color: c.text }]}>{t('emergencyCard.disclaimer')}</Text>
      </View>
    </FigmaScreen>
  );
}

/**
 * A one-tap call card: an avatar (initial letter or an icon) in a toned circle,
 * name + qualifier, the LTR-isolated phone number in accent, and a round red call
 * button. When no phone is stored the call button is omitted (row stays informational).
 */
function CallRow({
  name,
  subtitle,
  phone,
  avatarText,
  avatarTint,
  Icon,
}: {
  name: string;
  subtitle: string;
  phone: string | null;
  avatarText?: string;
  avatarTint: Tint;
  Icon?: IconCmp;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  return (
    <View style={[styles.callRow, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <View style={[styles.avatar, { backgroundColor: c[avatarTint.bg], borderColor: c.border }]}>
        {Icon ? (
          <Icon size={19} color={c[avatarTint.fg]} strokeWidth={2} />
        ) : (
          <Text style={[styles.avatarText, { color: c[avatarTint.fg] }]}>{avatarText}</Text>
        )}
      </View>
      <View style={styles.callText}>
        <Text style={[styles.callName, { color: c.text }]} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={[styles.callSub, { color: c.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {phone ? (
          <Text style={[styles.callPhone, { color: c.primaryText }]} numberOfLines={1}>
            {isolateLtr(phone)}
          </Text>
        ) : null}
      </View>
      {phone ? (
        <Pressable
          onPress={() => callNumber(phone)}
          accessibilityRole="button"
          accessibilityLabel={`${t('common.call')} ${name}`}
          style={[styles.callBtn, { backgroundColor: c.errorFg, borderColor: c.border }]}>
          <Phone size={19} color={c.background} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 48 },
  errorText: { fontSize: 14, fontFamily: FontFamily.medium, textAlign: 'center' },
  retry: {
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },

  // View-only banner + hero
  banner: { borderRadius: Radius.card, borderWidth: BorderWidth.standard, padding: 14, gap: 14 },
  viewOnly: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewOnlyText: { fontSize: 14, fontFamily: FontFamily.bold, flexShrink: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroChip: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroText: { flex: 1, gap: 2 },
  heroName: { fontSize: 19, fontFamily: FontFamily.bold },
  heroSub: { fontSize: 15, fontFamily: FontFamily.semibold },

  // Sections
  section: { gap: 8 },
  list: { gap: 8 },
  emptyText: { fontSize: 14, fontFamily: FontFamily.medium },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editText: { fontSize: 15, fontFamily: FontFamily.bold, textDecorationLine: 'underline' },

  // Medical rows
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  medChip: {
    width: 36,
    height: 36,
    borderRadius: Radius.control,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  medText: { flex: 1, gap: 3 },
  medLabel: { fontSize: 15, fontFamily: FontFamily.semibold },
  medValue: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 26 },

  // Call cards
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontFamily: FontFamily.black },
  callText: { flex: 1, minWidth: 0, gap: 2 },
  callName: { fontSize: 16, fontFamily: FontFamily.bold },
  callSub: { fontSize: 14, fontFamily: FontFamily.medium },
  callPhone: { fontSize: 15, fontFamily: FontFamily.bold, marginTop: 2 },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Disclaimer
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  disclaimerText: { flex: 1, fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 23 },
});
