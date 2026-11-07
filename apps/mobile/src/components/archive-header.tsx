import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing, type } from '@/lib/theme';

/**
 * The header of a run that can only be looked at (finished, locked, not open yet, or from the archive): white, a large
 * back arrow and the run's name, so it reads as an archive page and not as work to do (Nov 2026 feedback point 19).
 */
export function ArchiveHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string | null; onBack: () => void; right?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <View testID="archive-header" style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        testID="archive-back"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={30} color={colors.text} />
      </Pressable>
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  back: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill },
  pressed: { backgroundColor: colors.border },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: font, fontSize: type.lg, lineHeight: 26, fontWeight: '600', color: colors.text },
  subtitle: { fontFamily: font, fontSize: type.sm, color: colors.muted },
});
