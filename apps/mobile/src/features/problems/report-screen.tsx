import { PROBLEM_REPORT_LIMITS, type ProblemReportDto } from '@taskop/contracts';
import { formatDateTime } from '@taskop/i18n';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { FormError, mobileErrorText } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { notAcceptedText } from '@/features/sync/refusal-text';
import { RemoteMediaStrip } from '@/features/tasks/remote-media';
import { ScreenHeader } from '@/features/tasks/screen-header';
import { useLocale } from '@/lib/language';
import { api, useSession } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { useLiveQuery, useSyncStatus } from '@/offline/hooks';
import type { LocalMedia } from '@/offline/local-model';
import { mapsUrl } from './maps-link';
import { STATE_TONES } from './problem-rules';

interface Props {
  id: string;
  /** The report came from "Hamısı": it is read from the API, not from the phone. */
  remote: boolean;
}

/** 2026-11-06 design §7.5: one report; a worker reads it, a manager online may make a task from it or close it. */
export function ReportScreen({ id, remote }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const services = useOffline();
  const { online } = useSyncStatus();
  const session = useSession();
  const canManage = session.status === 'authenticated' && session.me.permissions.includes('tasks.manage');
  const local = useLiveQuery(async (s) => (remote ? null : { report: await s.reports.report(id), media: await s.reports.media(id) }), [id, remote]);
  const [fetched, setFetched] = useState<ProblemReportDto | null | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!remote) return;
    let alive = true;
    api.problemReports.get(id).then(
      (r) => {
        if (alive) setFetched(r);
      },
      () => {
        if (alive) setFetched(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [id, remote]);

  const report: ProblemReportDto | null | undefined = remote ? fetched : local === undefined ? undefined : (local?.report?.server ?? null);
  if (report === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (report === null) {
    return (
      <Screen>
        <ScreenHeader title={t('mobile.problems.title')} />
        <Text style={styles.muted}>{t('mobile.problems.detail.notFound')}</Text>
      </Screen>
    );
  }
  const own = remote ? null : local!.report!;
  const localMedia: LocalMedia[] = local?.media ?? [];
  const pendingLocal = localMedia.filter((m) => m.uploadedAt === null && m.fileDeletedAt === null);
  const notes = own ? [own.syncNote, own.failedKey].filter((k): k is string => k !== null).map((k) => notAcceptedText(t, k)) : [];
  // Not on the phone's own draft: the server does not know it yet (or refused it), so a task or a close would 404.
  const actions = canManage && online && report.state === 'open' && (own === null || own.localStatus === 'sent');

  return (
    <Screen>
      <ScreenHeader title={t('mobile.problems.title')} />
      <View style={styles.badges}>
        <StatusChip text={t(`mobile.problems.states.${report.state}`)} tone={STATE_TONES[report.state]} />
        <StatusChip text={t(`executions.severities.${report.severity}`)} tone={report.severity === 'critical' ? 'danger' : 'warning'} />
        {own?.failedKey ? <StatusChip text={t('mobile.problems.syncFailed')} tone="danger" /> : own?.unsynced ? <StatusChip text={t('mobile.problems.syncPending')} tone="warning" /> : null}
      </View>
      {notes.map((n, i) => (
        <Text key={i} style={styles.warning}>
          {n}
        </Text>
      ))}
      <Text style={styles.text}>{report.text}</Text>
      <View style={styles.facts}>
        <Fact label={t('mobile.tasks.create.site')} value={report.siteName} />
        <Fact label={t('mobile.problems.detail.reporter')} value={report.reporter.fullName} />
        <Fact label={t('mobile.problems.detail.reportedAt')} value={formatDateTime(report.reportedAt, { locale, timeZone: services.timeZone })} />
      </View>
      {report.location ? (
        <PrimaryButton variant="outline" title={t('mobile.problems.detail.openMap')} onPress={() => void Linking.openURL(mapsUrl(report.location!.lat, report.location!.lng))} />
      ) : (
        <Text style={styles.muted}>{t('mobile.problems.location.unknown')}</Text>
      )}
      {pendingLocal.length > 0 ? (
        <View style={styles.strip}>
          {pendingLocal.map((m, i) => (
            <View key={m.id} testID={`local-media-${i}`} style={styles.thumb}>
              {m.kind === 'photo' ? <Image source={{ uri: m.localUri }} style={styles.thumb} /> : <Text style={styles.play}>▶</Text>}
            </View>
          ))}
        </View>
      ) : null}
      <RemoteMediaStrip items={report.media.filter((m) => !pendingLocal.some((p) => p.id === m.id))} load={(mediaId) => api.problemReportMedia.url(mediaId)} />
      {report.closedAt ? (
        <Text style={styles.text}>{t('mobile.problems.detail.closedBy', { name: report.closedBy?.fullName ?? '', comment: report.closeComment ?? '' })}</Text>
      ) : null}
      {report.taskId ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('mobile.problems.detail.task')} onPress={() => router.push({ pathname: '/task/[id]', params: { id: report.taskId! } })} style={styles.taskRow}>
          <Text style={styles.link}>{`${t('mobile.problems.detail.task')}: ${report.taskStatus ? t(`tasks.statuses.${report.taskStatus}`) : ''}`}</Text>
        </Pressable>
      ) : null}
      {actions ? (
        <View style={styles.actions}>
          <PrimaryButton title={t('mobile.problems.detail.createTask')} onPress={() => router.push({ pathname: '/task/new', params: { n: services.newId(), problemReportId: id } })} />
          <PrimaryButton variant="outline" title={t('mobile.problems.detail.close')} onPress={() => setClosing(true)} />
        </View>
      ) : null}
      {closing ? (
        <CloseSheet
          onClose={() => setClosing(false)}
          onClosed={(r) => {
            setClosing(false);
            setFetched(r);
            void services.syncNow('manual');
          }}
          id={id}
        />
      ) : null}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

/** The close comment (1–1,000 characters), sent to the reporter with the notification. */
function CloseSheet({ id, onClose, onClosed }: { id: string; onClose: () => void; onClosed: (r: ProblemReportDto) => void }) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const save = async () => {
    if (inFlight.current) return;
    const text = comment.trim();
    if (!text) {
      setError(t('mobile.problems.detail.closeCommentRequired'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      onClosed(await api.problemReports.close(id, { comment: text }));
    } catch (e) {
      setError(mobileErrorText(t, e));
      inFlight.current = false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>{t('executions.reportsTab.closeTitle')}</Text>
          <Text style={styles.label}>{t('mobile.problems.detail.closeComment')}</Text>
          <TextInput
            accessibilityLabel={t('mobile.problems.detail.closeComment')}
            value={comment}
            onChangeText={(v) => {
              setError(null);
              setComment(v);
            }}
            multiline
            maxLength={PROBLEM_REPORT_LIMITS.closeCommentMax}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <FormError message={error} />
          <View style={styles.actions}>
            <PrimaryButton variant="outline" title={t('common.cancel')} onPress={onClose} disabled={busy} />
            <PrimaryButton title={t('mobile.problems.detail.close')} accessibilityLabel={t('executions.reportsTab.closeTitle')} onPress={() => void save()} disabled={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  text: { fontFamily: font, fontSize: type.base, color: colors.text },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
  warning: { fontFamily: font, fontSize: type.base, color: colors.dangerText },
  label: { fontFamily: font, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  facts: { gap: spacing.xs },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  play: { fontSize: 24, color: colors.text },
  link: { fontFamily: font, fontSize: type.base, color: colors.primaryDeep, fontWeight: '600' },
  taskRow: { minHeight: 44, justifyContent: 'center' },
  actions: { gap: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.4)' },
  sheet: { flexGrow: 0, maxHeight: '90%', backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetContent: { padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { fontFamily: font, fontSize: type.lg, fontWeight: '700', color: colors.text },
  input: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, fontSize: 16, backgroundColor: colors.surface, color: colors.text, textAlignVertical: 'top' },
});
