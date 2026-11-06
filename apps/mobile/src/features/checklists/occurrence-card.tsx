import { formatDateTime } from '@taskop/i18n';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { PrimaryButton } from '@/components/primary-button';
import { notAcceptedText } from '@/features/sync/refusal-text';
import { useLocale } from '@/lib/language';
import { formatTime } from '@/lib/time';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import type { CardModel, GroupKey } from './group-occurrences';

interface Props {
  card: CardModel;
  group: GroupKey;
  timeZone: string;
  onStart: () => void;
  onOpen: () => void;
}

/** One run on the Home list: `name | site` over `window | opening moment`, the chips, and the one action the worker can take. */
export function OccurrenceCard({ card, group, timeZone, onStart, onOpen }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const o = card.occurrence;
  const e = o.execution;
  const status = e && e.state !== 'active' ? t(`executions.states.${e.state}`) : !e && o.status !== 'pending' ? t(`scheduling.statuses.${o.status}`) : null;
  const edge = card.overdue ? styles.edgeDanger : card.rework ? styles.edgeWarning : group === 'done' ? styles.edgeDone : group === 'upcoming' ? styles.edgeUpcoming : null;
  return (
    <View testID={`occurrence-${o.id}`} style={[styles.card, edge]}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>
          {o.checklistName}
        </Text>
        <View style={styles.right}>
          <Text style={styles.site}>{o.siteName}</Text>
          {o.shiftName ? <Text style={styles.shift}>{o.shiftName}</Text> : null}
        </View>
      </View>
      <View style={styles.row}>
        <Text style={styles.muted}>{t('mobile.checklists.window', { from: formatTime(o.startsAt, timeZone, locale), to: formatTime(o.closesAt, timeZone, locale) })}</Text>
        <Text style={styles.muted}>{formatDateTime(o.startsAt, { locale, timeZone })}</Text>
      </View>
      {card.rework ? (
        <Text style={styles.muted}>{`${t('corrections.round', { round: card.rework.round })} · ${t('mobile.rework.items', { count: card.rework.items })}`}</Text>
      ) : null}
      {card.rework?.dueAt ? (
        // Spec §8.1: the due date, red once it has passed; in the tenant's time zone (spec §9).
        <Text style={card.overdue ? styles.note : styles.muted}>{t('corrections.dueAt', { date: formatDateTime(card.rework.dueAt, { locale, timeZone }) })}</Text>
      ) : null}
      <View style={styles.badges}>
        {card.overdue ? <StatusChip tone="danger" text={t('mobile.checklists.overdue')} /> : null}
        {card.late ? <StatusChip tone="warning" text={t('executions.flags.late')} /> : null}
        {card.claimedBy ? <StatusChip tone="active" text={t('mobile.checklists.claimedBy', { name: card.claimedBy })} /> : null}
        {status && !card.claimedBy ? <StatusChip tone={group === 'done' ? 'success' : 'neutral'} text={status} /> : null}
      </View>
      {e?.syncNote ? <Text style={styles.note}>{notAcceptedText(t, e.syncNote)}</Text> : null}
      {card.action === 'start' ? (
        <PrimaryButton title={t('mobile.checklists.start')} accessibilityLabel={`${t('mobile.checklists.start')}: ${o.checklistName}`} onPress={onStart} />
      ) : null}
      {card.action === 'continue' ? (
        <PrimaryButton
          title={card.rework ? t('mobile.rework.fix') : t('mobile.checklists.continue')}
          accessibilityLabel={`${card.rework ? t('mobile.rework.fix') : t('mobile.checklists.continue')}: ${o.checklistName}`}
          onPress={onOpen}
        />
      ) : null}
      {card.action === 'view' ? (
        <PrimaryButton variant="outline" title={t('mobile.checklists.view')} accessibilityLabel={`${t('mobile.checklists.view')}: ${o.checklistName}`} onPress={onOpen} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.border, borderLeftWidth: 5, borderLeftColor: colors.primary, padding: spacing.md, gap: spacing.xs },
  edgeDanger: { borderLeftColor: colors.danger },
  edgeWarning: { borderLeftColor: colors.warning },
  edgeDone: { borderLeftColor: colors.success },
  edgeUpcoming: { borderLeftColor: colors.planned },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text, flexShrink: 1 },
  site: { fontFamily: font, fontSize: type.base, color: colors.muted, flexShrink: 0 },
  shift: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  note: { fontFamily: font, fontSize: type.base, color: colors.dangerText },
});
