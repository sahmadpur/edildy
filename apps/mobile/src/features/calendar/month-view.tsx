import { Ionicons } from '@expo/vector-icons';
import { formatLocalDate } from '@edildy/i18n';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { useLocale } from '@/lib/language';
import { formatTime } from '@/lib/time';
import { colors, font, spacing, type } from '@/lib/theme';
import { type CalendarEntry, entriesOn, monthWeeks, sameMonth } from './calendar-model';
import { openEntry } from './entry-style';

/** Dots drawn in one day cell before "+n". */
const MAX_DOTS = 3;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  selected: string;
  today: string;
  entries: CalendarEntry[];
  timeZone: string;
  onSelect: (day: string) => void;
}

/** Month view: Monday-first weeks with a dot per run, and the chosen day's runs listed underneath (Outlook's agenda). */
export function MonthView({ selected, today, entries, timeZone, onSelect }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const weeks = useMemo(() => monthWeeks(selected), [selected]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const e of entries) m.set(e.localDate, [...(m.get(e.localDate) ?? []), e]);
    return m;
  }, [entries]);
  const agenda = entriesOn(entries, selected);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} testID="month-view">
      <View>
        <View style={styles.week}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekday}>
              {t(`mobile.calendar.weekdays.w${w}`)}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} style={styles.week}>
            {week.map((day) => {
              const list = byDay.get(day) ?? [];
              const inMonth = sameMonth(day, selected);
              const on = day === selected;
              const isToday = day === today;
              return (
                <Pressable
                  key={day}
                  testID={`month-day-${day}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${formatLocalDate(day, locale)}: ${list.length}`}
                  onPress={() => onSelect(day)}
                  style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                >
                  <View style={[styles.num, isToday && styles.numToday, on && styles.numOn]}>
                    <Text style={[styles.numText, !inMonth && styles.numOut, isToday && styles.numTextToday, on && styles.numTextOn]}>{Number(day.slice(8))}</Text>
                  </View>
                  <View style={styles.dots}>
                    {list.slice(0, MAX_DOTS).map((e) => (
                      <View key={e.id} style={[styles.dot, { backgroundColor: e.color }, !inMonth && styles.dotOut]} />
                    ))}
                    {list.length > MAX_DOTS ? <Text style={styles.more}>{`+${list.length - MAX_DOTS}`}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.agenda} testID="agenda">
        <Text accessibilityRole="header" style={styles.agendaTitle}>
          {formatLocalDate(selected, locale, { weekday: true, long: true })}
        </Text>
        {agenda.length === 0 ? <Text style={styles.empty}>{t('mobile.calendar.empty')}</Text> : null}
        {agenda.map((e) => (
          <AgendaRow key={e.id} entry={e} timeZone={timeZone} />
        ))}
      </View>
    </ScrollView>
  );
}

function AgendaRow({ entry, timeZone }: { entry: CalendarEntry; timeZone: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const time = entry.allDay ? t('scheduling.builder.modes.anytime') : t('mobile.checklists.window', { from: formatTime(entry.startsAt, timeZone, locale), to: formatTime(entry.closesAt, timeZone, locale) });
  return (
    <Pressable
      testID={`agenda-${entry.id}`}
      accessibilityRole={entry.target ? 'button' : undefined}
      accessibilityLabel={`${entry.name}, ${time}`}
      disabled={!entry.target}
      onPress={() => openEntry(entry)}
      style={({ pressed }) => [styles.row, entry.target && pressed && styles.rowPressed]}
    >
      <View style={[styles.rowDot, { backgroundColor: entry.color }]} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {`${time} · ${entry.site}`}
        </Text>
        {entry.doneBy ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {t('mobile.checklists.doneBy', { name: entry.doneBy })}
          </Text>
        ) : null}
        {entry.statusKey ? (
          <View style={styles.chips}>
            <StatusChip text={t(entry.statusKey)} tone={entry.color === colors.danger ? 'danger' : entry.color === colors.success ? 'success' : 'neutral'} />
          </View>
        ) : null}
      </View>
      {entry.target ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

const CELL = 48;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xl, gap: spacing.md },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: font, fontSize: 12, color: colors.muted, paddingVertical: spacing.xs },
  cell: { flex: 1, height: CELL + 4, alignItems: 'center', paddingTop: 2, gap: 3 },
  pressed: { opacity: 0.6 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  numToday: { borderWidth: 1.5, borderColor: colors.primary },
  numOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  numText: { fontFamily: font, fontSize: type.base, color: colors.text },
  numOut: { color: colors.borderStrong },
  numTextToday: { color: colors.primary, fontWeight: '600' },
  numTextOn: { color: colors.primaryText, fontWeight: '600' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOut: { opacity: 0.4 },
  more: { fontFamily: font, fontSize: 9, lineHeight: 10, color: colors.muted },
  agenda: { gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, paddingTop: spacing.md },
  agendaTitle: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  empty: { fontFamily: font, fontSize: type.base, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowPressed: { backgroundColor: colors.fill },
  rowDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 8 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: font, fontSize: type.base, fontWeight: '600', color: colors.text },
  rowMeta: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  chips: { flexDirection: 'row', marginTop: 2 },
});
