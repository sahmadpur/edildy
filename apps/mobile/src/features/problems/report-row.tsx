import type { ProblemReportDto } from '@taskop/contracts';
import { formatDateTime } from '@taskop/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { useLocale } from '@/lib/language';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import { STATE_TONES } from './problem-rules';

interface Props {
  report: ProblemReportDto;
  /** Commands of the report are still on the phone (own reports only). */
  unsynced?: boolean;
  failedKey?: string | null;
  timeZone: string;
  onPress: () => void;
}

/** One report on the Problemlər list: the first lines of the text, the site, the time, the state and the sync badge. */
export function ReportRow({ report: r, unsynced = false, failedKey = null, timeZone, onPress }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={r.text}
      testID={`report-${r.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, r.severity === 'critical' && styles.critical, r.state === 'resolved' && styles.resolved, pressed && styles.pressed]}
    >
      <Text style={styles.title} numberOfLines={2}>
        {r.text}
      </Text>
      <Text style={styles.muted}>{`${r.siteName} · ${formatDateTime(r.reportedAt, { locale, timeZone })}`}</Text>
      <View style={styles.badges}>
        <StatusChip text={t(`mobile.problems.states.${r.state}`)} tone={STATE_TONES[r.state]} />
        {r.severity === 'critical' ? <StatusChip text={t('executions.severities.critical')} tone="danger" /> : null}
        {failedKey ? <StatusChip text={t('mobile.problems.syncFailed')} tone="danger" /> : unsynced ? <StatusChip text={t('mobile.problems.syncPending')} tone="warning" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 44, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.border, borderLeftWidth: 5, borderLeftColor: colors.warning, padding: spacing.md, gap: spacing.xs },
  critical: { borderLeftColor: colors.danger },
  resolved: { borderLeftColor: colors.success },
  pressed: { backgroundColor: colors.plannedSoft },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
});
