import type { ProblemReportDto } from '@taskop/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { mobileErrorText } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TabHeader } from '@/components/tab-header';
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
      <TabHeader title={t('mobile.problems.title')} />
      {sites && sites.length === 0 ? <Text style={styles.subtitle}>{t('mobile.problems.noSites')}</Text> : null}
      {sites && sites.length > 0 ? (
        <PrimaryButton title={`+ ${t('mobile.problems.report')}`} accessibilityLabel={t('mobile.problems.report')} onPress={() => router.push({ pathname: '/problems/new', params: { n: services.newId() } })} />
      ) : null}
      {all ? (
        <Segments
          options={[
            { key: 'mine', label: t('mobile.problems.mine') },
            { key: 'all', label: t('mobile.problems.all') },
          ]}
          value={segment}
          onChange={setSegment}
        />
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
      <Segments options={REPORT_FILTERS.map((f) => ({ key: f, label: t(`mobile.problems.filters.${f}`) }))} value={filter} onChange={setFilter} />
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

/** A segmented control: a quiet grey track, the chosen segment white. Each segment is a radio for a screen reader. */
function Segments<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (key: K) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.segments}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(o.key)}
            hitSlop={{ top: 5, bottom: 5 }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontFamily: font, fontSize: type.base, lineHeight: 21, color: colors.muted },
  segments: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 10, padding: 3 },
  segment: { flex: 1, minHeight: 34, paddingHorizontal: spacing.sm, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface, shadowColor: colors.text, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontFamily: font, fontSize: type.sm, fontWeight: '500', color: colors.muted },
  segmentTextOn: { color: colors.text, fontWeight: '600' },
  group: { gap: spacing.sm },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
  warning: { fontFamily: font, fontSize: type.base, color: colors.dangerText },
});
