import { dayNumber, fromDayNumber, type Subscription, SUBSCRIPTION_GRACE_DAYS } from '@edildy/contracts';
import { formatLocalDate } from '@edildy/i18n';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@/lib/language';
import { colors, font, spacing, type } from '@/lib/theme';

/**
 * BR-01 on Home: once the subscription has expired the organisation is view-only (the server refuses every write), so
 * the worker learns why and whom to ask; during the grace days a quieter line says when that starts. Nothing while active.
 */
export function SubscriptionNotice({ subscription }: { subscription: Pick<Subscription, 'state' | 'endsOn'> }) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (subscription.state === 'expired') {
    return (
      <View testID="subscription-expired" accessibilityRole="alert" style={styles.expired}>
        <Text style={styles.title}>{t('mobile.home.subscription.expiredTitle')}</Text>
        <Text style={styles.body}>{t('mobile.home.subscription.expiredBody')}</Text>
      </View>
    );
  }
  if (subscription.state === 'grace' && subscription.endsOn !== null) {
    const graceEnd = fromDayNumber(dayNumber(subscription.endsOn) + SUBSCRIPTION_GRACE_DAYS);
    return (
      <View testID="subscription-grace" style={styles.grace}>
        <Text style={styles.graceText}>
          {t('mobile.home.subscription.grace', { date: formatLocalDate(subscription.endsOn, locale), graceEnd: formatLocalDate(graceEnd, locale) })}
        </Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  expired: { backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, gap: 4 },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.warningText },
  body: { fontFamily: font, fontSize: type.base, lineHeight: 21, color: colors.text },
  grace: { backgroundColor: colors.fill, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  graceText: { fontFamily: font, fontSize: type.sm, lineHeight: 18, color: colors.muted },
});
