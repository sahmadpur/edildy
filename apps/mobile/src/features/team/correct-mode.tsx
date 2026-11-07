import { ApiError } from '@taskop/api-client';
import {
  type Answer,
  type Answers,
  AUDIT_LIMITS,
  changedItemIds,
  type CorrectAnswersInput,
  EXECUTION_LIMITS,
  type ExecutionDetail,
  type Missing,
  requirements,
  visibleItems,
} from '@taskop/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { CommitInput } from '@/components/commit-input';
import { FormError, mobileErrorText } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { AnswerInput, needsNote } from '@/features/execution/item-field';
import { api } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import type { RunCommand } from './queries';
import { ButtonRow, Grow, OfflineNote, sheet } from './team-controls';

type CorrectionAnswer = NonNullable<CorrectAnswersInput['changes'][number]['answer']>;

/**
 * Spec decision 11: what a correction sends for an item. The values and the note as the draft holds them; the manual
 * problem never (Part 1 decision 2 copies it over); photos and videos as they were. Null when nothing is left.
 */
export function correctionAnswer(a: Answer | undefined): CorrectionAnswer | null {
  if (!a) return null;
  const out: CorrectionAnswer = {};
  if (a.optionIds?.length) out.optionIds = a.optionIds;
  if (typeof a.number === 'number') out.number = a.number;
  if (a.text?.trim()) out.text = a.text;
  if (a.datetime) out.datetime = a.datetime;
  if (a.photos?.length) out.photos = a.photos;
  if (a.videos?.length) out.videos = a.videos;
  if (a.note?.trim()) out.note = a.note;
  return Object.keys(out).length > 0 ? out : null;
}

/** The run moved on (resubmitted, audited, sent back) since this screen loaded: the command refreshes the team queries. */
const staleRun = (e: ApiError) => e.code === 'EXECUTION_LOCKED' || e.code === 'EXECUTION_NOT_CORRECTABLE';

interface Props {
  detail: ExecutionDetail;
  online: boolean;
  command: RunCommand;
  /** Loads the run again after ANSWERS_CONFLICT; resolves with the fresh copy. */
  reload: () => Promise<ExecutionDetail | undefined>;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Spec §8.2 "Correct": the worker's value editors on a draft of the answers, then a reason, then one request with the
 * revision the draft was based on (spec §9). The draft lives here, so it survives the connection dropping.
 */
export function CorrectMode({ detail, online, command, reload, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const [base, setBase] = useState<{ answers: Answers; rev: number }>({ answers: detail.answers, rev: detail.answersRev });
  const [draft, setDraft] = useState<Answers>(detail.answers);
  const [missing, setMissing] = useState<Missing[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const content = detail.content;
  const visible = visibleItems(content, draft);
  const changed = changedItemIds(base.answers, draft);

  const patch = (itemId: string, p: Partial<Answer>) => {
    setMissing([]);
    setProblem(null);
    setDraft((d) => ({ ...d, [itemId]: { ...d[itemId], ...p } }));
  };

  const next = () => {
    setProblem(null);
    if (changed.length === 0) return setProblem(t('mobile.team.correct.noChanges'));
    const m = requirements(content, draft);
    setMissing(m);
    if (m.length > 0) return setProblem(t('errors.REQUIREMENTS_UNMET'));
    setReasonError(null);
    setAsking(true);
  };

  const save = async () => {
    if (!reason.trim()) return setReasonError(t('mobile.team.correct.reasonRequired'));
    const body: CorrectAnswersInput = {
      answersRev: base.rev,
      changes: changed.map((itemId) => ({ itemId, answer: correctionAnswer(draft[itemId]) })),
      reason: reason.trim(),
    };
    const r = await command.run(() => api.corrections.correct(detail.id, body), { refreshOnError: staleRun });
    if (!r) return;
    setAsking(false);
    if (r.ok) {
      Alert.alert(t('mobile.team.correct.saved'));
      onDone();
      return;
    }
    if (r.error instanceof ApiError && r.error.code === 'ANSWERS_CONFLICT') setConflict(true);
    if (r.error instanceof ApiError && r.error.code === 'REQUIREMENTS_UNMET' && r.error.missing) setMissing(r.error.missing);
    setProblem(mobileErrorText(t, r.error));
  };

  /** Spec §9: someone else changed the run first. The draft restarts from the server's answers and revision. */
  const reloadNow = async () => {
    const fresh = await reload();
    if (!fresh) return;
    setBase({ answers: fresh.answers, rev: fresh.answersRev });
    setDraft(fresh.answers);
    setConflict(false);
    setProblem(null);
    setMissing([]);
  };

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{t('mobile.team.correct.title')}</Text>
      <Text style={styles.muted}>{t('mobile.team.correct.mediaHint')}</Text>
      {content.sections.map((section) => {
        const rows = visible.filter((v) => v.sectionId === section.id);
        if (rows.length === 0) return null;
        return (
          <View key={section.id} style={styles.block}>
            <Text style={styles.section}>{section.title}</Text>
            {rows.map(({ item, depth }) => {
              const itemMissing = missing.filter((m) => m.itemId === item.id);
              return (
                <View
                  key={item.id}
                  testID={`correct-${item.id}`}
                  style={[styles.card, { marginLeft: depth * spacing.md }, itemMissing.length > 0 ? styles.cardMissing : null, changed.includes(item.id) ? styles.cardChanged : null]}
                >
                  <Text style={styles.label}>{item.label}</Text>
                  <AnswerInput item={item} answer={draft[item.id]} readOnly={false} onPatch={(p) => patch(item.id, p)} />
                  {needsNote(item, draft[item.id]) ? (
                    <CommitInput
                      accessibilityLabel={`${t('mobile.execution.note')}: ${item.label}`}
                      value={draft[item.id]?.note ?? ''}
                      multiline
                      maxLength={EXECUTION_LIMITS.answerNote}
                      onCommit={(note) => patch(item.id, { note: note.trim() ? note : undefined })}
                    />
                  ) : null}
                  {itemMissing.map((m) => (
                    <Text key={m.kind} style={styles.missing}>
                      {t(`mobile.finish.missingKinds.${m.kind}`)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        );
      })}
      <FormError message={problem} />
      {conflict ? <PrimaryButton variant="outline" title={t('mobile.team.correct.reload')} disabled={!online} onPress={() => void reloadNow()} /> : null}
      {!online ? <OfflineNote text={t('mobile.team.offline')} /> : null}
      <ButtonRow>
        <Grow>
          <PrimaryButton variant="outline" title={t('common.cancel')} onPress={onCancel} />
        </Grow>
        <Grow>
          <PrimaryButton title={t('mobile.team.correct.next')} disabled={conflict} onPress={next} />
        </Grow>
      </ButtonRow>
      {asking ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setAsking(false)}>
          <KeyboardAvoidingView style={sheet.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View testID="reason-sheet" style={sheet.body}>
              <Text style={sheet.title}>{t('corrections.fields.reason')}</Text>
              <TextInput
                accessibilityLabel={t('corrections.fields.reason')}
                value={reason}
                onChangeText={(text) => {
                  setReasonError(null);
                  setReason(text);
                }}
                multiline
                maxLength={AUDIT_LIMITS.reason}
                placeholderTextColor={colors.muted}
                style={sheet.input}
              />
              <FormError message={reasonError} />
              {!online ? <OfflineNote text={t('mobile.team.offline')} /> : null}
              <ButtonRow>
                <Grow>
                  <PrimaryButton variant="outline" title={t('common.cancel')} onPress={() => setAsking(false)} />
                </Grow>
                <Grow>
                  <PrimaryButton title={t('corrections.actions.correct')} disabled={!online || command.busy} onPress={() => void save()} />
                </Grow>
              </ButtonRow>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  title: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  section: { fontFamily: font, fontSize: type.base, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  muted: { fontFamily: font, fontSize: type.sm, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  cardMissing: { borderColor: colors.warning },
  cardChanged: { borderColor: colors.primary },
  label: { fontFamily: font, fontSize: type.md, fontWeight: '600', color: colors.text },
  missing: { fontFamily: font, fontSize: type.sm, color: colors.dangerText },
});
