import type { ProblemReportDto } from '@taskop/contracts';
import { formatDateTime } from '@taskop/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { useLocale } from '@/lib/language';
import { colors, font, spacing, type } from '@/lib/theme';
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
  // A small dot before the text carries the colour that used to be a thick left edge.
  const dot = r.state === 'resolved' ? colors.success : r.severity === 'critical' ? colors.danger : colors.warning;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={r.text}
      testID={`report-${r.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.name}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.title} numberOfLines={2}>
          {r.text}
        </Text>
      </View>
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
  card: { minHeight: 44, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  pressed: { backgroundColor: colors.fill },
  // The dot sits on the first line of a two-line title.
  name: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  title: { fontFamily: font, fontSize: type.md, lineHeight: 23, fontWeight: '600', color: colors.text, flexShrink: 1 },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted, marginLeft: 16 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginLeft: 16, marginTop: 2 },
});
