import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { headerBlock } from '@/components/chip';
import { Screen } from '@/components/screen';
import { GROUP_KEYS, groupOccurrences, homeStats, type HomeStats } from '@/features/checklists/group-occurrences';
import { OccurrenceCard } from '@/features/checklists/occurrence-card';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { SyncIndicator } from '@/features/sync/sync-indicator';
import { useSession } from '@/lib/session';
import { useLocale } from '@/lib/language';
import { localDate } from '@/lib/time';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { type OccurrenceView, StartRefusedError } from '@/offline/execution-store';
import { formatLocalDate } from '@taskop/i18n';
import { useLiveQuery, useNow } from '@/offline/hooks';

/** The four counts in one quiet strip; a count takes its colour only when it is not zero, so a calm day reads calm. */
const STATS: { key: keyof HomeStats; color: string }[] = [
  { key: 'myTasks', color: colors.text },
  { key: 'overdue', color: colors.dangerText },
  { key: 'completed', color: colors.successText },
  { key: 'issues', color: colors.dangerText },
];

/** "My checklists" (spec §7.3, FR-10.01–02). */
export function HomeScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = useSession();
  const services = useOffline();
  const now = useNow();
  const list = useLiveQuery((x) => x.store.occurrences(), []);
  const groups = list ? groupOccurrences(list, services.userId, now, localDate(now, services.timeZone)) : null;
  const executionIds = groups ? [...groups.inProgress, ...groups.done].flatMap((c) => (c.occurrence.execution ? [c.occurrence.execution.id] : [])) : [];
  const problems = useLiveQuery((x) => x.store.problemCount(executionIds), [executionIds.join(',')]);
  if (s.status !== 'authenticated') return null;
  const stats = groups ? homeStats(groups, problems ?? 0) : null;

  // The route param is the OCCURRENCE id: an execution's id can change when the sync engine adopts another
  // install's claim, so the execution screen resolves the current execution from the occurrence on every change.
  const openExecution = (o: OccurrenceView) => router.push({ pathname: '/execution/[id]', params: { id: o.id } });
  const start = async (o: OccurrenceView) => {
    if (o.execution) return openExecution(o); // `store.start` is only for occurrences this phone has no execution of
    try {
      await services.store.start(o.id, services.userId);
      openExecution(o);
    } catch (e) {
      Alert.alert(e instanceof StartRefusedError ? t(`mobile.checklists.startBlocked.${e.reason}`) : t('errors.INTERNAL', { requestId: '—' }));
    }
  };
  const open = (o: OccurrenceView) => {
    if (o.execution) openExecution(o);
  };

  return (
    <Screen>
      <View style={headerBlock.compactBlock}>
        <View style={styles.top}>
          <Text style={headerBlock.eyebrow}>{formatLocalDate(localDate(now, services.timeZone), locale)}</Text>
          <View style={styles.tools}>
            <SyncIndicator compact />
            <NotificationBell />
          </View>
        </View>
        <Text accessibilityRole="header" style={headerBlock.greeting}>
          {t('mobile.home.greeting', { name: s.me.user.fullName })}
        </Text>
      </View>
      {s.offline ? (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>{t('mobile.home.offline')}</Text>
        </View>
      ) : null}
      <View style={styles.strip}>
        {STATS.map((stat) => {
          const value = stats ? stats[stat.key] : null;
          return (
            <View key={stat.key} testID={`stat-${stat.key}`} style={styles.stat}>
              <Text style={[styles.value, { color: value ? stat.color : colors.muted }]}>{value === null ? '—' : String(value)}</Text>
              <Text style={styles.statLabel}>{t(`mobile.home.${stat.key}`)}</Text>
            </View>
          );
        })}
      </View>
      {groups ? (
        // Only sections with something in them; one quiet line when the whole list is empty.
        GROUP_KEYS.every((key) => groups[key].length === 0) ? (
          <Text style={styles.subtitle}>{t('mobile.checklists.emptySection')}</Text>
        ) : (
          GROUP_KEYS.filter((key) => groups[key].length > 0).map((key) => (
            <View key={key} style={styles.group}>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>{t(`mobile.checklists.sections.${key}`)}</Text>
                <Text style={styles.count}>{groups[key].length}</Text>
              </View>
              {groups[key].map((card) => (
                <OccurrenceCard
                  key={card.occurrence.id}
                  card={card}
                  group={key}
                  timeZone={services.timeZone}
                  onStart={() => void start(card.occurrence)}
                  onOpen={() => open(card.occurrence)}
                />
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginRight: -spacing.xs },
  tools: { flexDirection: 'row', alignItems: 'center' },
  offline: { backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  offlineText: { fontFamily: font, fontSize: type.base, color: colors.warningText, fontWeight: '500' },
  subtitle: { fontFamily: font, fontSize: type.base, color: colors.muted },
  strip: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, paddingVertical: spacing.md },
  stat: { width: '25%', gap: 2, paddingRight: spacing.sm },
  value: { fontFamily: font, fontSize: 26, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  statLabel: { fontFamily: font, fontSize: 12, lineHeight: 16, color: colors.muted },
  group: { gap: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  section: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  count: { fontFamily: font, fontSize: type.base, color: colors.muted },
});
