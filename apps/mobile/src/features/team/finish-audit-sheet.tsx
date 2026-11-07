import { AUDIT_LIMITS, AUDIT_RESULTS, type AuditResult, type FinishAuditInput, finishAuditInputSchema, reportRecipients } from '@taskop/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormError } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { colors, spacing } from '@/lib/theme';
import { ButtonRow, ChoiceButton, Grow, OfflineNote, sheet } from './team-controls';

/** Extra report addresses as typed: separated by commas, semicolons or spaces. */
export const parseEmails = (text: string): string[] => text.split(/[\s,;]+/).filter(Boolean);

interface Props {
  /** The checklist's own report addresses, shown read-only. */
  reportEmails: readonly string[];
  online: boolean;
  busy: boolean;
  /** Resolves to the server's refusal to show here, or null when the sheet is done. */
  onSave: (body: FinishAuditInput) => Promise<string | null>;
  onClose: () => void;
}

/** FR-19.06–08: the result, a final comment and extra report addresses (`finishAuditInputSchema` lower-cases and de-duplicates them). */
export function FinishAuditSheet({ reportEmails, online, busy, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [result, setResult] = useState<AuditResult>('passed');
  const [comment, setComment] = useState('');
  const [emails, setEmails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailsFocused, setEmailsFocused] = useState(false);
  const save = async () => {
    const extraEmails = parseEmails(emails);
    // The server refuses the merged list (the checklist's addresses plus these), not just the extras.
    if (reportRecipients(reportEmails, extraEmails.map((e) => e.toLowerCase())).length > AUDIT_LIMITS.recipients) return setError(t('audits.issues.tooManyEmails'));
    const parsed = finishAuditInputSchema.safeParse({ result, comment: comment.trim() ? comment : null, extraEmails });
    if (!parsed.success) return setError(t('mobile.team.audit.invalidEmails'));
    setError(await onSave(parsed.data));
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={sheet.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView testID="finish-sheet" style={styles.sheet} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={sheet.title}>{t('mobile.team.audit.finishTitle')}</Text>
          <Text style={sheet.label}>{t('audits.fields.result')}</Text>
          <ButtonRow>
            {AUDIT_RESULTS.map((r) => (
              <Grow key={r}>
                <ChoiceButton role="radio" danger={r === 'failed'} label={t(`audits.results.${r}`)} selected={result === r} onPress={() => setResult(r)} />
              </Grow>
            ))}
          </ButtonRow>
          <Text style={sheet.label}>{t('audits.fields.comment')}</Text>
          <TextInput
            accessibilityLabel={t('audits.fields.comment')}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={AUDIT_LIMITS.finalComment}
            placeholderTextColor={colors.muted}
            style={sheet.input}
          />
          <Text style={sheet.muted}>
            {reportEmails.length > 0 ? t('mobile.team.audit.reportTo', { emails: reportEmails.join(', ') }) : t('mobile.team.audit.noReportEmails')}
          </Text>
          <Text style={sheet.label}>{t('audits.fields.extraEmails')}</Text>
          <TextInput
            accessibilityLabel={t('audits.fields.extraEmails')}
            value={emails}
            onChangeText={(text) => {
              setError(null);
              setEmails(text);
            }}
            placeholder={t('mobile.team.audit.emailsHint')}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={colors.muted}
            onFocus={() => setEmailsFocused(true)}
            onBlur={() => setEmailsFocused(false)}
            style={[sheet.line, emailsFocused && sheet.lineFocused]}
          />
          <FormError message={error} />
          {!online ? <OfflineNote text={t('mobile.team.offline')} /> : null}
          <View style={styles.actions}>
            <ButtonRow>
              <Grow>
                <PrimaryButton variant="outline" title={t('common.cancel')} onPress={onClose} />
              </Grow>
              <Grow>
                <PrimaryButton title={t('audits.actions.finish')} disabled={!online || busy} onPress={() => void save()} />
              </Grow>
            </ButtonRow>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flexGrow: 0, maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  content: { padding: 20, paddingBottom: spacing.lg, gap: spacing.sm },
  actions: { marginTop: spacing.sm },
});
