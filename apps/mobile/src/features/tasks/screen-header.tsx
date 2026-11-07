import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing, type } from '@/lib/theme';

/** A pushed screen's top row, kept quiet: an ink back chevron (44 px target) and the title in ink. */
export function ScreenHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: spacing.xs },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm, borderRadius: 22 },
  pressed: { backgroundColor: colors.fill },
  title: { fontFamily: font, fontSize: type.lg, lineHeight: 26, fontWeight: '600', color: colors.text, flexShrink: 1, letterSpacing: -0.3 },
});
