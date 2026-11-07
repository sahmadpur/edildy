import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, type } from '@/lib/theme';
import { useSyncStatus } from '@/offline/hooks';
import { type Indicator, indicatorOf } from '@/offline/sync-engine';

/** The dot carries the state; the words stay quiet grey unless something needs the worker (pending, offline, failed). */
const TONE: Record<Indicator, { dot: string; fg: string }> = {
  synced: { dot: colors.success, fg: colors.muted },
  pending: { dot: colors.warning, fg: colors.warningText },
  offline: { dot: colors.warning, fg: colors.warningText },
  failed: { dot: colors.danger, fg: colors.dangerText },
};

/**
 * Spec §7.3: green (all synced), amber "N gözləyir" (offline or pending), red (failed). Opens the queue.
 * A small dot and the words, no filled pill. `compact` (the Home header) shows only the dot; the words stay in the accessibility label.
 */
export function SyncIndicator({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useTranslation();
  const status = useSyncStatus();
  const state = indicatorOf(status);
  const label =
    state === 'synced'
      ? t('mobile.sync.synced')
      : state === 'pending'
        ? t('mobile.sync.pending', { count: status.pending })
        : state === 'offline'
          ? t('mobile.sync.offline')
          : t('mobile.sync.failed', { count: status.failed });
  if (compact) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} testID={`sync-indicator-${state}`} onPress={() => router.push('/sync')} style={styles.compact}>
        <View style={[styles.bigDot, { backgroundColor: TONE[state].dot }]} />
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`sync-indicator-${state}`}
      onPress={() => router.push('/sync')}
      hitSlop={{ left: 8, right: 8 }}
      style={({ pressed }) => [styles.inline, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: TONE[state].dot }]} />
      <Text style={[styles.text, { color: TONE[state].fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inline: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 },
  pressed: { opacity: 0.6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  compact: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bigDot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontFamily: font, fontSize: type.sm, fontWeight: '500' },
});
