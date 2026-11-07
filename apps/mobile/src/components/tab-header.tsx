import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatLocalDate } from '@taskop/i18n';
import { LanguagePicker } from '@/components/language-picker';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { SyncIndicator } from '@/features/sync/sync-indicator';
import { useLocale } from '@/lib/language';
import { colors, font, radius, spacing, type } from '@/lib/theme';
import { localDate } from '@/lib/time';
import { useOffline } from '@/offline/context';
import { useNow } from '@/offline/hooks';

/**
 * The top of every tab (Nov 2026 feedback): one deep brand block of the same height everywhere — the date and the tools
 * (sync · language · bell) on a 44 px row, then one line of title. `action` sits at the end of the title line (Tasks'
 * "+ Yeni"); anything longer belongs under the block, so the tabs never jump in height when switching.
 */
export function TabHeader({ title, action, testID }: { title: string; action?: ReactNode; testID?: string }) {
  const locale = useLocale();
  const services = useOffline();
  const now = useNow();
  return (
    <View testID={testID ?? 'tab-header'} style={styles.block}>
      <View style={styles.top}>
        <Text numberOfLines={1} style={styles.eyebrow}>
          {formatLocalDate(localDate(now, services.timeZone), locale)}
        </Text>
        <View style={styles.tools}>
          <SyncIndicator compact />
          <LanguagePicker variant="dropdown" tone="light" testID="header-language" />
          <NotificationBell tone="light" />
        </View>
      </View>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.title}>
          {title}
        </Text>
        {action}
      </View>
    </View>
  );
}

/** A light pill for the title line of the header ("+ Yeni"). */
export const headerAction = StyleSheet.create({
  button: { minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.sm + 4, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.24)' },
  text: { fontFamily: font, fontSize: type.base, fontWeight: '600', color: colors.onDeep },
});

const styles = StyleSheet.create({
  block: { backgroundColor: colors.deep, borderRadius: radius.sheet, paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md, gap: 2 },
  top: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  eyebrow: { flexShrink: 1, fontFamily: font, color: colors.onDeepMuted, fontSize: type.sm },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: -spacing.xs },
  titleRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flexShrink: 1, fontFamily: font, color: colors.onDeep, fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.5 },
});
