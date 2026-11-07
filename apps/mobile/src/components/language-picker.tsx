import { type Language, LANGUAGE_FLAGS, LANGUAGE_NAMES, LANGUAGES } from '@taskop/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { chooseLanguage, useLocale } from '@/lib/language';
import { colors, font, radius, spacing, type } from '@/lib/theme';

/**
 * The language choice: three chips named in themselves (`names`), three flag chips (`flags`), or the current flag with
 * a chevron that opens a small menu of flags and names (`dropdown`, the sign-in screen and the profile). The choice
 * is stored on the phone and, when signed in, on the profile. The accessibility label is always the name.
 */
export function LanguagePicker({ testID = 'language-picker', variant = 'names' }: { testID?: string; variant?: 'names' | 'flags' | 'dropdown' }) {
  const { t } = useTranslation();
  const current = useLocale();
  if (variant === 'dropdown') return <LanguageDropdown testID={testID} />;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('common.language')} testID={testID} style={styles.row}>
      {LANGUAGES.map((lng: Language) => {
        const on = lng === current;
        return (
          <Pressable
            key={lng}
            accessibilityRole="radio"
            accessibilityLabel={LANGUAGE_NAMES[lng]}
            accessibilityState={{ selected: on, checked: on }}
            testID={`${testID}-${lng}`}
            onPress={() => void chooseLanguage(lng)}
            style={[styles.chip, variant === 'flags' && styles.flagChip, on && styles.chipOn]}
          >
            {variant === 'flags' ? <Text style={styles.flag}>{LANGUAGE_FLAGS[lng]}</Text> : <Text style={[styles.text, on && styles.textOn]}>{LANGUAGE_NAMES[lng]}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The current flag and a chevron; the menu opens under it, right-aligned, and closes on a choice or a tap outside. */
function LanguageDropdown({ testID }: { testID: string }) {
  const { t } = useTranslation();
  const current = useLocale();
  const { width } = useWindowDimensions();
  const trigger = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const show = () => {
    setOpen(true);
    trigger.current?.measureInWindow((x, y, w, h) => setAnchor({ top: y + h + 6, right: Math.max(spacing.md, width - x - w) }));
  };
  const pick = (lng: Language) => {
    setOpen(false);
    void chooseLanguage(lng);
  };
  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={`${t('common.language')}: ${LANGUAGE_NAMES[current]}`}
        accessibilityState={{ expanded: open }}
        testID={testID}
        onPress={show}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={styles.triggerFlag}>{LANGUAGE_FLAGS[current]}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('common.language')}
          accessibilityViewIsModal
          style={[styles.menu, anchor ?? styles.menuFallback]}
        >
          {LANGUAGES.map((lng: Language) => {
            const on = lng === current;
            return (
              <Pressable
                key={lng}
                accessibilityRole="radio"
                accessibilityLabel={LANGUAGE_NAMES[lng]}
                accessibilityState={{ selected: on, checked: on }}
                testID={`${testID}-${lng}`}
                onPress={() => pick(lng)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <Text style={styles.optionFlag}>{LANGUAGE_FLAGS[lng]}</Text>
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{LANGUAGE_NAMES[lng]}</Text>
                {on ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : <View style={styles.checkSpace} />}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, borderRadius: 10, backgroundColor: colors.fill },
  triggerPressed: { backgroundColor: colors.border },
  triggerFlag: { fontSize: 20, lineHeight: 26 },
  menu: {
    position: 'absolute',
    minWidth: 200,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingVertical: 4,
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  // Before the trigger has been measured (and in tests): the top-right corner.
  menuFallback: { top: 96, right: spacing.md },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  optionPressed: { backgroundColor: colors.fill },
  optionFlag: { fontSize: 20, lineHeight: 26 },
  optionText: { flex: 1, fontFamily: font, fontSize: type.base, color: colors.text },
  optionTextOn: { fontWeight: '600' },
  checkSpace: { width: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.control, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  flagChip: { width: 52, paddingHorizontal: 0 },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  flag: { fontSize: type.xl, lineHeight: type.xl + 6 },
  text: { fontFamily: font, fontSize: type.base, fontWeight: '500', color: colors.text },
  textOn: { color: colors.primaryDeep, fontWeight: '600' },
});
