import { EXECUTION_LIMITS, type ManualProblem, MEDIA_KINDS, MEDIA_LIMITS, type MediaKind, type MediaSource, PROBLEM_SEVERITIES, type ProblemSeverity } from '@taskop/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormError } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { colors, font, spacing, type } from '@/lib/theme';
import type { LocalMedia } from '@/offline/local-model';
import { Chip, Choice, MediaStrip } from './parts';

export interface ProblemDraft {
  itemId: string;
  severity: ProblemSeverity;
  note: string;
  mediaIds: string[];
}

interface Props {
  draft: ProblemDraft;
  itemLabel: string;
  liveOnly: boolean;
  media: ReadonlyMap<string, LocalMedia>;
  /** The item already has a saved manual problem (offers "Problemi sil"). */
  existing: boolean;
  onChange: (draft: ProblemDraft) => void;
  onCapture: (kind: MediaKind, source: MediaSource) => void;
  onSave: (problem: ManualProblem | null) => void;
  onClose: () => void;
}

/** FR-13.01–03: severity, a note (1–2000 characters) and up to 5 photos or videos. */
export function ProblemSheet(p: Props) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // The store refuses a problem with more media, so the add chips stop at the limit.
  const full = p.draft.mediaIds.length >= MEDIA_LIMITS.problemMaxMedia;
  const save = () => {
    const note = p.draft.note.trim();
    if (!note) {
      setError(t('mobile.problem.noteRequired'));
      return;
    }
    p.onSave({ severity: p.draft.severity, note, mediaIds: p.draft.mediaIds });
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={p.onClose}>
      {/* The keyboard must not cover the note field or the save button. */}
      <KeyboardAvoidingView testID="problem-sheet-keyboard" style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView testID="problem-sheet" style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <View style={styles.handle} />
          <Text style={styles.title}>{t('mobile.problem.title')}</Text>
          <Text style={styles.muted}>{p.itemLabel}</Text>
          <Text style={styles.label}>{t('mobile.problem.severity')}</Text>
          <View style={styles.row}>
            {PROBLEM_SEVERITIES.map((s) => (
              <Choice key={s} role="radio" label={t(`executions.severities.${s}`)} selected={p.draft.severity === s} onPress={() => p.onChange({ ...p.draft, severity: s })} />
            ))}
          </View>
          <Text style={styles.label}>{t('mobile.problem.note')}</Text>
          <TextInput
            accessibilityLabel={t('mobile.problem.note')}
            value={p.draft.note}
            onChangeText={(note) => {
              setError(null);
              p.onChange({ ...p.draft, note });
            }}
            multiline
            maxLength={EXECUTION_LIMITS.problemNote}
            placeholderTextColor={colors.muted}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, focused ? styles.inputFocused : null]}
          />
          <FormError message={error} />
          <Text style={styles.label}>{t('mobile.problem.media')}</Text>
          <MediaStrip
            ids={p.draft.mediaIds}
            media={p.media}
            onRemove={(id) => p.onChange({ ...p.draft, mediaIds: p.draft.mediaIds.filter((x) => x !== id) })}
            onOpenVideo={() => undefined}
          />
          <View style={styles.row}>
            {MEDIA_KINDS.map((kind) => (
              <View key={kind} style={styles.row}>
                <Chip label={`${t(`executions.mediaKinds.${kind}`)}: ${t('mobile.evidence.camera')}`} disabled={full} onPress={() => p.onCapture(kind, 'camera')} />
                {p.liveOnly ? null : (
                  <Chip label={`${t(`executions.mediaKinds.${kind}`)}: ${t('mobile.evidence.gallery')}`} disabled={full} onPress={() => p.onCapture(kind, 'gallery')} />
                )}
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <View style={styles.half}>
              <PrimaryButton variant="outline" title={t('common.cancel')} onPress={p.onClose} />
            </View>
            <View style={styles.half}>
              <PrimaryButton title={t('mobile.problem.save')} onPress={save} />
            </View>
          </View>
          {p.existing ? <PrimaryButton variant="outline" title={t('mobile.problem.remove')} onPress={() => p.onSave(null)} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.4)' },
  sheet: { flexGrow: 0, maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetContent: { paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  title: { fontFamily: font, fontSize: type.lg, fontWeight: '600', color: colors.text },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  label: { fontFamily: font, fontSize: type.sm, fontWeight: '500', color: colors.muted, marginTop: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  half: { flex: 1 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: font,
    fontSize: type.md,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlignVertical: 'top',
  },
  inputFocused: { borderColor: colors.primary },
});
