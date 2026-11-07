import { formatDateTime } from '@taskop/i18n';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArchiveHeader } from '@/components/archive-header';
import { StatusChip } from '@/components/chip';
import { FormError, mobileErrorText } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { ReadOnlyAnswers, ReadOnlyProblems } from '@/features/execution/answer-view';
import { leaveRun } from '@/features/execution/run-nav';
import { percentText } from '@/features/team/team-format';
import { useLocale } from '@/lib/language';
import { api } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { useSyncStatus } from '@/offline/hooks';

const loadMedia = (id: string) => api.media.url(id);

/** An older finished run from the archive (Nov 2026 feedback point 7): online, read-only, only a way back. */
export function ArchiveRunScreen({ executionId }: { executionId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { timeZone } = useOffline();
  const { online } = useSyncStatus();
  const q = useQuery({ queryKey: ['archive-run', executionId], queryFn: () => api.executions.get(executionId), enabled: online });
  const d = q.data;
  return (
    <SafeAreaView style={styles.safe}>
      <ArchiveHeader
        title={d?.occurrence.checklistName ?? t('mobile.home.archive.title')}
        subtitle={d ? `${t('mobile.home.archive.subtitle', { date: formatDateTime(d.completedAt ?? d.occurrence.startsAt, { locale, timeZone }) })} · ${d.occurrence.siteName}` : null}
        onBack={leaveRun}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!online && !d ? <Text style={styles.muted}>{t('mobile.home.archive.offline')}</Text> : null}
        {q.isPending && online ? <ActivityIndicator color={colors.primary} /> : null}
        {q.error ? <FormError message={mobileErrorText(t, q.error)} /> : null}
        {d ? (
          <>
            <View style={styles.summary}>
              <StatusChip tone="success" text={t(`executions.states.${d.state}`)} />
              <Text style={styles.muted}>{`${t('executions.score')}: ${d.scorePercent === null ? t('executions.noScore') : percentText(t, d.scorePercent)}`}</Text>
            </View>
            <ReadOnlyAnswers content={d.content} answers={d.answers} media={d.media} problems={d.problems} load={loadMedia} />
            <ReadOnlyProblems content={d.content} problems={d.problems} media={d.media} load={loadMedia} />
          </>
        ) : null}
        <PrimaryButton variant="outline" title={t('mobile.execution.back')} onPress={leaveRun} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted },
});
