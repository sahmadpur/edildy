import { zonedTimeToUtc } from '@edildy/contracts';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@/lib/language';
import { formatTime } from '@/lib/time';
import { colors, font, spacing, type } from '@/lib/theme';
import { type CalendarEntry, daySegments, entriesOn, weekdayOf } from './calendar-model';
import { openEntry, tintOf } from './entry-style';

export const HOUR_HEIGHT = 56;
const GUTTER = 48;
/** Room over the first hour line so its label is not clipped. */
const TOP_GAP = 10;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Where the grid opens when today is not on screen and nothing is planned earlier. */
const DEFAULT_HOUR = 7;

interface Props {
  days: string[];
  entries: CalendarEntry[];
  today: string;
  now: number;
  timeZone: string;
}

/** Day and 3-day views: an hour grid with one column per day; my runs are blocks laid side by side where they clash. */
export function TimeGrid({ days, entries, today, now, timeZone }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const scroll = useRef<ScrollView>(null);
  const columns = useMemo(() => days.map((d) => ({ day: d, segments: daySegments(entries, d, timeZone), allDay: entriesOn(entries, d).filter((e) => e.allDay) })), [days, entries, timeZone]);
  const anyAllDay = columns.some((c) => c.allDay.length > 0);
  const showsToday = days.includes(today);
  const nowMinutes = showsToday ? (now - +zonedTimeToUtc(today, 0, timeZone)) / 60_000 : null;
  const earliest = Math.min(...columns.flatMap((c) => c.segments.map((s) => s.top)));
  // Open near now on today; otherwise at the first run, or 07:00 on an empty day.
  const startHour = nowMinutes !== null ? Math.floor(nowMinutes / 60) - 1 : Number.isFinite(earliest) ? Math.floor(earliest / 60) : DEFAULT_HOUR;
  const key = days.join(',');

  useEffect(() => {
    const y = Math.max(0, Math.min(23, startHour)) * HOUR_HEIGHT;
    scroll.current?.scrollTo({ y, animated: false });
    // Only when the days change: a sync or the clock ticking must not jump the grid back.
  }, [key]);

  return (
    <View style={styles.wrap}>
      {days.length > 1 ? (
        <View style={styles.headRow}>
          <View style={{ width: GUTTER }} />
          {days.map((d) => {
            const on = d === today;
            return (
              <View key={d} style={styles.headCell} testID={`grid-head-${d}`}>
                <Text style={[styles.headDay, on && styles.headToday]} numberOfLines={1}>
                  {t(`mobile.calendar.weekdays.w${weekdayOf(d)}`)}
                </Text>
                <View style={[styles.headNum, on && styles.headNumOn]}>
                  <Text style={[styles.headNumText, on && styles.headNumTextOn]}>{Number(d.slice(8))}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {anyAllDay ? (
        <View style={styles.allDayRow} testID="all-day">
          <Text style={[styles.gutterText, { width: GUTTER }]} numberOfLines={2}>
            {t('mobile.calendar.allDay')}
          </Text>
          {columns.map((c) => (
            <View key={c.day} style={styles.allDayCell}>
              {c.allDay.map((e) => (
                <EntryPill key={e.id} entry={e} label={e.name} />
              ))}
            </View>
          ))}
        </View>
      ) : null}
      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={{ height: HOUR_HEIGHT * 24 + spacing.lg + TOP_GAP, paddingTop: TOP_GAP }} testID="time-grid">
        <View style={styles.row}>
          <View style={{ width: GUTTER }}>
            {HOURS.map((h) => (
              <Text key={h} style={[styles.gutterText, styles.hourLabel, { top: h * HOUR_HEIGHT - 8 }]}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </Text>
            ))}
          </View>
          {columns.map((c) => (
            <View key={c.day} style={styles.column} testID={`grid-day-${c.day}`}>
              {HOURS.map((h) => (
                <View key={h} style={[styles.hourLine, { top: h * HOUR_HEIGHT }]} />
              ))}
              {c.segments.map((s) => {
                const tint = tintOf(s.entry.color);
                const height = ((s.bottom - s.top) / 60) * HOUR_HEIGHT - 2;
                const time = t('mobile.checklists.window', { from: formatTime(s.entry.startsAt, timeZone, locale), to: formatTime(s.entry.closesAt, timeZone, locale) });
                return (
                  <Pressable
                    key={s.entry.id}
                    testID={`block-${s.entry.id}`}
                    accessibilityRole={s.entry.target ? 'button' : undefined}
                    accessibilityLabel={`${s.entry.name}, ${time}`}
                    disabled={!s.entry.target}
                    onPress={() => openEntry(s.entry)}
                    style={({ pressed }) => [
                      styles.block,
                      { top: (s.top / 60) * HOUR_HEIGHT + 1, height, left: `${(s.col / s.cols) * 100}%`, width: `${100 / s.cols}%`, backgroundColor: tint.bg, borderLeftColor: s.entry.color },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.blockTitle, { color: tint.fg }]} numberOfLines={height > 44 ? 2 : 1}>
                      {s.entry.name}
                    </Text>
                    {height > 34 ? (
                      <Text style={[styles.blockMeta, { color: tint.fg }]} numberOfLines={1}>
                        {days.length > 1 ? time : `${time} · ${s.entry.site}`}
                      </Text>
                    ) : null}
                    {height > 64 && days.length > 1 ? (
                      <Text style={[styles.blockMeta, { color: tint.fg }]} numberOfLines={1}>
                        {s.entry.site}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {c.day === today && nowMinutes !== null ? (
                <View testID="now-line" pointerEvents="none" style={[styles.nowLine, { top: (nowMinutes / 60) * HOUR_HEIGHT }]}>
                  <View style={styles.nowDot} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** An all-day run: a one-line pill in the strip over the grid. */
function EntryPill({ entry, label }: { entry: CalendarEntry; label: string }) {
  const tint = tintOf(entry.color);
  return (
    <Pressable
      testID={`block-${entry.id}`}
      accessibilityRole={entry.target ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!entry.target}
      onPress={() => openEntry(entry)}
      style={({ pressed }) => [styles.pill, { backgroundColor: tint.bg, borderLeftColor: entry.color }, pressed && styles.pressed]}
    >
      <Text style={[styles.blockTitle, { color: tint.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', flex: 1 },
  headRow: { flexDirection: 'row', paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headCell: { flex: 1, alignItems: 'center', gap: 2 },
  headDay: { fontFamily: font, fontSize: 12, color: colors.muted, },
  headToday: { color: colors.primary, fontWeight: '600' },
  headNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headNumOn: { backgroundColor: colors.primary },
  headNumText: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  headNumTextOn: { color: colors.primaryText },
  allDayRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  allDayCell: { flex: 1, gap: 2, paddingHorizontal: 1 },
  gutterText: { fontFamily: font, fontSize: 11, color: colors.muted, paddingRight: 6, textAlign: 'right' },
  hourLabel: { position: 'absolute', right: 0, lineHeight: 16 },
  column: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  hourLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  block: { position: 'absolute', borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 5, paddingVertical: 3, overflow: 'hidden', borderWidth: 1, borderColor: colors.surface },
  pill: { borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 5, paddingVertical: 3 },
  pressed: { opacity: 0.7 },
  blockTitle: { fontFamily: font, fontSize: 13, lineHeight: 16, fontWeight: '600' },
  blockMeta: { fontFamily: font, fontSize: 11, lineHeight: 14 },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.danger },
  nowDot: { position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
});
