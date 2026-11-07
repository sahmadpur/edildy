import { Ionicons } from '@expo/vector-icons';
import { type Missing, requirements, visibleItems, walkItems } from '@taskop/contracts';
import { formatDateTime } from '@taskop/i18n';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { ExecutionLockedError, flaggedItems, reworkEditable } from '@/offline/execution-store';
import { useNow } from '@/offline/hooks';
import { FinishScreen, nextJump } from './finish-screen';
import { reworkOverdue } from './rework';
import { readOnlyReason, useExecution } from './use-execution';
import { useLocale } from '@/lib/language';

/**
 * Spec §8.1: the end of a rework round instead of the finish screen. It lists the flagged items with the manager's
 * comment, then the follow-ups their changes revealed ("Yeni sual", Spec decision 2), each with what still blocks
 * resubmitting (tap to jump), and queues `resubmit`.
 */
export function ResubmitScreen({ occurrenceId }: { occurrenceId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { store, userId, timeZone } = useOffline();
  const data = useExecution(occurrenceId);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // What the store refused resubmitting for, in case it disagrees with the list computed here.
  const [refused, setRefused] = useState<Missing[]>([]);
  const answers = data?.execution.answers;
  useEffect(() => setRefused([]), [answers]);

  if (data === undefined) return <ActivityIndicator color={colors.primary} />;
  if (data === null || !data.execution.rework) return <Text style={styles.muted}>{t('mobile.execution.notFound')}</Text>;
  if (data.content.kind !== 'ok') return <Text style={styles.title}>{t('mobile.execution.needsUpdate')}</Text>;

  const { execution, occurrence } = data;
  const rework = data.execution.rework;
  const content = data.content.content;
  const flagged = flaggedItems(execution);
  const editable = reworkEditable(content, execution);
  const rows = [
    ...rework.items.map((i) => ({ itemId: i.itemId, comment: i.comment as string | null })),
    ...visibleItems(content, execution.answers)
      .filter((v) => editable.has(v.item.id) && !flagged.has(v.item.id))
      .map((v) => ({ itemId: v.item.id, comment: null })),
  ];
  const listed = new Set(rows.map((r) => r.itemId));
  const computed = requirements(content, execution.answers);
  const missing = computed.length ? computed : refused;
  const labels = new Map<string, string>();
  walkItems(content, (item) => labels.set(item.id, item.label));
  const open = execution.state === 'rework' && readOnlyReason(execution, occurrence, userId, now) === null;
  const jump = (itemId: string) => router.push({ pathname: '/execution/[id]', params: { id: occurrenceId, itemId, focus: nextJump() } });

  const resubmit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await store.resubmit(execution.id);
      if (result.ok) {
        Alert.alert(t('mobile.rework.resubmitted'));
        router.replace('/');
      } else setRefused(result.missing);
    } catch (e) {
      // A second tap that lost the race, or a run that left rework meanwhile: the screen already shows its state.
      if (!(e instanceof ExecutionLockedError)) Alert.alert(t('errors.INTERNAL', { requestId: '—' }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.push({ pathname: '/execution/[id]', params: { id: occurrenceId } })}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>{t('mobile.rework.title')}</Text>
          <Text style={styles.muted}>{occurrence.checklistName}</Text>
        </View>
      </View>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{`${t('corrections.reworkBanner')} · ${t('corrections.round', { round: rework.round })}`}</Text>
        {rework.dueAt ? (
          <Text style={reworkOverdue(rework, now) ? styles.missing : styles.bannerText}>
            {t('corrections.dueAt', { date: formatDateTime(rework.dueAt, { locale, timeZone }) })}
          </Text>
        ) : null}
      </View>
      {execution.state !== 'rework' ? <Text style={styles.sent}>{t('mobile.rework.sentBanner')}</Text> : null}
      <Text style={styles.section}>{t('mobile.rework.flaggedTitle')}</Text>
      <View style={styles.list}>
        {rows.map(({ itemId, comment }) => {
          const itemMissing = missing.filter((m) => m.itemId === itemId);
          return (
            <Pressable
              key={itemId}
              testID={`rework-item-${itemId}`}
              accessibilityRole="button"
              accessibilityLabel={labels.get(itemId) ?? ''}
              onPress={() => jump(itemId)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              {/* The status colour as a small dot (it used to be a coloured border): amber while something is missing. */}
              <View style={[styles.dot, itemMissing.length > 0 ? styles.dotMissing : styles.dotReady]} />
              <View style={styles.flex}>
                <Text style={styles.rowLabel}>{labels.get(itemId) ?? ''}</Text>
                <Text style={styles.muted}>{comment !== null ? t('mobile.rework.managerComment', { comment }) : t('mobile.rework.newQuestion')}</Text>
                {itemMissing.length > 0 ? (
                  itemMissing.map((m) => (
                    <Text key={m.kind} style={styles.missing}>
                      {t(`mobile.finish.missingKinds.${m.kind}`)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.ready}>{t('mobile.rework.ready')}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          );
        })}
        {/* Anything else the store reports missing (it cannot change, but the button must not be off without a reason). */}
        {missing
          .filter((m) => !listed.has(m.itemId))
          .map((m) => (
            <Pressable
              key={`${m.itemId}-${m.kind}`}
              accessibilityRole="button"
              accessibilityLabel={`${labels.get(m.itemId) ?? ''}: ${t(`mobile.finish.missingKinds.${m.kind}`)}`}
              onPress={() => jump(m.itemId)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <View style={[styles.dot, styles.dotMissing]} />
              <View style={styles.flex}>
                <Text style={styles.rowLabel}>{`${labels.get(m.itemId) ?? ''}: ${t(`mobile.finish.missingKinds.${m.kind}`)}`}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
      </View>
      <PrimaryButton title={t('mobile.rework.resubmit')} disabled={busy || !open || missing.length > 0} onPress={() => void resubmit()} />
    </Screen>
  );
}

/** The finish route (Spec decision 8): a run sent back for correction ends on the Resubmit screen, any other on the finish screen. */
export function FinishOrResubmit({ occurrenceId }: { occurrenceId: string }) {
  const data = useExecution(occurrenceId);
  if (data === undefined) return <ActivityIndicator color={colors.primary} />;
  return data?.execution.rework ? <ResubmitScreen occurrenceId={occurrenceId} /> : <FinishScreen occurrenceId={occurrenceId} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: -spacing.sm },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  title: { fontFamily: font, fontSize: type.lg, fontWeight: '600', color: colors.text },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  section: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text, marginBottom: -spacing.sm },
  banner: { borderRadius: 12, padding: spacing.md, backgroundColor: colors.warningSoft, gap: spacing.xs },
  bannerTitle: { fontFamily: font, fontSize: type.base, color: colors.warningText, fontWeight: '600' },
  bannerText: { fontFamily: font, fontSize: type.base, color: colors.warningText },
  sent: { fontFamily: font, fontSize: type.base, color: colors.text, fontWeight: '600' },
  // Hairline rows instead of a bordered box per item.
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.fill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotMissing: { backgroundColor: colors.warning },
  dotReady: { backgroundColor: colors.success },
  rowLabel: { fontFamily: font, fontSize: type.base, color: colors.text, fontWeight: '500' },
  missing: { fontFamily: font, fontSize: type.sm, color: colors.dangerText },
  ready: { fontFamily: font, fontSize: type.sm, color: colors.successText, fontWeight: '600' },
});
