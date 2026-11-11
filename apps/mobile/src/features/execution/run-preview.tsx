import { visibleItems } from '@edildy/contracts';
import { formatDateTime } from '@edildy/i18n';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArchiveHeader } from '@/components/archive-header';
import { PrimaryButton } from '@/components/primary-button';
import { useStartOccurrence } from '@/features/home/use-start-occurrence';
import { useLocale } from '@/lib/language';
import { formatTime, localDate } from '@/lib/time';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { useLiveQuery, useNow } from '@/offline/hooks';
import { ItemField } from './item-field';
import { leaveRun } from './run-nav';

const NO_MEDIA = new Map();
const noop = () => undefined;

/**
 * Nov 2026 feedback point 12: a run with no execution on this phone (Gələcək) opens read-only — every section and
 * question as the worker will see them, no answers, no ⚑, nothing to finish. Once it opens, a Start button appears;
 * starting creates the execution and this same route turns into the run (the screen resolves it from the occurrence).
 */
export function RunPreview({ occurrenceId }: { occurrenceId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { timeZone } = useOffline();
  const now = useNow();
  const start = useStartOccurrence();
  const data = useLiveQuery(
    async ({ store }) => {
      const o = (await store.occurrences()).find((x) => x.id === occurrenceId);
      if (!o) return null;
      return { occurrence: o, content: await store.content(o.checklistVersionId) };
    },
    [occurrenceId],
  );
  if (data === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }
  if (data === null) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.muted}>{t('mobile.execution.notFound')}</Text>
        <PrimaryButton variant="outline" title={t('mobile.execution.back')} onPress={leaveRun} />
      </SafeAreaView>
    );
  }
  const { occurrence: o } = data;
  const content = data.content.kind === 'ok' ? data.content.content : null;
  const notYet = now < Date.parse(o.startsAt);
  const openNow = !notYet && now < Date.parse(o.closesAt) && !o.claim;
  // Today: the time alone; another day: the date too ("8 Noy 2026, 09:30").
  const opensToday = localDate(Date.parse(o.startsAt), timeZone) === localDate(now, timeZone);

  return (
    <SafeAreaView style={styles.safe}>
      <ArchiveHeader title={o.checklistName} subtitle={`${formatDateTime(o.startsAt, { locale, timeZone })} · ${o.siteName}`} onBack={leaveRun} />
      <View testID="preview-banner" style={[styles.banner, openNow && styles.bannerOpen]}>
        <Text style={[styles.bannerText, openNow && styles.bannerTextOpen]}>
          {notYet ? t('mobile.execution.previewBanner', { time: opensToday ? formatTime(o.startsAt, timeZone, locale) : formatDateTime(o.startsAt, { locale, timeZone }) }) : t('mobile.execution.previewOpen')}
        </Text>
        {openNow ? <PrimaryButton title={t('mobile.checklists.start')} onPress={() => void start(o, { replace: true })} /> : null}
      </View>
      <ScrollView testID="preview-scroll" contentContainerStyle={styles.content}>
        {content ? (
          content.sections.map((section, n) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.muted}>{t('mobile.execution.section', { n: n + 1, total: content.sections.length })}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.instructions ? <Text style={styles.muted}>{section.instructions}</Text> : null}
              {visibleItems(content, {})
                .filter((v) => v.sectionId === section.id)
                .map(({ item, depth }) => (
                  <View key={item.id} style={{ marginLeft: depth * spacing.md }}>
                    <ItemField
                      item={item}
                      answer={undefined}
                      missing={[]}
                      hasProblem={false}
                      refused={[]}
                      readOnly
                      media={NO_MEDIA}
                      onPatch={noop}
                      onCapture={noop}
                      onRemoveMedia={noop}
                      onOpenVideo={noop}
                      onFlag={noop}
                    />
                  </View>
                ))}
            </View>
          ))
        ) : (
          <Text style={styles.muted}>{t(data.content.kind === 'needsUpdate' ? 'mobile.execution.needsUpdate' : 'mobile.checklists.startBlocked.notDownloaded')}</Text>
        )}
        <PrimaryButton variant="outline" title={t('mobile.execution.back')} onPress={leaveRun} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  banner: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: 12, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.plannedSoft },
  bannerOpen: { backgroundColor: colors.primarySoft },
  bannerText: { fontFamily: font, fontSize: type.base, color: colors.plannedText, fontWeight: '500' },
  bannerTextOpen: { color: colors.primaryDeep },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  section: { gap: spacing.md },
  sectionTitle: { fontFamily: font, fontSize: type.lg, fontWeight: '600', color: colors.text, marginTop: -spacing.sm },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted },
});
