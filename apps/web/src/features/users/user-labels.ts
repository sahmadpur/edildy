import type { UserDto } from '@edildy/contracts';

export const statusVariant = (status: UserDto['status']) =>
  status === 'active' ? ('default' as const) : status === 'invited' ? ('outline' as const) : ('secondary' as const);

export const loginLabel = (u: Pick<UserDto, 'username' | 'email'>) => u.username ?? u.email ?? '—';
