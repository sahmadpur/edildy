import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, type ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { TabHeader } from '@/components/tab-header';
import { groupOccurrences, HOME_SECTIONS, type HomeSection, homeSections, homeStats } from '@/features/checklists/group-occurrences';
import { OccurrenceCard } from '@/features/checklists/occurrence-card';
import { useSession } from '@/lib/session';
import { localDate } from '@/lib/time';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import type { OccurrenceView } from '@/offline/execution-store';
import { useLiveQuery, useNow } from '@/offline/hooks';
import { ArchiveMore } from './archive';
import { useStartOccurrence } from './use-start-occurrence';

/** A count takes its colour only when it is not zero, so a calm day reads calm. */
const TONE: Record<HomeSection, string> = {
  myTasks: colors.primary,
  overdue: colors.dangerText,
  completed: colors.successText,
  upcoming: colors.plannedText,
};

/**
 * "My checklists" (spec §7.3, FR-10.01–02), reshaped by the Nov 2026 feedback: four equal boxes (Tapşırıqlar, Gecikən,
 * Tamamlanan, Gələcək) over four folding lists of the same names. A box opens its list, folds the others and scrolls
 * to it; a list's own heading opens or folds it.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const s = useSession();
  const services = useOffline();
  const now = useNow();
  const start = useStartOccurrence();
  const list = useLiveQuery((x) => x.store.occurrences(), []);
  const today = localDate(now, services.timeZone);
  const groups = list ? groupOccurrences(list, services.userId, now, today) : null;
  const sections = groups ? homeSections(groups) : null;
  const stats = sections ? homeStats(sections) : null;
  const [open, setOpen] = useState<HomeSection | null>('myTasks');
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<HomeSection, number>>>({});
  if (s.status !== 'authenticated') return null;

  const show = (key: HomeSection) => {
    setOpen(key);
    const y = offsets.current[key];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - spacing.sm), animated: true });
  };
  const toggle = (key: HomeSection) => setOpen((cur) => (cur === key ? null : key));

  // The route param is the OCCURRENCE id: an execution's id can change when the sync engine adopts another
  // install's claim, so the execution screen resolves the current execution from the occurrence on every change.
  const openRun = (o: OccurrenceView) => router.push({ pathname: '/execution/[id]', params: { id: o.id } });

  return (
    <Screen scrollRef={scroll}>
      <TabHeader title={t('mobile.home.greeting', { name: s.me.user.fullName })} />
      {s.offline ? (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>{t('mobile.home.offline')}</Text>
        </View>
      ) : null}
      <View style={styles.boxes}>
        {HOME_SECTIONS.map((key) => {
          const value = stats ? stats[key] : null;
          const on = open === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t(`mobile.home.${key}`)}: ${value ?? '—'}`}
              testID={`stat-${key}`}
              onPress={() => show(key)}
              style={({ pressed }) => [styles.box, on && styles.boxOn, pressed && styles.boxPressed]}
            >
              <Text style={[styles.value, { color: value ? TONE[key] : colors.muted }]}>{value === null ? '—' : String(value)}</Text>
              {/* One line that shrinks to fit: a long word ("Просрочено") never breaks in the middle, and the boxes stay equal. */}
              <Text style={[styles.boxLabel, on && styles.boxLabelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {t(`mobile.home.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {sections ? (
        HOME_SECTIONS.map((key) => {
          const cards = sections[key];
          const expanded = open === key;
          return (
            <View
              key={key}
              testID={`section-${key}`}
              style={styles.group}
              onLayout={(e) => {
                offsets.current[key] = e.nativeEvent.layout.y;
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                testID={`section-toggle-${key}`}
                onPress={() => toggle(key)}
                style={({ pressed }) => [styles.sectionRow, pressed && styles.sectionPressed]}
              >
                <Text style={styles.section}>{t(`mobile.home.${key}`)}</Text>
                <Text style={styles.count}>{cards.length}</Text>
                <View style={styles.flex} />
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
              </Pressable>
              {expanded ? (
                <>
                  {cards.length === 0 && key !== 'completed' ? <Text style={styles.subtitle}>{t('mobile.checklists.emptySection')}</Text> : null}
                  {cards.map((card) => (
                    <OccurrenceCard
                      key={card.occurrence.id}
                      card={card}
                      group={key === 'completed' ? 'done' : key === 'upcoming' ? 'upcoming' : card.rework ? 'rework' : card.action === 'continue' ? 'inProgress' : card.action === 'start' || card.claimedBy ? 'now' : 'done'}
                      timeZone={services.timeZone}
                      onStart={() => void start(card.occurrence)}
                      onOpen={() => openRun(card.occurrence)}
                    />
                  ))}
                  {key === 'completed' ? <ArchiveMore knownIds={new Set(cards.map((c) => c.occurrence.id))} today={today} timeZone={services.timeZone} /> : null}
                </>
              ) : null}
            </View>
          );
        })
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offline: { backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  offlineText: { fontFamily: font, fontSize: type.base, color: colors.warningText, fontWeight: '500' },
  subtitle: { fontFamily: font, fontSize: type.base, color: colors.muted },
  // Four equal boxes: same width and height whatever the language.
  boxes: { flexDirection: 'row', gap: spacing.sm },
  box: { flex: 1, minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.fill, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  boxOn: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  boxPressed: { opacity: 0.75 },
  value: { fontFamily: font, fontSize: 26, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  boxLabel: { fontFamily: font, fontSize: 12, lineHeight: 16, color: colors.muted, textAlign: 'center' },
  boxLabelOn: { color: colors.text, fontWeight: '600' },
  group: { gap: spacing.sm },
  sectionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  sectionPressed: { opacity: 0.6 },
  section: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  count: { fontFamily: font, fontSize: type.base, color: colors.muted },
});
