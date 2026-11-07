import { loginStaffInputSchema, loginWorkerInputSchema } from '@taskop/contracts';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, type TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field } from '@/components/field';
import { FormError, mobileErrorText } from '@/components/form-error';
import { LanguagePicker } from '@/components/language-picker';
import { PrimaryButton } from '@/components/primary-button';
import { api, session } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import mark from '../../../assets/mark.png';

type Mode = 'worker' | 'staff';

/**
 * Sign-in. Workers are most of the people who see this, so their form is the screen; managers switch with a text
 * link under the button. The form sits low, within thumb reach, and rises with the keyboard.
 */
export function LoginScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('worker');
  const [orgCode, setOrgCode] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const usernameRef = useRef<TextInput>(null);
  const secretRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    void session.getOrgCode().then((code) => {
      if (code) setOrgCode((current) => current || code);
    });
  }, []);

  const switchMode = () => {
    setMode((m) => (m === 'worker' ? 'staff' : 'worker'));
    setFieldErrors({});
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const parsed =
      mode === 'worker'
        ? loginWorkerInputSchema.safeParse({ orgCode, username, secret, client: 'mobile' })
        : loginStaffInputSchema.safeParse({ email, password, client: 'mobile' });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      if (parsed.data && 'orgCode' in parsed.data) {
        const result = await api.auth.loginWorker(parsed.data);
        await session.rememberOrgCode(parsed.data.orgCode);
        await session.signedIn(result);
      } else {
        await session.signedIn(await api.auth.loginStaff(parsed.data));
      }
    } catch (e) {
      setError(mobileErrorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (name: string) => (fieldErrors[name] ? t(fieldErrors[name]) : null);
  const onSubmitEditing = () => void submit();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <LanguagePicker variant="dropdown" />
          </View>

          <View style={styles.intro}>
            <View style={styles.lockup}>
              <Image source={mark} style={styles.mark} accessibilityIgnoresInvertColors />
              <Text accessibilityRole="header" style={styles.wordmark}>
                Taskop
              </Text>
            </View>
            <Text style={styles.lede}>{mode === 'worker' ? t('mobile.login.hint') : t('mobile.login.staffHint')}</Text>
          </View>

          <View style={styles.form}>
            {mode === 'worker' ? (
              <>
                <Field label={t('mobile.login.orgCode')} value={orgCode} onChangeText={setOrgCode} autoCapitalize="none" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => usernameRef.current?.focus()} error={fieldError('orgCode')} />
                <Field
                  ref={usernameRef}
                  label={t('mobile.login.username')}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => secretRef.current?.focus()}
                  error={fieldError('username')}
                />
                <Field
                  ref={secretRef}
                  label={t('mobile.login.secret')}
                  value={secret}
                  onChangeText={setSecret}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmitEditing}
                  error={fieldError('secret')}
                />
              </>
            ) : (
              <>
                <Field
                  label={t('mobile.login.email')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  error={fieldError('email')}
                />
                <Field
                  ref={passwordRef}
                  label={t('mobile.login.password')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmitEditing}
                  error={fieldError('password')}
                />
              </>
            )}
            <FormError message={error} />
            <View style={styles.actions}>
              <PrimaryButton title={t('mobile.login.submit')} onPress={() => void submit()} disabled={busy} />
              <Pressable accessibilityRole="button" onPress={switchMode} style={styles.switch} hitSlop={4}>
                {({ pressed }) => <Text style={[styles.switchText, pressed && styles.switchPressed]}>{mode === 'worker' ? t('mobile.login.asStaff') : t('mobile.login.asWorker')}</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: spacing.sm, paddingBottom: spacing.md },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  intro: { marginTop: 56, gap: spacing.sm, alignItems: 'center' },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 40, height: 40 },
  wordmark: { fontFamily: font, fontSize: 40, lineHeight: 46, fontWeight: '600', color: colors.text, letterSpacing: -1.4 },
  lede: { fontFamily: font, fontSize: type.base, lineHeight: 22, color: colors.muted, maxWidth: 300, textAlign: 'center' },
  form: { flexGrow: 1, justifyContent: 'flex-end', gap: 22, paddingTop: 48 },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
  switch: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontFamily: font, fontSize: type.base, fontWeight: '500', color: colors.primary },
  switchPressed: { color: colors.primaryDeep, opacity: 0.7 },
});
