import type { FeatureKey, Me } from '@edildy/contracts';
import { useSession } from './session';

/** The organisation's plan holds the feature (BR-01). Reads the cached profile, so it answers offline too. */
export function hasFeature(me: { tenant: { subscription: Pick<Me['tenant']['subscription'], 'features'> } }, key: FeatureKey): boolean {
  return me.tenant.subscription.features.includes(key);
}

/** `hasFeature` for the signed-in user; false while signed out. */
export function useFeature(key: FeatureKey): boolean {
  const s = useSession();
  return s.status === 'authenticated' && hasFeature(s.me, key);
}
