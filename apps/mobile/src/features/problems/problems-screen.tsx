import type { ProblemReportDto } from '@taskop/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { mobileErrorText } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { Choice } from '@/features/execution/parts';
import { SyncIndicator } from '@/features/sync/sync-indicator';
import { api, useSession } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { useLiveQuery, useSyncStatus } from '@/offline/hooks';
import { canSeeAllReports, type ReportFilter, REPORT_FILTERS } from './problem-rules';
import { ReportRow } from './report-row';

const PAGE = 30;

/** 2026-11-06 design §7.5: the Problemlər tab. "Mənim" is the phone's own reports; "Hamısı" (managers) reads the scope from the API. */
export function ProblemsScreen() {
  const { t } = useTranslation();
  const services = useOffline();
  const { online } = useSyncStatus();
  const session = useSession();
  const me = session.status === 'authenticated' ? session.me : null;
  const all = me !== null && canSeeAllReports(me);
  const [segment, setSegment] = useState<'mine' | 'all'>('mine');
  const mine = useLiveQuery((s) => s.reports.reports(), []);
  const sites = useLiveQuery((s) => s.reports.sites(), []);
  const open = (r: ProblemReportDto, remote: boolean) => router.push({ pathname: '/problems/[id]', params: remote ? { id: r.id, remote: '1' } : { id: r.id } });

  return (
    <Screen>
      <View style={styles.top}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('mobile.problems.title')}
        </Text>
        <SyncIndicator compact />
      </View>
      {sites === undefined ? null : sites.length === 0 ? (
        <Text style={styles.muted}>{t('mobile.problems.noSites')}</Text>
      ) : (
        <PrimaryButton title={`+ ${t('mobile.problems.report')}`} accessibilityLabel={t('mobile.problems.report')} onPress={() => router.push({ pathname: '/problems/new', params: { n: services.newId() } })} />
      )}
      {all ? (
        <View style={styles.row}>
          <Choice role="radio" label={t('mobile.problems.mine')} selected={segment === 'mine'} onPress={() => setSegment('mine')} />
          <Choice role="radio" label={t('mobile.problems.all')} selected={segment === 'all'} onPress={() => setSegment('all')} />
        </View>
      ) : null}
      {segment === 'mine' ? (
        mine === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : mine.length === 0 ? (
          <Text style={styles.muted}>{t('mobile.problems.empty')}</Text>
        ) : (
          mine.map((r) => <ReportRow key={r.id} report={r.server} unsynced={r.unsynced} failedKey={r.failedKey} timeZone={services.timeZone} onPress={() => open(r.server, false)} />)
        )
      ) : (
        <AllReports online={online} timeZone={services.timeZone} onOpen={(r) => open(r, true)} />
      )}
    </Screen>
  );
}

/** "Hamısı": the reports in the manager's scope, by state, 30 at a time; needs a connection. */
function AllReports({ online, timeZone, onOpen }: { online: boolean; timeZone: string; onOpen: (r: ProblemReportDto) => void }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<ReportFilter>('active');
  const [items, setItems] = useState<ProblemReportDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (state: ReportFilter, after: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const page = await api.problemReports.list({ state, limit: PAGE, ...(after ? { cursor: after } : {}) });
      setItems((xs) => (after ? [...(xs ?? []), ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (e) {
      setError(mobileErrorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!online) return;
    setItems(null);
    void load(filter, null);
    // The filter is the only input; `load` is a new closure on every render. The repo's ESLint has no react-hooks plugin.
  }, [online, filter]);

  if (!online) return <Text style={styles.muted}>{t('mobile.problems.online')}</Text>;
  return (
    <View style={styles.group}>
      <View style={styles.row}>
        {REPORT_FILTERS.map((f) => (
          <Choice key={f} role="radio" label={t(`mobile.problems.filters.${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {items === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>{t('mobile.problems.empty')}</Text>
      ) : (
        items.map((r) => <ReportRow key={r.id} report={r} timeZone={timeZone} onPress={() => onOpen(r)} />)
      )}
      {cursor ? <PrimaryButton variant="outline" title={t('mobile.problems.more')} disabled={busy} onPress={() => void load(filter, cursor)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontFamily: font, fontSize: type.display, fontWeight: '600', color: colors.text, flexShrink: 1, letterSpacing: -0.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: { gap: spacing.sm },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
  warning: { fontFamily: font, fontSize: type.base, color: colors.dangerText },
});
