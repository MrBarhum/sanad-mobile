import { useRouter } from 'expo-router';
import {
  AlertCircle,
  AlertTriangle,
  Droplets,
  FileText,
  Heart,
  Pencil,
  Phone,
  Shield,
  Siren,
  Stethoscope,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FontFamily, Radius, withAlpha, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

/** Per-contact avatar tint, cycling the Figma category ramp (matches the export). */
const AVATAR_TINTS: ThemeColor[] = ['categoryTeal', 'categoryPurple', 'categoryBlue'];

/**
 * Figma exact-copy of the Emergency card, wired to the SAME real data the legacy
 * `EmergencyCard` reads: the family-provided recipient profile, emergency
 * contacts, and doctors. Strictly read-only and informational — a red-tinted
 * header (Siren chip + recipient name/age + "view only" shield note), a medical
 * info list, one-tap call rows for contacts and doctors, and the family
 * disclaimer. No add button, no SOS dial, no guaranteed-response copy.
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
  const scheme = useColorScheme();

  const recipient = useRecipient(circleId);
  const contacts = useEmergencyContacts(circleId);
  const doctors = useDoctors(circleId);

  const isLoading = recipient.isLoading || contacts.isLoading || doctors.isLoading;
  const isError = recipient.isError || contacts.isError || doctors.isError;

  const muted = { color: c.textSecondary, fontFamily: FontFamily.regular };

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
            style={[styles.retry, { backgroundColor: c.primary }]}>
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

  const medicalRows: { key: string; label: string; value: string | null; color: string; Icon: IconCmp }[] = [
    {
      key: 'bloodType',
      label: t('recipientProfile.fields.bloodType'),
      value: person?.blood_type ?? null,
      color: c.errorFg,
      Icon: Droplets,
    },
    {
      key: 'allergies',
      label: t('recipientProfile.fields.allergies'),
      value: person?.allergies ?? null,
      color: c.categoryGold,
      Icon: AlertTriangle,
    },
    {
      key: 'chronicConditions',
      label: t('recipientProfile.fields.chronicConditions'),
      value: person?.chronic_conditions ?? null,
      color: c.errorFg,
      Icon: Heart,
    },
    {
      key: 'emergencyNotes',
      label: t('recipientProfile.fields.emergencyNotes'),
      value: person?.emergency_notes ?? null,
      color: c.categoryBlue,
      Icon: FileText,
    },
  ];

  return (
    <FigmaScreen>
      <FigmaHeader title={t('emergencyCard.title')} />

      {/* Red-tinted identity header */}
      <View style={[styles.heroBlock, { backgroundColor: withAlpha(c.dangerSolid, scheme === 'dark' ? 0.08 : 0.05) }]}>
        <View style={styles.shieldNote}>
          <Shield size={14} color={c.errorFg} />
          <Text style={[styles.shieldText, { color: c.errorFg }]}>{t('figma.emergency.viewOnly')}</Text>
        </View>
        <View style={styles.heroRow}>
          <View style={[styles.heroChip, { backgroundColor: withAlpha(c.dangerSolid, 0.15) }]}>
            <Siren size={28} color={c.errorFg} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { color: c.errorFg }]} numberOfLines={1}>
              {t('figma.emergency.title')}
            </Text>
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
      <View>
        <SectionHeader
          label={t('figma.emergency.medicalTitle')}
          onEdit={canManage ? () => router.push('/recipient-profile') : undefined}
        />
        <FigmaCard tone="card" radius={Radius.xl} padding={0} style={{ borderColor: withAlpha(c.dangerSolid, 0.2) }}>
          {medicalRows.map((row, index) => {
            const has = !!(row.value && row.value.trim() !== '');
            const display = has ? (row.value as string) : t('emergencyCard.notSpecified');
            return (
              <View
                key={row.key}
                style={[
                  styles.medRow,
                  index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}>
                <View style={[styles.medChip, { backgroundColor: withAlpha(row.color, 0.12) }]}>
                  <row.Icon size={16} color={row.color} />
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
        </FigmaCard>
      </View>

      {/* Emergency contacts */}
      <View>
        <SectionHeader
          label={t('emergencyCard.contactsTitle')}
          onEdit={canManage ? () => router.push('/emergency-contacts') : undefined}
        />
        {contactList.length === 0 ? (
          <FigmaCard tone="card" radius={Radius.card} padding={16}>
            <Text style={[styles.emptyText, muted]}>{t('emergencyCard.noContacts')}</Text>
          </FigmaCard>
        ) : (
          <View style={styles.list}>
            {contactList.map((contact, i) => {
              const tint = c[AVATAR_TINTS[i % AVATAR_TINTS.length]];
              const subParts = [
                contact.relationship?.trim() || null,
                contact.is_primary ? t('figma.emergency.primaryContact') : null,
              ].filter(Boolean) as string[];
              return (
                <CallRow
                  key={contact.id}
                  avatarText={initialFor(contact.name)}
                  avatarTint={tint}
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
      <View>
        <Text style={[styles.sectionLabel, muted]}>{t('emergencyCard.doctorsTitle')}</Text>
        {doctorList.length === 0 ? (
          <FigmaCard tone="card" radius={Radius.card} padding={16}>
            <Text style={[styles.emptyText, muted]}>{t('emergencyCard.noDoctors')}</Text>
          </FigmaCard>
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
                  avatarTint={c.categoryGreen}
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
      <View
        style={[
          styles.disclaimer,
          { backgroundColor: withAlpha(c.dangerSolid, 0.06), borderColor: withAlpha(c.dangerSolid, 0.15) },
        ]}>
        <AlertCircle size={16} color={c.errorFg} />
        <Text style={[styles.disclaimerText, muted]}>{t('emergencyCard.disclaimer')}</Text>
      </View>
    </FigmaScreen>
  );
}

/**
 * A section label with an optional manager-only edit shortcut. The card itself
 * stays read-only; the shortcut just routes managers to the existing edit screen
 * for that section (recipient profile / emergency contacts), which was otherwise
 * unreachable from the live UI.
 */
function SectionHeader({
  label,
  onEdit,
}: {
  label: string;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionLabelInline, { color: c.textSecondary }]}>{label}</Text>
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`${t('common.edit')} ${label}`}
          hitSlop={8}
          style={styles.editLink}>
          <Pencil size={14} color={c.primary} />
          <Text style={[styles.editText, { color: c.primary }]}>{t('common.edit')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A one-tap call row: an avatar (initial letter or an icon), name + qualifier,
 * the LTR-isolated phone number, and a round red call button. When no phone is
 * stored the call button is omitted (the row stays informational).
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
  avatarTint: string;
  Icon?: IconCmp;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  return (
    <View style={[styles.callRow, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <View style={[styles.avatar, { backgroundColor: withAlpha(avatarTint, 0.12) }]}>
        {Icon ? (
          <Icon size={20} color={avatarTint} />
        ) : (
          <Text style={[styles.avatarText, { color: avatarTint }]}>{avatarText}</Text>
        )}
      </View>
      <View style={styles.callText}>
        <Text style={[styles.callName, { color: c.text }]} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={[styles.callSub, { color: c.textSecondary, fontFamily: FontFamily.regular }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {phone ? (
          <Text style={[styles.callPhone, { color: c.primary }]} numberOfLines={1}>
            {isolateLtr(phone)}
          </Text>
        ) : null}
      </View>
      {phone ? (
        <Pressable
          onPress={() => callNumber(phone)}
          accessibilityRole="button"
          accessibilityLabel={`${t('common.call')} ${name}`}
          style={[styles.callBtn, { backgroundColor: c.dangerSolid }]}>
          <Phone size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 48 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retry: { borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  retryText: { fontSize: 14, fontFamily: FontFamily.semibold },

  // Hero
  heroBlock: { borderRadius: Radius.xl, padding: 20, gap: 16 },
  shieldNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shieldText: { fontSize: 14, fontFamily: FontFamily.semibold, flexShrink: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroChip: { width: 56, height: 56, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 2 },
  heroTitle: { fontSize: 24, fontFamily: FontFamily.bold },
  heroName: { fontSize: 16, fontFamily: FontFamily.semibold },
  heroSub: { fontSize: 14 },

  // Sections
  sectionLabel: { fontSize: 14, fontFamily: FontFamily.semibold, marginBottom: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabelInline: { fontSize: 14, fontFamily: FontFamily.semibold, flexShrink: 1 },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 6,
  },
  editText: { fontSize: 14, fontFamily: FontFamily.semibold },
  list: { gap: 8 },
  emptyText: { fontSize: 14 },

  // Medical rows
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  medChip: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  medText: { flex: 1, gap: 2 },
  medLabel: { fontSize: 14 },
  medValue: { fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 24 },

  // Call rows
  callRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 14 },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: FontFamily.bold },
  callText: { flex: 1, gap: 2 },
  callName: { fontSize: 15, fontFamily: FontFamily.semibold },
  callSub: { fontSize: 14 },
  callPhone: { fontSize: 14, fontFamily: FontFamily.medium, marginTop: 2 },
  callBtn: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },

  // Disclaimer
  disclaimer: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 14 },
  disclaimerText: { flex: 1, fontSize: 14, lineHeight: 18 },
});
