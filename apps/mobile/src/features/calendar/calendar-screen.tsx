import { Ionicons } from '@expo/vector-icons';
import { formatLocalDate, formatShortDate } from '@taskop/i18n';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/tab-header';
import { Segmented } from '@/features/team/team-controls';
import { useLocale } from '@/lib/language';
import { localDate } from '@/lib/time';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { useNow } from '@/offline/hooks';
import { CALENDAR_VIEWS, type CalendarView, columnDays, stepAnchor, viewRange } from './calendar-model';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';
import { useCalendarEntries } from './use-calendar-entries';

/** A sideways swipe this long (px) moves to the previous or next period. */
const SWIPE = 50;

/**
 * Cədvəl (feedback 2026-11-08): my own runs as an Outlook-like calendar — Day and 3-day hour grids and a Month grid
 * with the chosen day's agenda. ‹ › and a sideways swipe move by the view's period; "Bu gün" comes back to today.
 */
export function CalendarScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const services = useOffline();
  const now = useNow();
  const today = localDate(now, services.timeZone);
  const [view, setView] = useState<CalendarView>('day');
  const [anchor, setAnchor] = useState(today);
  const range = viewRange(view, anchor);
  const { entries, fetching, localOnly } = useCalendarEntries(range.from, range.to);

  const step = (dir: -1 | 1) => setAnchor((a) => stepAnchor(view, a, dir, today));
  // The responder is made once; it reads the latest step through a ref.
  const stepRef = useRef(step);
  stepRef.current = step;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -SWIPE) stepRef.current(1);
          else if (g.dx >= SWIPE) stepRef.current(-1);
        },
      }),
    [],
  );

  const days = view === 'month' ? [] : columnDays(view, anchor);
  const label =
    view === 'day'
      ? formatLocalDate(anchor, locale, { weekday: true })
      : view === 'threeDays'
        ? `${formatShortDate(days[0]!, locale)} – ${formatShortDate(days[2]!, locale)}`
        : `${t(`mobile.calendar.months.m${Number(anchor.slice(5, 7))}`)} ${anchor.slice(0, 4)}`;
  const options = CALENDAR_VIEWS.map((key) => ({ key, label: t(`mobile.calendar.${key}`) }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <TabHeader title={t('mobile.tabs.calendar')} />
        <Segmented options={options} value={view} onChange={setView} />
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('mobile.calendar.prev')} testID="calendar-prev" onPress={() => step(-1)} hitSlop={8} style={styles.arrow}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text testID="calendar-label" style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {label}
          </Text>
          {/* A fixed slot, so the row does not shift while the server part loads. */}
          <View style={styles.spinner}>{fetching ? <ActivityIndicator size="small" color={colors.muted} /> : null}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('mobile.calendar.next')} testID="calendar-next" onPress={() => step(1)} hitSlop={8} style={styles.arrow}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" testID="calendar-today" onPress={() => setAnchor(today)} style={({ pressed }) => [styles.today, pressed && styles.pressed]}>
            <Text style={styles.todayText}>{t('mobile.calendar.today')}</Text>
          </Pressable>
        </View>
        {localOnly ? (
          <Text testID="calendar-offline" style={styles.note}>
            {t('mobile.calendar.offline')}
          </Text>
        ) : null}
      </View>
      <View style={styles.body} {...pan.panHandlers}>
        {!entries ? (
          <ActivityIndicator color={colors.primary} />
        ) : view === 'month' ? (
          <MonthView selected={anchor} today={today} entries={entries} timeZone={services.timeZone} onSelect={setAnchor} />
        ) : (
          <TimeGrid days={days} entries={entries} today={today} now={now} timeZone={services.timeZone} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 20, paddingTop: spacing.sm, gap: spacing.sm },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill },
  label: { flex: 1, textAlign: 'center', fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  today: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: 18, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, marginLeft: spacing.xs },
  todayText: { fontFamily: font, fontSize: type.sm, fontWeight: '600', color: colors.primary },
  pressed: { opacity: 0.6 },
  spinner: { width: 20, alignItems: 'center' },
  note: { fontFamily: font, fontSize: type.sm, color: colors.warningText },
  body: { flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
});
