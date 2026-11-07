import { type Ref, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, font, spacing, type } from '@/lib/theme';

interface Props
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'secureTextEntry' | 'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'onBlur' | 'returnKeyType' | 'onSubmitEditing' | 'textContentType' | 'submitBehavior'
  > {
  label: string;
  error?: string | null;
  /** React 19 passes `ref` as a prop: lets a form move focus to the next field. */
  ref?: Ref<TextInput>;
}

/**
 * A labelled text input drawn as an underline: a small grey label, the value in body size, and a rule that turns
 * primary while focused and red on error. 52 px tall so it stays easy to hit outdoors.
 */
export function Field({ label, error, onBlur, ref, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        autoCorrect={false}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null]}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  label: { fontFamily: font, fontSize: type.sm, fontWeight: '500', color: colors.muted },
  labelFocused: { color: colors.primary },
  input: {
    minHeight: 48,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
    fontFamily: font,
    fontSize: type.md,
    color: colors.text,
  },
  inputFocused: { borderBottomColor: colors.primary },
  inputError: { borderBottomColor: colors.danger },
  error: { fontFamily: font, color: colors.dangerText, fontSize: type.sm, marginTop: 2 },
});
