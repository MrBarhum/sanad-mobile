import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';

import type { CircleMember, CircleRole } from './api';
import { assignableRolesFor } from './permissions';
import { roleCapability, roleChangeDirection } from './role-capabilities';

const DANGER = '#dc2626';

/**
 * Two-step role picker. Step 1 lets a manager browse the roles they may assign,
 * each with a capability summary and expandable "Can do / Cannot do" details, and
 * pick one WITHOUT mutating the server. Step 2 is an explicit confirmation that
 * summarizes old → new and whether access is raised or lowered. Save and Cancel
 * are always separate. The update_circle_member_role RPC remains authoritative.
 */
export function RoleModal({
  member,
  actorRole,
  submitting,
  error,
  onClose,
  onSave,
}: {
  member: CircleMember;
  actorRole: CircleRole;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (role: CircleRole) => void;
}) {
  const { t } = useTranslation();
  const roles = assignableRolesFor(actorRole, member);
  const [selected, setSelected] = useState<CircleRole>(member.role);
  const [expanded, setExpanded] = useState<CircleRole | null>(member.role);
  const [confirming, setConfirming] = useState(false);

  const changed = selected !== member.role;
  const direction = roleChangeDirection(member.role, selected);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
              {confirming ? t('circleMembers.confirmRoleTitle') : t('circleMembers.changeRoleTitle')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={Spacing.two}>
              <ThemedText style={styles.close}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {confirming ? (
              <ConfirmStep from={member.role} to={selected} direction={direction} />
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('circleMembers.changeRoleHint')}
                </ThemedText>
                {roles.map((role) => (
                  <RoleOption
                    key={role}
                    role={role}
                    selected={role === selected}
                    isCurrent={role === member.role}
                    expanded={role === expanded}
                    onSelect={() => setSelected(role)}
                    onToggleDetails={() => setExpanded((cur) => (cur === role ? null : role))}
                  />
                ))}
              </>
            )}

            {error ? (
              <ThemedText
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.actions}>
              {confirming ? (
                <>
                  <Button
                    label={t('circleMembers.confirmChange')}
                    onPress={() => onSave(selected)}
                    loading={submitting}
                    disabled={submitting}
                    style={styles.action}
                  />
                  <Button
                    label={t('circleMembers.back')}
                    variant="secondary"
                    disabled={submitting}
                    onPress={() => setConfirming(false)}
                    style={styles.action}
                  />
                </>
              ) : (
                <>
                  <Button
                    label={t('circleMembers.saveRole')}
                    onPress={() => setConfirming(true)}
                    disabled={!changed}
                    style={styles.action}
                  />
                  <Button
                    label={t('common.cancel')}
                    variant="secondary"
                    onPress={onClose}
                    style={styles.action}
                  />
                </>
              )}
            </View>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RoleOption({
  role,
  selected,
  isCurrent,
  expanded,
  onSelect,
  onToggleDetails,
}: {
  role: CircleRole;
  selected: boolean;
  isCurrent: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleDetails: () => void;
}) {
  const { t } = useTranslation();
  const cap = roleCapability(role);
  const can = t(cap.canKey, { returnObjects: true });
  const cannot = t(cap.cannotKey, { returnObjects: true });
  const canList: string[] = Array.isArray(can) ? (can as string[]) : [];
  const cannotList: string[] = Array.isArray(cannot) ? (cannot as string[]) : [];

  return (
    <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.option}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}>
        <View style={styles.optionHeader}>
          <View style={styles.optionTitleWrap}>
            <ThemedText style={styles.optionTitle}>{t(cap.titleKey)}</ThemedText>
            {isCurrent ? (
              <ThemedView type="backgroundSelected" style={styles.currentBadge}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('circleMembers.current')}
                </ThemedText>
              </ThemedView>
            ) : null}
          </View>
          {selected ? <ThemedText style={styles.check}>✓</ThemedText> : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {t(cap.summaryKey)}
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={onToggleDetails}
        accessibilityRole="button"
        hitSlop={Spacing.one}
        style={styles.detailsToggle}>
        <ThemedText type="small" themeColor="textSecondary">
          {expanded ? t('circleMembers.hideDetails') : t('circleMembers.showDetails')}
        </ThemedText>
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <ThemedText type="smallBold">{t('circleMembers.canDo')}</ThemedText>
          {canList.map((line, i) => (
            <ThemedText key={`can-${i}`} type="small" themeColor="textSecondary">
              • {line}
            </ThemedText>
          ))}
          <ThemedText type="smallBold" style={styles.cannotHeading}>
            {t('circleMembers.cannotDo')}
          </ThemedText>
          {cannotList.map((line, i) => (
            <ThemedText key={`cannot-${i}`} type="small" themeColor="textSecondary">
              • {line}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </ThemedView>
  );
}

function ConfirmStep({
  from,
  to,
  direction,
}: {
  from: CircleRole;
  to: CircleRole;
  direction: 'increase' | 'decrease' | 'lateral';
}) {
  const { t } = useTranslation();
  return (
    <ThemedView type="backgroundElement" style={styles.confirmCard}>
      <ThemedText style={styles.confirmSummary}>
        {t('circleMembers.roleChangeSummary', {
          from: t(`circleMembers.roles.${from}`),
          to: t(`circleMembers.roles.${to}`),
        })}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t(`circleMembers.direction.${direction}`)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '90%',
    paddingTop: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 24, lineHeight: 32, flexShrink: 1 },
  close: { fontSize: 20, fontWeight: '600', padding: Spacing.one },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  option: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600' },
  currentBadge: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  check: { fontSize: 16, fontWeight: '700' },
  detailsToggle: { paddingVertical: Spacing.half },
  details: { gap: Spacing.one, marginTop: Spacing.one },
  cannotHeading: { marginTop: Spacing.two },
  confirmCard: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  confirmSummary: { fontSize: 18, fontWeight: '600' },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  action: { width: '100%' },
  error: { color: DANGER },
});
