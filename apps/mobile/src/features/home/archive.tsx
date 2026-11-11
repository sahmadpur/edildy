import { type OccurrenceDto, OCCURRENCE_STATUSES } from '@edildy/contracts';
import { formatDateTime } from '@edildy/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { FormError, mobileErrorText } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { percentText } from '@/features/team/team-format';
import { useLocale } from '@/lib/language';
import { api, useSession } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import { useSyncStatus } from '@/offline/hooks';

/** What counts as finished in the archive; `/me/occurrences` takes them comma-separated. */
const FINISHED = ['completed', 'partial', 'audit_pending', 'audited', 'correction_required'] satisfies (typeof OCCURRENCE_STATUSES)[number][];
/** One request window: under the API's 62-day list limit. */
const WINDOW_DAYS = 31;
/** Empty windows read in a row before the archive says there is nothing older (about a year). */
const MAX_EMPTY_WINDOWS = 12;

/** `YYYY-MM-DD` moved by whole days, on the calendar (no time zone involved). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function windowRows(from: string, to: string): Promise<OccurrenceDto[]> {
  const rows: OccurrenceDto[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.occurrences.mine({ from, to, status: FINISHED.join(','), limit: 200, ...(cursor ? { cursor } : {}) });
    rows.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

interface State {
  rows: OccurrenceDto[];
  /** The next window ends the day before this one. */
  before: string;
  loading: boolean;
  exhausted: boolean;
  error: unknown;
}

/**
 * Nov 2026 feedback point 7: the full archive. The phone holds about a week of runs; older ones are paged from
 * GET /me/occurrences a month at a time, online only, newest first, skipping what the local list already shows.
 */
export function ArchiveMore({ knownIds, today, timeZone }: { knownIds: ReadonlySet<string>; today: string; timeZone: string }) {
  const { t } = useTranslation();
  const { online } = useSyncStatus();
  const session = useSession();
  const myName = session.status === 'authenticated' ? session.me.user.fullName : '';
  const [s, setS] = useState<State>({ rows: [], before: shiftDate(today, 1), loading: false, exhausted: false, error: null });

  const load = async () => {
    setS((x) => ({ ...x, loading: true, error: null }));
    let before = s.before;
    let found: OccurrenceDto[] = [];
    let empty = 0;
    try {
      while (found.length === 0 && empty < MAX_EMPTY_WINDOWS) {
        const to = shiftDate(before, -1);
        const from = shiftDate(to, -(WINDOW_DAYS - 1));
        const seen = new Set(s.rows.map((r) => r.id));
        found = (await windowRows(from, to)).filter((r) => r.executionBrief && !knownIds.has(r.id) && !seen.has(r.id));
        before = from;
        if (found.length === 0) empty += 1;
      }
      found.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
      setS((x) => ({ rows: [...x.rows, ...found], before, loading: false, exhausted: found.length === 0, error: null }));
    } catch (error) {
      setS((x) => ({ ...x, loading: false, error }));
    }
  };

  return (
    <View style={styles.wrap}>
      {s.rows.map((r) => (
        <ArchiveRow key={r.id} row={r} timeZone={timeZone} myName={myName} />
      ))}
      {s.error ? <FormError message={mobileErrorText(t, s.error)} /> : null}
      {s.loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : s.exhausted ? (
        <Text style={styles.muted}>{t('mobile.home.archive.none')}</Text>
      ) : online ? (
        <PrimaryButton variant="outline" title={t('mobile.home.archive.more')} onPress={() => void load()} testID="archive-more" />
      ) : (
        <Text style={styles.muted}>{t('mobile.home.archive.offline')}</Text>
      )}
    </View>
  );
}

/**
 * GET /me/occurrences also lists runs assigned to me that a colleague did, but GET /executions/:id answers 404 to a
 * worker who is not the executor: those rows say who did them and do not open (the brief carries the name, not the id).
 */
function ArchiveRow({ row, timeZone, myName }: { row: OccurrenceDto; timeZone: string; myName: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const brief = row.executionBrief!;
  const mine = brief.executorName === myName;
  return (
    <Pressable
      accessibilityRole={mine ? 'button' : undefined}
      accessibilityLabel={`${row.checklistName}, ${row.siteName}`}
      testID={`archive-${row.id}`}
      disabled={!mine}
      onPress={() => router.push({ pathname: '/archive/[id]', params: { id: brief.executionId } })}
      style={({ pressed }) => [styles.card, mine && pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.name}>
          <View style={styles.dot} />
          <Text style={styles.title} numberOfLines={1}>
            {row.checklistName}
          </Text>
        </View>
        <Text style={styles.site} numberOfLines={1}>
          {row.siteName}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.mutedIndented}>{formatDateTime(row.startsAt, { locale, timeZone })}</Text>
        {brief.scorePercent !== null ? <Text style={styles.mutedIndented}>{percentText(t, brief.scorePercent)}</Text> : null}
      </View>
      {mine ? null : <Text style={styles.mutedIndented}>{t('mobile.checklists.doneBy', { name: brief.executorName })}</Text>}
      <View style={styles.badges}>
        <StatusChip tone="success" text={t(`executions.states.${brief.state}`)} />
        {brief.late ? <StatusChip tone="warning" text={t('executions.flags.late')} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  pressed: { backgroundColor: colors.fill },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  name: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text, flexShrink: 1 },
  site: { fontFamily: font, fontSize: type.sm, color: colors.muted, maxWidth: '55%', lineHeight: 22 },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted, textAlign: 'center' },
  mutedIndented: { fontFamily: font, fontSize: type.sm, color: colors.muted, marginLeft: 16 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginLeft: 16 },
});
