import { Ionicons } from '@expo/vector-icons';
import { isWholeDayWindow } from '@edildy/contracts';
import { formatDateTime } from '@edildy/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/chip';
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

/**
 * One run on the Home list, always the same size (8 Nov 2026 feedback): three one-line rows — the name, `site · window`,
 * then the opening moment (or the correction round) with the chips — and a round icon button on the right for the one action the
 * worker can take. Anything longer is clipped, never wrapped, so every card in a list is the same height.
 */
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
  const actionTitle = card.action === 'start' ? t('mobile.checklists.start') : card.rework ? t('mobile.rework.fix') : t('mobile.checklists.continue');
  const actionIcon = card.action === 'start' ? 'play' : card.rework ? 'construct' : 'arrow-forward';
  return (
    <Pressable
      testID={`occurrence-${o.id}`}
      disabled={!tappable}
      accessibilityRole={tappable ? 'button' : undefined}
      accessibilityLabel={tappable ? `${card.action === 'preview' ? t('mobile.checklists.preview') : t('mobile.checklists.view')}: ${o.checklistName}` : undefined}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, tappable && pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <View style={styles.name}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text style={styles.title} numberOfLines={1}>
            {o.checklistName}
          </Text>
        </View>
        <View style={styles.row}>
          {/* Capped so a long site name never takes the whole line; the window after it clips first. */}
          <View testID="site-column" style={styles.siteColumn}>
            <Text style={styles.site} numberOfLines={1}>
              {o.siteName}
            </Text>
          </View>
          <Text style={[styles.line, styles.shrink]} numberOfLines={1}>
            {' · '}
            {/* An "İstənilən vaxt" run is the whole day: say so instead of 00:00–00:00 (feedback 2026-11-07). */}
            {isWholeDayWindow(o.startsAt, o.dueAt, timeZone)
              ? t('scheduling.builder.modes.anytime')
              : t('mobile.checklists.window', { from: formatTime(o.startsAt, timeZone, locale), to: formatTime(o.closesAt, timeZone, locale) })}
            {o.shiftName ? ` · ${o.shiftName}` : ''}
          </Text>
        </View>
        {/* The third line: a refused sync first, else the chips and the correction round, clipped to one line. */}
        <View style={styles.extra}>
          {e?.syncNote ? (
            <Text style={[styles.note, styles.shrink]} numberOfLines={1}>
              {notAcceptedText(t, e.syncNote)}
            </Text>
          ) : (
            <>
              {card.rework ? null : (
                <Text style={styles.line} numberOfLines={1}>
                  {formatDateTime(o.startsAt, { locale, timeZone })}
                </Text>
              )}
              {card.overdue ? <StatusChip tone="danger" text={t('mobile.checklists.overdue')} /> : null}
              {card.late ? <StatusChip tone="warning" text={t('executions.flags.late')} /> : null}
              {card.claimedBy ? <StatusChip tone="active" text={t('mobile.checklists.claimedBy', { name: card.claimedBy })} /> : null}
              {status && !card.claimedBy ? <StatusChip tone={missed ? 'danger' : group === 'done' ? 'success' : 'neutral'} text={status} /> : null}
              {card.rework ? (
                <Text style={[styles.line, styles.shrink]} numberOfLines={1}>
                  {`${t('corrections.round', { round: card.rework.round })} · ${t('mobile.rework.items', { count: card.rework.items })}`}
                </Text>
              ) : null}
              {card.rework?.dueAt ? (
                // Spec §8.1: the due date, red once it has passed; in the tenant's time zone (spec §9).
                <Text style={[card.overdue ? styles.note : styles.line, styles.shrink]} numberOfLines={1}>
                  {t('corrections.dueAt', { date: formatDateTime(card.rework.dueAt, { locale, timeZone }) })}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>
      {card.action === 'start' || card.action === 'continue' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionTitle}: ${o.checklistName}`}
          hitSlop={6}
          onPress={card.action === 'start' ? onStart : onOpen}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Ionicons name={actionIcon} size={22} color={colors.primaryText} />
        </Pressable>
      ) : (
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={20} color={tappable ? colors.primary : colors.muted} />
        </View>
      )}
    </Pressable>
  );
}

/** Three rows of 22 + 22 + 22 px, two 4 px gaps and 12 px padding: every card is exactly this tall. */
const CARD_HEIGHT = 98;

const styles = StyleSheet.create({
  card: { height: CARD_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingLeft: spacing.md, paddingRight: 12, overflow: 'hidden' },
  body: { flex: 1, gap: 4, overflow: 'hidden' },
  name: { height: 22, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontFamily: font, fontSize: type.md, lineHeight: 22, fontWeight: '600', color: colors.text, flexShrink: 1 },
  row: { height: 22, flexDirection: 'row', alignItems: 'center', marginLeft: 16, overflow: 'hidden' },
  siteColumn: { flexShrink: 0, maxWidth: '55%' },
  site: { fontFamily: font, fontSize: type.sm, lineHeight: 18, color: colors.muted, flexShrink: 0 },
  shrink: { flexShrink: 1 },
  extra: { height: 22, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 16, overflow: 'hidden' },
  line: { fontFamily: font, fontSize: type.sm, lineHeight: 18, color: colors.muted },
  note: { fontFamily: font, fontSize: type.sm, lineHeight: 18, color: colors.dangerText },
  pressed: { backgroundColor: colors.fill },
  // 48 px round: still easy to hit with gloves, and it never changes the card's height.
  action: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  actionPressed: { backgroundColor: colors.primaryDeep },
  chevron: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
