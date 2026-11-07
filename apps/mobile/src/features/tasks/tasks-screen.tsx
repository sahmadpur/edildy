import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { headerBlock } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SyncIndicator } from '@/features/sync/sync-indicator';
import { useSession } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { useLiveQuery, useNow } from '@/offline/hooks';
import { groupTasks, TASK_GROUP_KEYS } from './group-tasks';
import { ReviewSection } from './review-section';
import { TaskRow } from './task-row';

/** Spec §7.2: the Tapşırıqlar tab. */
export function TasksScreen() {
  const { t } = useTranslation();
  const services = useOffline();
  const now = useNow();
  const session = useSession();
  const canManage = session.status === 'authenticated' && session.me.permissions.includes('tasks.manage');
  const list = useLiveQuery((s) => s.tasks.tasks(), []);
  const groups = list ? groupTasks(list, now) : null;
  const open = (id: string) => router.push({ pathname: '/task/[id]', params: { id } });
  return (
    <Screen>
      <View style={headerBlock.block}>
        <View style={styles.top}>
          <Text accessibilityRole="header" style={[headerBlock.title, styles.title]}>
            {t('mobile.tasks.title')}
          </Text>
          {canManage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mobile.tasks.create.open')}
              onPress={() => router.push({ pathname: '/task/new', params: { n: services.newId() } })}
              style={({ pressed }) => [styles.create, pressed && styles.pressed]}
            >
              <Text style={styles.createText}>{`+ ${t('mobile.tasks.create.open')}`}</Text>
            </Pressable>
          ) : null}
        </View>
        <SyncIndicator />
      </View>
      {canManage ? <ReviewSection /> : null}
      {groups ? (
        // Only sections with something in them; one quiet line when there is nothing at all.
        TASK_GROUP_KEYS.every((key) => groups[key].length === 0) ? (
          <Text style={styles.muted}>{t('mobile.tasks.empty')}</Text>
        ) : (
          TASK_GROUP_KEYS.filter((key) => groups[key].length > 0).map((key) => (
            <View key={key} style={styles.group}>
              <View style={styles.sectionRow}>
                <Text testID={`section-${key}`} style={styles.section}>
                  {t(`mobile.tasks.sections.${key}`)}
                </Text>
                <Text style={styles.count}>{groups[key].length}</Text>
              </View>
              {groups[key].map((task) => (
                <TaskRow key={task.id} task={task} now={now} timeZone={services.timeZone} onPress={() => open(task.id)} />
              ))}
            </View>
          ))
        )
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flexShrink: 1 },
  create: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs, marginRight: -spacing.xs, borderRadius: 10 },
  pressed: { backgroundColor: colors.fill },
  createText: { fontFamily: font, fontSize: type.base, fontWeight: '600', color: colors.primary },
  group: { gap: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  section: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  count: { fontFamily: font, fontSize: type.base, color: colors.muted },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
});
