import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { colors, font, spacing, type } from '@/lib/theme';
import { useOffline } from '@/offline/context';

/** Spec §7.1: team data is online only. Retry runs a manual sync, which reads the connection again (decision 8). */
export function TeamOffline() {
  const { t } = useTranslation();
  const services = useOffline();
  const retry = () =>
    void services.syncNow('manual').catch((e: unknown) => console.warn('[team] Manual sync failed', e instanceof Error ? e.message : 'unknown error'));
  return (
    <View style={styles.wrap}>
      <View style={styles.note}>
        <Text style={styles.text}>{t('mobile.team.offline')}</Text>
      </View>
      <PrimaryButton title={t('common.retry')} onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  note: { backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  text: { fontFamily: font, fontSize: type.base, fontWeight: '500', color: colors.warningText },
});
