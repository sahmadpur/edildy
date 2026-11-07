import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing, type, TONES, type Tone } from '@/lib/theme';

/** A status chip: soft background, strong text, always with words. Shared by tasks, runs and cards. */
export function StatusChip({ text, tone = 'neutral', testID }: { text: string; tone?: Tone; testID?: string }) {
  const c = TONES[tone];
  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

/**
 * The top of the main screens: no block, just type on white. A small grey line (the date, a subtitle), a large title,
 * and tools. Names kept from the old deep header so every screen picks the new look up at once.
 */
export const headerBlock = StyleSheet.create({
  block: { paddingTop: spacing.sm, gap: spacing.xs },
  /** The Home header: the date row and the greeting. */
  compactBlock: { paddingTop: spacing.xs, gap: spacing.xs },
  greeting: { fontFamily: font, color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.6 },
  eyebrow: { fontFamily: font, color: colors.muted, fontSize: type.sm },
  title: { fontFamily: font, color: colors.text, fontSize: type.display, lineHeight: 36, fontWeight: '600', letterSpacing: -0.8 },
  subtitle: { fontFamily: font, color: colors.muted, fontSize: type.base, lineHeight: 21 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: radius.chip, paddingHorizontal: 7, paddingVertical: 2 },
  text: { fontFamily: font, fontSize: type.sm, fontWeight: '600' },
});
