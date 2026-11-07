import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { colors, font, spacing, type } from '@/lib/theme';
import { sheet } from './team-controls';
import type { EmployeeChoice } from './team-rules';

/** Spec §7.1: one employee of the period, or everyone. The choice is the screen's, and survives a period change (decision 6). */
export function EmployeePicker({ choices, selected, onChange }: { choices: EmployeeChoice[]; selected: EmployeeChoice | null; onChange: (c: EmployeeChoice | null) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = `${t('reports.filters.employee')}: ${selected?.name ?? t('reports.filters.allEmployees')}`;
  const pick = (c: EmployeeChoice | null) => {
    setOpen(false);
    onChange(c);
  };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={sheet.backdrop}>
          <View style={[sheet.body, styles.sheet]}>
            <Text style={sheet.title}>{t('reports.filters.employee')}</Text>
            <ScrollView>
              <Option label={t('reports.filters.allEmployees')} selected={selected === null} first onPress={() => pick(null)} />
              {choices.map((c) => (
                <Option
                  key={c.userId}
                  label={c.active ? c.name : `${c.name} (${t('reports.inactive')})`}
                  selected={selected?.userId === c.userId}
                  onPress={() => pick(c)}
                />
              ))}
            </ScrollView>
            <PrimaryButton variant="outline" title={t('common.close')} onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

/** A plain row with a hairline above it; the chosen one carries a tick. */
function Option({ label, selected, first = false, onPress }: { label: string; selected: boolean; first?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, first && styles.optionFirst, pressed && styles.pressed]}
    >
      <Text style={[styles.optionText, selected ? styles.optionTextOn : null]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 12, paddingHorizontal: spacing.md, backgroundColor: colors.fill },
  pressed: { opacity: 0.7 },
  buttonText: { flex: 1, fontFamily: font, fontSize: type.base, color: colors.text },
  sheet: { maxHeight: '80%' },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  optionFirst: { borderTopWidth: 0 },
  optionText: { flex: 1, fontFamily: font, fontSize: type.base, color: colors.text },
  optionTextOn: { color: colors.primaryDeep, fontWeight: '600' },
});
