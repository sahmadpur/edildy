import { AUDIT_LIMITS, auditVerdictInputSchema } from '@edildy/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from 'react-native';
import { FormError } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/lib/theme';
import { ButtonRow, Grow, OfflineNote, sheet } from './team-controls';

interface Props {
  itemLabel: string;
  initial: string;
  online: boolean;
  busy: boolean;
  /** Resolves to the server's refusal to show here (the sheet covers the panel's own message), or null when it is done. */
  onSave: (comment: string) => Promise<string | null>;
  onClose: () => void;
}

/** FR-19.05: rejecting an item needs a comment (`auditVerdictInputSchema`). */
export function VerdictSheet({ itemLabel, initial, online, busy, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [comment, setComment] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const parsed = auditVerdictInputSchema.safeParse({ verdict: 'rejected', comment });
    if (!parsed.success || !parsed.data.comment) return setError(t('audits.issues.commentRequired'));
    setError(await onSave(parsed.data.comment));
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={sheet.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View testID="verdict-sheet" style={sheet.body}>
          <Text style={sheet.title}>{t('mobile.team.audit.rejectTitle')}</Text>
          <Text style={sheet.muted}>{itemLabel}</Text>
          <TextInput
            accessibilityLabel={t('audits.fields.comment')}
            value={comment}
            onChangeText={(text) => {
              setError(null);
              setComment(text);
            }}
            multiline
            maxLength={AUDIT_LIMITS.verdictComment}
            placeholderTextColor={colors.muted}
            style={sheet.input}
          />
          <FormError message={error} />
          {!online ? <OfflineNote text={t('mobile.team.offline')} /> : null}
          <ButtonRow>
            <Grow>
              <PrimaryButton variant="outline" title={t('common.cancel')} onPress={onClose} />
            </Grow>
            <Grow>
              <PrimaryButton title={t('audits.actions.reject')} disabled={!online || busy} onPress={() => void save()} />
            </Grow>
          </ButtonRow>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
