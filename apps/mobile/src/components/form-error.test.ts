import { ApiError } from '@edildy/api-client';
import i18n from '@/lib/i18n';
import { mobileErrorText } from './form-error';

const t = i18n.t.bind(i18n);
const error = (code: ConstructorParameters<typeof ApiError>[1], o: { limit?: number; rows?: number; requestId?: string } = {}) =>
  new ApiError(409, code, `errors.${code}`, null, null, o.requestId ?? null, null, null, null, null, o.rows ?? null, o.limit ?? null);

describe('mobileErrorText', () => {
  it('names the plan’s cap in a limit refusal (BR-01)', () => {
    expect(mobileErrorText(t, error('WORKER_LIMIT_REACHED', { limit: 10 }))).toBe(t('errors.WORKER_LIMIT_REACHED', { limit: 10 }));
    expect(mobileErrorText(t, error('WORKER_LIMIT_REACHED', { limit: 10 }))).toContain('10');
    expect(mobileErrorText(t, error('BRANCH_LIMIT_REACHED', { limit: 3 }))).toContain('3');
  });

  it('shows the expired-subscription refusal as it is', () => {
    expect(mobileErrorText(t, error('SUBSCRIPTION_EXPIRED'))).toBe(t('errors.SUBSCRIPTION_EXPIRED'));
  });

  it('keeps the request id, and a dash for anything the error does not carry', () => {
    expect(mobileErrorText(t, error('INTERNAL', { requestId: 'req-1' }))).toContain('req-1');
    expect(mobileErrorText(t, error('STAFF_LIMIT_REACHED'))).not.toContain('{{limit}}');
    expect(mobileErrorText(t, new Error('boom'))).toBe(t('errors.INTERNAL', { requestId: '—' }));
  });
});
