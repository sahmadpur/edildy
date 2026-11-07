import type { TaskSummary } from '@taskop/contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FormError, mobileErrorText } from '@/components/form-error';
import { api } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';
import { useSyncStatus } from '@/offline/hooks';

/** Spec §7.2 "Yoxlama": tasks awaiting the caller's review, fetched whenever the tab gains focus while online (decision 13). */
export function ReviewSection() {
  const { t } = useTranslation();
  const services = useOffline();
  const { online } = useSyncStatus();
  const [items, setItems] = useState<TaskSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!online) return undefined;
      let alive = true;
      setError(null);
      api.tasks.list({ awaitingMyReview: 'true' }).then(
        (page) => {
          if (alive) setItems(page.items);
        },
        (e: unknown) => {
          if (alive) setError(mobileErrorText(t, e));
        },
      );
      return () => {
        alive = false;
      };
    }, [online, t]),
  );
  return (
    <View style={styles.group}>
      <View style={styles.sectionRow}>
        <Text testID="section-review" style={styles.section}>
          {t('mobile.tasks.sections.review')}
        </Text>
        {online && !error && items && items.length > 0 ? <Text style={styles.count}>{items.length}</Text> : null}
      </View>
      {!online ? (
        <Text style={styles.muted}>{t('mobile.tasks.online')}</Text>
      ) : error ? (
        <FormError message={error} />
      ) : items === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>{t('mobile.tasks.review.empty')}</Text>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            testID={`review-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: item.id, n: services.newId() } })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{item.assignee?.fullName ?? item.team?.name ?? ''}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  section: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  count: { fontFamily: font, fontSize: type.base, color: colors.muted },
  card: { minHeight: 44, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  pressed: { backgroundColor: colors.fill },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  meta: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
});
