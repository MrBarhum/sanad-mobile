import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ContactCard } from '@/components/contact-card';
import { ErrorState, LoadingState } from '@/components/states';
import { Screen } from '@/components/screen';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
    <Screen>
      <Surface style={styles.identity}>
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
      </Surface>

      <Section title={t('emergencyCard.medicalTitle')}>
        <Surface style={styles.infoGroup}>
          <InfoRow
            label={t('recipientProfile.fields.bloodType')}
            value={person?.blood_type ?? null}
          />
          <InfoRow
            label={t('recipientProfile.fields.allergies')}
            value={person?.allergies ?? null}
          />
          <InfoRow
            label={t('recipientProfile.fields.chronicConditions')}
            value={person?.chronic_conditions ?? null}
          />
          <InfoRow
            label={t('recipientProfile.fields.emergencyNotes')}
            value={person?.emergency_notes ?? null}
          />
        </Surface>
      </Section>

      <Section title={t('emergencyCard.contactsTitle')}>
        {contactList.length === 0 ? (
          <ThemedText themeColor="textSecondary">{t('emergencyCard.noContacts')}</ThemedText>
        ) : (
          <View style={styles.list}>
            {contactList.map((contact) => (
              <ContactCard
                key={contact.id}
                name={contact.name}
                subtitle={contact.relationship}
                phone={contact.phone}
                callLabel={`${t('common.call')} ${contact.name}`}
              />
            ))}
          </View>
        )}
      </Section>

      <Section title={t('emergencyCard.doctorsTitle')}>
        {doctorList.length === 0 ? (
          <ThemedText themeColor="textSecondary">{t('emergencyCard.noDoctors')}</ThemedText>
        ) : (
          <View style={styles.list}>
            {doctorList.map((doctor) => (
              <ContactCard
                key={doctor.id}
                name={doctor.name}
                subtitle={doctor.specialty}
                details={[doctor.clinic_name]}
                phone={doctor.phone}
                callLabel={doctor.phone ? `${t('common.call')} ${doctor.name}` : undefined}
              />
            ))}
          </View>
        )}
      </Section>

      <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
        {t('emergencyCard.disclaimer')}
      </ThemedText>
    </Screen>
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

const styles = StyleSheet.create({
  identity: { gap: Spacing.one },
  name: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  infoGroup: { gap: Spacing.three },
  infoRow: { gap: Spacing.half },
  infoValue: { fontSize: 16, lineHeight: 24 },
  list: { gap: Spacing.three },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
});
