import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing, type } from '@/lib/theme';

/**
 * A quiet segmented control: a grey track with the chosen segment raised in white. Each segment is a radio. `scroll`
 * lets a longer set (the run buckets) slide sideways instead of squeezing its words.
 */
export function Segmented<K extends string>(p: { options: readonly { key: K; label: string }[]; value: K; onChange: (k: K) => void; scroll?: boolean }) {
  const track = (
    <View accessibilityRole="radiogroup" style={[styles.track, p.scroll ? styles.trackScroll : null]}>
      {p.options.map((o) => {
        const on = o.key === p.value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, disabled: false }}
            onPress={() => p.onChange(o.key)}
            hitSlop={{ top: 3, bottom: 3 }}
            style={[styles.segment, p.scroll ? null : styles.segmentGrow, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (!p.scroll) return track;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {track}
    </ScrollView>
  );
}

/**
 * A verdict or one-of-a-few choice: a grey fill when not chosen; chosen, a soft tint (blue, or red for the danger
 * choice). 44 px tall, no border.
 */
export function ChoiceButton(p: {
  label: string;
  accessibilityLabel?: string;
  role?: 'button' | 'radio';
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const selected = Boolean(p.selected);
  const disabled = Boolean(p.disabled);
  return (
    <Pressable
      accessibilityRole={p.role ?? 'button'}
      accessibilityLabel={p.accessibilityLabel ?? p.label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={p.onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && (p.danger ? styles.choiceDanger : styles.choiceOn),
        pressed && !selected && styles.choicePressed,
        disabled && styles.dim,
      ]}
    >
      <Text style={[styles.choiceText, selected && (p.danger ? styles.choiceTextDanger : styles.choiceTextOn)]} numberOfLines={1}>
        {p.label}
      </Text>
    </Pressable>
  );
}

/** A tick box and its label on one 44 px row. */
export function CheckRow(p: { label: string; checked: boolean; disabled?: boolean; onPress: () => void }) {
  const disabled = Boolean(p.disabled);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={p.label}
      accessibilityState={{ checked: p.checked, disabled }}
      disabled={disabled}
      onPress={p.onPress}
      style={[styles.check, disabled && styles.dim]}
    >
      <View style={[styles.box, p.checked && styles.boxOn]}>{p.checked ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : null}</View>
      <Text style={styles.checkText}>{p.label}</Text>
    </Pressable>
  );
}

/** Buttons side by side, sharing the width. */
export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}
export function Grow({ children }: { children: ReactNode }) {
  return <View style={styles.grow}>{children}</View>;
}

/** The "needs the connection" line inside a mode or sheet: a real alert, so a soft amber note. */
export function OfflineNote({ text }: { text: string }) {
  return (
    <View style={styles.offline}>
      <Text style={styles.offlineText}>{text}</Text>
    </View>
  );
}

/** Shared by the bottom sheets of the Team screens: white, top corners 20, no border. */
export const sheet = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.32)' },
  body: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: spacing.lg, gap: spacing.sm },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  label: { fontFamily: font, fontSize: type.sm, fontWeight: '500', color: colors.muted, marginTop: spacing.sm },
  /** A multiline box. */
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: font,
    fontSize: type.base,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlignVertical: 'top',
  },
  /** A single-line input drawn like Field: an underline. */
  line: {
    minHeight: 48,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
    fontFamily: font,
    fontSize: type.md,
    color: colors.text,
  },
  lineFocused: { borderBottomColor: colors.primary },
});

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 10, padding: 3 },
  trackScroll: { alignSelf: 'flex-start' },
  segment: { minHeight: 38, paddingHorizontal: spacing.md, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentGrow: { flex: 1, paddingHorizontal: spacing.sm },
  segmentOn: { backgroundColor: colors.surface, shadowColor: colors.text, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontFamily: font, fontSize: type.sm, fontWeight: '500', color: colors.muted },
  segmentTextOn: { color: colors.text, fontWeight: '600' },
  choice: { minHeight: 44, borderRadius: 12, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill },
  choiceOn: { backgroundColor: colors.primarySoft },
  choiceDanger: { backgroundColor: colors.dangerSoft },
  choicePressed: { backgroundColor: colors.border },
  choiceText: { fontFamily: font, fontSize: type.base, fontWeight: '500', color: colors.text },
  choiceTextOn: { color: colors.primaryDeep, fontWeight: '600' },
  choiceTextDanger: { color: colors.dangerText, fontWeight: '600' },
  dim: { opacity: 0.45 },
  check: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { flex: 1, fontFamily: font, fontSize: type.base, fontWeight: '500', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  offline: { backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  offlineText: { fontFamily: font, fontSize: type.base, fontWeight: '500', color: colors.warningText },
});
