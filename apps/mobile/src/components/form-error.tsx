import { ApiError } from '@taskop/api-client';
import type { TFunction } from 'i18next';
import { StyleSheet, Text } from 'react-native';
import { colors, font, type } from '@/lib/theme';

export function mobileErrorText(t: TFunction, e: unknown): string {
  if (e instanceof ApiError) {
    const minutes = e.retryAfterSeconds ? Math.ceil(e.retryAfterSeconds / 60) : 1;
    return t(e.messageKey, { minutes, requestId: e.requestId ?? '—' });
  }
  return t('errors.INTERNAL', { requestId: '—' });
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({ error: { fontFamily: font, color: colors.dangerText, fontSize: type.sm, lineHeight: 18 } });
