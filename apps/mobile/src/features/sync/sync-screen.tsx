import { formatDateTime } from '@edildy/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/features/tasks/screen-header';
import { colors, font, spacing, type } from '@/lib/theme';
import { isClockSkewed } from '@/offline/clock';
import { useOffline } from '@/offline/context';
import { useLiveQuery, useSyncStatus } from '@/offline/hooks';
import { mediaErrorKey } from '@/offline/media-queue';
import { listCommands } from '@/offline/outbox';
import { useLocale } from '@/lib/language';

interface Row {
  key: string;
  title: string;
  error: string | null;
  /** Only failed rows can be discarded. */
  discard: { body: string; run: () => Promise<void> } | null;
}

/**
 * FR-10.15: what is waiting, what failed and why, and "Yenidən cəhd et". A failed row that retrying does not fix can
 * be discarded ("Sil", after a confirmation), so nothing stays red for good.
 */
export function SyncScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const services = useOffline();
  const status = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const queue = useLiveQuery(async (s) => ({ commands: await listCommands(s.db), media: await s.mediaQueue.list() }), []);
  const name = (n: string | null) => n ?? '—';
  const rows: Row[] = [
    ...(queue?.commands ?? []).map((c) => ({
      key: `c${c.seq}`,
      title: `${t(`mobile.sync.kinds.${c.kind}`)} · ${name(c.title)}`,
      error: c.status === 'failed' ? t(c.errorKey ?? 'errors.INTERNAL', { requestId: '—' }) : null,
      discard:
        c.status === 'failed'
          ? { body: t(c.kind === 'claim' ? 'mobile.sync.discardClaimBody' : 'mobile.sync.discardBody'), run: () => services.engine.discardCommand(c.seq) }
          : null,
    })),
    ...(queue?.media ?? []).map((m) => ({
      key: `m${m.id}`,
      title: `${t('mobile.sync.kinds.upload')} · ${name(m.title)}`,
      error: m.failedCode ? t(mediaErrorKey(m.failedCode)) : null,
      discard: m.failedCode
        ? {
            body: t('mobile.sync.discardBody'),
            run: async () => {
              await services.mediaQueue.discard(m.id);
              await services.engine.refresh();
            },
          }
        : null,
    })),
  ];

  const confirmDiscard = (row: Row) => {
    const discard = row.discard;
    if (!discard) return;
    Alert.alert(t('mobile.sync.discardTitle'), discard.body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mobile.sync.discard'),
        style: 'destructive',
        onPress: () =>
          void discard.run().catch((e: unknown) => {
            console.error('[sync] Could not discard', e instanceof Error ? e.message : 'unknown error');
            Alert.alert(t('errors.INTERNAL', { requestId: '—' }));
          }),
      },
    ]);
  };

  const retry = async () => {
    setBusy(true);
    try {
      await services.engine.retryFailed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('mobile.sync.title')} />
      <Text style={styles.muted}>
        {status.lastSyncedAt
          ? t('mobile.sync.lastSynced', { time: formatDateTime(status.lastSyncedAt, { locale, timeZone: services.timeZone }) })
          : t('mobile.sync.never')}
      </Text>
      {isClockSkewed(status.clockOffsetMs) ? (
        <Text style={styles.warning}>{t('mobile.sync.clockSkew', { minutes: Math.round(Math.abs(status.clockOffsetMs) / 60_000) })}</Text>
      ) : null}
      {status.blockedByAuth ? <Text style={styles.warning}>{t('mobile.sync.signInAgain')}</Text> : null}
      {rows.length === 0 ? (
        <Text style={styles.muted}>{t('mobile.sync.empty')}</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={[styles.dot, row.error ? styles.dotFailed : null]} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                {row.error ? <Text style={styles.error}>{row.error}</Text> : <Text style={styles.muted}>{t('mobile.sync.states.pending')}</Text>}
              </View>
              {row.discard ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('mobile.sync.discard')}: ${row.title}`}
                  onPress={() => confirmDiscard(row)}
                  style={({ pressed }) => [styles.discard, pressed && styles.pressed]}
                >
                  <Text style={styles.discardText}>{t('mobile.sync.discard')}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
      <PrimaryButton variant={rows.length === 0 ? 'outline' : 'primary'} title={t('mobile.sync.retry')} onPress={() => void retry()} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  // A real alert (a skewed clock, a lost sign-in): the one place a tinted background is used.
  warning: { fontFamily: font, fontSize: type.base, color: colors.warningText, backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, overflow: 'hidden' },
  // Plain rows between hairlines.
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  dotFailed: { backgroundColor: colors.danger },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: font, fontSize: type.base, fontWeight: '500', color: colors.text },
  error: { fontFamily: font, fontSize: type.sm, color: colors.dangerText },
  discard: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, marginRight: -spacing.sm, borderRadius: 10 },
  pressed: { backgroundColor: colors.fill },
  discardText: { fontFamily: font, fontSize: type.base, color: colors.dangerText, fontWeight: '600' },
});
