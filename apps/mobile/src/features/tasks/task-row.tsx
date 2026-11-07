import { formatDateTime } from '@taskop/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { useLocale } from '@/lib/language';
import { colors, font, spacing, type, type Tone } from '@/lib/theme';
import { isTaskOverdue, isTeamOffer, type TaskView } from '@/offline/task-store';

/** The status chip the task, run and audit screens share. */
export function Badge({ text, tone = 'neutral', testID }: { text: string; tone?: Tone; testID?: string }) {
  return <StatusChip text={text} tone={tone} testID={testID} />;
}

/** Spec §7.2: title, site, due date, status, overdue and sync badges. */
export function TaskRow({ task, now, timeZone, onPress }: { task: TaskView; now: number; timeZone: string; onPress: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = task.server;
  const overdue = isTaskOverdue(task, now);
  // A small dot before the title carries the colour that used to be a thick left edge.
  const dot = overdue ? colors.danger : task.status === 'completed' ? colors.success : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.title}
      testID={`task-${task.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.name}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.title}>{s.title}</Text>
      </View>
      {s.site ? <Text style={styles.muted}>{s.site.name}</Text> : null}
      {isTeamOffer(task) && s.team ? <Text style={styles.muted}>{t('mobile.tasks.team', { name: s.team.name })}</Text> : null}
      <Text style={[styles.muted, overdue && styles.overdueText]}>{s.dueAt ? t('mobile.tasks.due', { time: formatDateTime(s.dueAt, { locale, timeZone }) }) : t('mobile.tasks.noDue')}</Text>
      <View style={styles.badges}>
        <Badge text={t(`tasks.statuses.${task.status}`)} tone={task.status === 'completed' ? 'success' : task.status === 'new' ? 'neutral' : 'active'} />
        {overdue ? <Badge text={t('tasks.flags.overdue')} tone="danger" /> : null}
        {task.failedKey ? (
          <Badge text={t('mobile.tasks.syncFailed')} tone="danger" />
        ) : task.unsynced ? (
          <Badge text={t('mobile.tasks.syncPending')} tone="warning" />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 44, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  pressed: { backgroundColor: colors.fill },
  // The dot sits on the first line of a title that wraps.
  name: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  title: { fontFamily: font, fontSize: type.md, lineHeight: 23, fontWeight: '600', color: colors.text, flexShrink: 1 },
  // Indented under the title, past the dot.
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted, marginLeft: 16 },
  overdueText: { color: colors.dangerText },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginLeft: 16, marginTop: 2 },
});
