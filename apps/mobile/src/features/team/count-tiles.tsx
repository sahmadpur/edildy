import type { ReportSummary } from '@edildy/contracts';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/lib/theme';
import { percentText } from './team-format';
import { notCompleted } from './team-rules';

/**
 * Spec §7.1 (FR-16.03): completed, not completed, overdue, partial, with problems, completion %. One quiet strip of
 * numbers between hairlines, as on Home (three to a line, since six do not fit a phone's width); a number takes its
 * colour only when it is not zero.
 */
export function CountTiles({ summary }: { summary: ReportSummary }) {
  const { t } = useTranslation();
  const c = summary.counts;
  const tiles = [
    { key: 'completed', label: t('reports.counts.completed'), n: c.completed, value: String(c.completed), color: colors.successText },
    { key: 'notCompleted', label: t('reports.notCompleted'), n: notCompleted(c), value: String(notCompleted(c)), color: colors.text },
    { key: 'overdue', label: t('reports.counts.overdue'), n: c.overdue, value: String(c.overdue), color: colors.dangerText },
    { key: 'partial', label: t('reports.counts.partial'), n: c.partial, value: String(c.partial), color: colors.warningText },
    { key: 'withProblems', label: t('reports.counts.withProblems'), n: c.withProblems, value: String(c.withProblems), color: colors.dangerText },
    {
      key: 'completionPercent',
      label: t('reports.measures.completionPercent'),
      n: summary.completionPercent ?? 0,
      value: percentText(t, summary.completionPercent),
      color: colors.primary,
    },
  ];
  return (
    <View style={styles.strip}>
      {tiles.map((tile) => (
        <View key={tile.key} testID={`tile-${tile.key}`} accessible accessibilityLabel={`${tile.label}: ${tile.value}`} style={styles.stat}>
          <Text style={[styles.value, { color: tile.n ? tile.color : colors.muted }]}>{tile.value}</Text>
          <Text style={styles.label}>{tile.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
  },
  stat: { width: '33.333%', gap: 2, paddingRight: spacing.sm },
  value: { fontFamily: font, fontSize: 26, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  label: { fontFamily: font, fontSize: 12, lineHeight: 16, color: colors.muted },
});
