import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, spacing, type } from '@/lib/theme';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** `primary` is the one main action on a screen; `outline` is the quiet secondary (a grey fill, no border). */
  variant?: 'primary' | 'outline' | 'danger';
  accessibilityLabel?: string;
  testID?: string;
}

/** The app's button: 52 px tall and 17 px semibold, so it is readable in sunlight and pressable with gloves. */
export function PrimaryButton({ title, onPress, disabled, variant = 'primary', accessibilityLabel, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && pressedStyles[variant], disabled && styles.disabled]}
    >
      <Text style={[styles.text, textStyles[variant]]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.fill },
  danger: { backgroundColor: colors.dangerSoft },
  disabled: { opacity: 0.45 },
  text: { fontFamily: font, color: colors.primaryText, fontSize: type.md, fontWeight: '600' },
});
const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primaryDeep },
  outline: { backgroundColor: colors.border },
  danger: { opacity: 0.8 },
});
const textStyles = StyleSheet.create({
  primary: {},
  outline: { color: colors.text },
  danger: { color: colors.dangerText },
});
