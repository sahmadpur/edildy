import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, font, spacing, type } from '@/lib/theme';

export const COMMIT_DELAY_MS = 500;

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  /** Called 500 ms after typing stops, on blur, and on unmount with unsaved text. */
  onCommit: (text: string) => void;
  /** Filled with a function that commits unsaved text at once, for a button that must act on the latest text. */
  flushRef?: RefObject<(() => void) | null>;
}

/**
 * A text field that autosaves (spec §7.3) without writing SQLite and the outbox on every keystroke. Drawn like `Field`:
 * one line is an underline, several lines a light box; either turns primary while focused.
 */
export function CommitInput({ value, onCommit, flushRef, onFocus, onBlur, style, ...rest }: Props) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    if (pending.current === null) setText(value);
  }, [value]);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next !== null) commit.current(next);
  }, []);
  useEffect(() => flush, [flush]);
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = flush;
    return () => {
      flushRef.current = null;
    };
  }, [flush, flushRef]);
  return (
    <TextInput
      {...rest}
      value={text}
      placeholderTextColor={colors.muted}
      style={[rest.multiline ? styles.multiline : styles.input, focused ? (rest.multiline ? styles.multilineFocused : styles.inputFocused) : null, style]}
      onChangeText={(next) => {
        setText(next);
        pending.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, COMMIT_DELAY_MS);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        flush();
        onBlur?.(e);
      }}
    />
  );
}

const styles = StyleSheet.create({
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
  multiline: {
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
  multilineFocused: { borderColor: colors.primary },
});
