import { Ionicons } from '@expo/vector-icons';
import { isWholeDayWindow } from '@taskop/contracts';
import { formatDateTime } from '@taskop/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
import { PrimaryButton } from '@/components/primary-button';
import { notAcceptedText } from '@/features/sync/refusal-text';
import { useLocale } from '@/lib/language';
import { formatTime } from '@/lib/time';
import { colors, font, spacing, type } from '@/lib/theme';
import type { CardModel, GroupKey } from './group-occurrences';

interface Props {
  card: CardModel;
  group: GroupKey;
  timeZone: string;
  onStart: () => void;
  onOpen: () => void;
}

/** The small dot before a run's name (the group colour that used to be a thick left edge); the calendar uses it too. */
export function cardDot(card: CardModel, group: GroupKey): string {
  const missed = !card.occurrence.execution && card.occurrence.status === 'missed';
  return card.overdue || missed ? colors.danger : card.rework ? colors.warning : group === 'done' ? colors.success : group === 'upcoming' ? colors.planned : colors.primary;
}

/** One run on the Home list: `name | site` over `window | opening moment`, the chips, and the one action the worker can take. */
export function OccurrenceCard({ card, group, timeZone, onStart, onOpen }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const o = card.occurrence;
  const e = o.execution;
  const status = e && e.state !== 'active' ? t(`executions.states.${e.state}`) : !e && o.status !== 'pending' ? t(`scheduling.statuses.${o.status}`) : null;
  const missed = !e && o.status === 'missed';
  const dot = cardDot(card, group);
  // A finished run and one not open yet are opened by tapping anywhere on the card (Nov 2026 feedback point 12).
  const tappable = card.action === 'view' || card.action === 'preview';
  return (
    <Pressable
      testID={`occurrence-${o.id}`}
      disabled={!tappable}
      accessibilityRole={tappable ? 'button' : undefined}
      accessibilityLabel={tappable ? `${t('mobile.checklists.view')}: ${o.checklistName}` : undefined}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, tappable && pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.name}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text style={styles.title} numberOfLines={1}>
            {o.checklistName}
          </Text>
        </View>
        <View testID="site-column" style={styles.right}>
          <Text style={styles.site} numberOfLines={1}>
            {o.siteName}
          </Text>
          {o.shiftName ? <Text style={styles.shift}>{o.shiftName}</Text> : null}
        </View>
      </View>
      <View style={styles.row}>
        <Text style={styles.muted}>
          {/* An "İstənilən vaxt" run is the whole day: say so instead of 00:00–00:00 (feedback 2026-11-07). */}
          {isWholeDayWindow(o.startsAt, o.dueAt, timeZone)
            ? t('scheduling.builder.modes.anytime')
            : t('mobile.checklists.window', { from: formatTime(o.startsAt, timeZone, locale), to: formatTime(o.closesAt, timeZone, locale) })}
        </Text>
        <Text style={styles.muted}>{formatDateTime(o.startsAt, { locale, timeZone })}</Text>
      </View>
      {card.rework ? (
        <Text style={styles.muted}>{`${t('corrections.round', { round: card.rework.round })} · ${t('mobile.rework.items', { count: card.rework.items })}`}</Text>
      ) : null}
      {card.rework?.dueAt ? (
        // Spec §8.1: the due date, red once it has passed; in the tenant's time zone (spec §9).
        <Text style={card.overdue ? styles.note : styles.muted}>{t('corrections.dueAt', { date: formatDateTime(card.rework.dueAt, { locale, timeZone }) })}</Text>
      ) : null}
      <View style={[styles.badges, !(card.overdue || card.late || card.claimedBy || status) && styles.none]}>
        {card.overdue ? <StatusChip tone="danger" text={t('mobile.checklists.overdue')} /> : null}
        {card.late ? <StatusChip tone="warning" text={t('executions.flags.late')} /> : null}
        {card.claimedBy ? <StatusChip tone="active" text={t('mobile.checklists.claimedBy', { name: card.claimedBy })} /> : null}
        {status && !card.claimedBy ? <StatusChip tone={missed ? 'danger' : group === 'done' ? 'success' : 'neutral'} text={status} /> : null}
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
      {tappable ? (
        <View style={styles.viewRow}>
          <Text style={styles.viewText}>{card.action === 'preview' ? t('mobile.checklists.preview') : t('mobile.checklists.view')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  name: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // Capped so a long site name never squeezes the checklist name to an ellipsis; the site clips instead.
  right: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '55%' },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text, flexShrink: 1 },
  site: { fontFamily: font, fontSize: type.sm, color: colors.muted, flexShrink: 0, lineHeight: 22 },
  shift: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted, marginLeft: 16 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginLeft: 16 },
  none: { display: 'none' },
  note: { fontFamily: font, fontSize: type.base, color: colors.dangerText },
  pressed: { backgroundColor: colors.fill },
  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  viewText: { fontFamily: font, fontSize: type.base, fontWeight: '600', color: colors.primary },
});
