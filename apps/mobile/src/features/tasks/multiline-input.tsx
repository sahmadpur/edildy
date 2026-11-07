import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, font, type } from '@/lib/theme';

/**
 * A multi-line text box drawn like CommitInput's: white, a 1 px line, radius 12, the line primary while focused.
 * For the forms that keep their text in state (create a task, review, report a problem, close a report).
 */
export function MultilineInput({ onFocus, onBlur, style, ...rest }: Omit<TextInputProps, 'multiline'>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      multiline
      placeholderTextColor={colors.muted}
      style={[styles.input, focused && styles.focused, style]}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: font,
    fontSize: type.md,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  focused: { borderColor: colors.primary },
});
