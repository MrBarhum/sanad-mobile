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
import { StatusBadge } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, MaxFormWidth, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { CircleMember, CircleRole } from './api';
import { assignableRolesFor } from './permissions';
import { roleCapability, roleChangeDirection } from './role-capabilities';

/**
 * Two-step role picker. Step 1 lets a manager browse the roles they may assign,
 * each with a capability summary and expandable "Can do / Cannot do" details, and
 * pick one WITHOUT mutating the server. Step 2 is an explicit confirmation that
 * summarizes old â†’ new and whether access is raised or lowered. Save and Cancel
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
  const theme = useTheme();
  const roles = assignableRolesFor(actorRole, member);
  const [selected, setSelected] = useState<CircleRole>(member.role);
  const [expanded, setExpanded] = useState<CircleRole | null>(member.role);
  const [confirming, setConfirming] = useState(false);

  const changed = selected !== member.role;
  const direction = roleChangeDirection(member.role, selected);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={[styles.sheet, { borderColor: theme.border }]}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.header}>
            <ThemedText type="sectionTitle" style={styles.title} accessibilityRole="header">
              {confirming ? t('circleMembers.confirmRoleTitle') : t('circleMembers.changeRoleTitle')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={Spacing.two}
              style={styles.closeButton}>
              <ThemedText style={styles.close}>âœ•</ThemedText>
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
                style={{ color: theme.errorFg }}
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
  const theme = useTheme();
  const cap = roleCapability(role);
  const can = t(cap.canKey, { returnObjects: true });
  const cannot = t(cap.cannotKey, { returnObjects: true });
  const canList: string[] = Array.isArray(can) ? (can as string[]) : [];
  const cannotList: string[] = Array.isArray(cannot) ? (cannot as string[]) : [];

  return (
    <Surface tone={selected ? 'selected' : 'card'} style={styles.option}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}>
        <View style={styles.optionHeader}>
          <View style={styles.optionTitleWrap}>
            {selected ? (
              <ThemedText
                type="smallBold"
                style={{ color: theme.primary }}
                accessibilityElementsHidden
                importantForAccessibility="no">
                âœ“
              </ThemedText>
            ) : null}
            <ThemedText
              type="cardTitle"
              style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
              {t(cap.titleKey)}
            </ThemedText>
            {isCurrent ? (
              <StatusBadge tone="neutral" label={t('circleMembers.current')} />
            ) : null}
          </View>
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
              â€¢ {line}
            </ThemedText>
          ))}
          <ThemedText type="smallBold" style={styles.cannotHeading}>
            {t('circleMembers.cannotDo')}
          </ThemedText>
          {cannotList.map((line, i) => (
            <ThemedText key={`cannot-${i}`} type="small" themeColor="textSecondary">
              â€¢ {line}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </Surface>
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
    <Surface style={styles.confirmCard}>
      <ThemedText type="cardTitle">
        {t('circleMembers.roleChangeSummary', {
          from: t(`circleMembers.roles.${from}`),
          to: t(`circleMembers.roles.${to}`),
        })}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t(`circleMembers.direction.${direction}`)}
      </ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '90%',
    paddingTop: Spacing.two,
  },
  // Visual bottom-sheet affordance (matches form-modal; dismissal stays explicit).
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radius.pill,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { flexShrink: 1 },
  closeButton: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { fontSize: 20, fontWeight: '600' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  option: { gap: Spacing.two },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  optionTitle: { flexShrink: 1 },
  optionTitleSelected: { fontFamily: FontFamily.bold, fontWeight: '700' },
  detailsToggle: { minHeight: TouchTarget.min, justifyContent: 'center', paddingVertical: Spacing.half },
  details: { gap: Spacing.one, marginTop: Spacing.one },
  cannotHeading: { marginTop: Spacing.two },
  confirmCard: { gap: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  action: { width: '100%' },
});
