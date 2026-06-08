import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useRecipient } from '@/features/recipient-profile/hooks';
import { useDoctors } from '@/features/doctors/hooks';
import { approximateAgeYears } from '@/utils/date';

import { useEmergencyContacts } from './hooks';

/**
 * Read-only emergency card. Aggregates the family-provided recipient profile,
 * emergency contacts, and doctors into a single quick-reference view. It is
 * strictly informational: it shows only what the family entered and gives no
 * medical advice (see the disclaimer at the bottom).
 */
export function EmergencyCard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const recipient = useRecipient(circleId);
  const contacts = useEmergencyContacts(circleId);
  const doctors = useDoctors(circleId);

  const isLoading = recipient.isLoading || contacts.isLoading || doctors.isLoading;
  const isError = recipient.isError || contacts.isError || doctors.isError;

  if (isLoading) return <LoadingState />;
  if (isError) {
    return (
      <ErrorState
        message={t('emergencyCard.loadError')}
        retryLabel={t('retry')}
        onRetry={() => {
          recipient.refetch();
          contacts.refetch();
          doctors.refetch();
        }}
      />
    );
  }

  const person = recipient.data;
  const age = approximateAgeYears(person?.birth_date ?? null);
  const contactList = contacts.data ?? [];
  const doctorList = doctors.data ?? [];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedView type="backgroundElement" style={styles.identity}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('emergencyCard.recipientLabel')}
          </ThemedText>
          <ThemedText style={styles.name}>
            {person?.full_name ?? t('emergencyCard.noRecipient')}
          </ThemedText>
          {person?.birth_date ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('emergencyCard.birthDate')}: {person.birth_date}
              {age !== null ? ` • ${t('emergencyCard.approxAge')}: ${age}` : ''}
            </ThemedText>
          ) : null}
        </ThemedView>

        <Section title={t('emergencyCard.medicalTitle')}>
          <InfoRow label={t('recipientProfile.fields.bloodType')} value={person?.blood_type ?? null} />
          <InfoRow label={t('recipientProfile.fields.allergies')} value={person?.allergies ?? null} />
          <InfoRow
            label={t('recipientProfile.fields.chronicConditions')}
            value={person?.chronic_conditions ?? null}
          />
          <InfoRow
            label={t('recipientProfile.fields.emergencyNotes')}
            value={person?.emergency_notes ?? null}
          />
        </Section>

        <Section title={t('emergencyCard.contactsTitle')}>
          {contactList.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('emergencyCard.noContacts')}</ThemedText>
          ) : (
            contactList.map((contact) => (
              <View key={contact.id} style={styles.entry}>
                <View style={styles.entryHeader}>
                  <ThemedText style={styles.entryName}>{contact.name}</ThemedText>
                  {contact.is_primary ? (
                    <ThemedView type="backgroundSelected" style={styles.badge}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('emergencyContacts.primaryBadge')}
                      </ThemedText>
                    </ThemedView>
                  ) : null}
                </View>
                {contact.relationship ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {contact.relationship}
                  </ThemedText>
                ) : null}
                <PhoneLink phone={contact.phone} />
              </View>
            ))
          )}
        </Section>

        <Section title={t('emergencyCard.doctorsTitle')}>
          {doctorList.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('emergencyCard.noDoctors')}</ThemedText>
          ) : (
            doctorList.map((doctor) => (
              <View key={doctor.id} style={styles.entry}>
                <ThemedText style={styles.entryName}>{doctor.name}</ThemedText>
                {doctor.specialty ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {doctor.specialty}
                  </ThemedText>
                ) : null}
                {doctor.clinic_name ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {doctor.clinic_name}
                  </ThemedText>
                ) : null}
                {doctor.phone ? <PhoneLink phone={doctor.phone} /> : null}
              </View>
            ))
          )}
        </Section>

        <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
          {t('emergencyCard.disclaimer')}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedText style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation();
  const display = value && value.trim() !== '' ? value : t('emergencyCard.notSpecified');
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.infoValue} selectable>
        {display}
      </ThemedText>
    </View>
  );
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <Pressable
      onPress={() => {
        Linking.openURL(`tel:${phone}`).catch(() => {
          // No dialer available (e.g. desktop web) — ignore; the number is still
          // shown as selectable text.
        });
      }}
      accessibilityRole="link"
      accessibilityLabel={phone}>
      <ThemedText type="linkPrimary" style={styles.phoneLink} selectable>
        {phone}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  identity: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.one },
  name: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  section: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  infoRow: { gap: Spacing.half },
  infoValue: { fontSize: 16, lineHeight: 24 },
  entry: { gap: Spacing.half },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  entryName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  badge: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  phoneLink: { fontSize: 16, lineHeight: 26 },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
});
