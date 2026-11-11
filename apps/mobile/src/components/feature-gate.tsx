import type { FeatureKey } from '@edildy/contracts';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { hasFeature } from '@/lib/features';
import { useSession } from '@/lib/session';

/**
 * Like TeamGate, for a plan feature (BR-01): a hidden tab or screen is still reachable by a deep link or a typed route,
 * so the route sends the viewer Home when the plan lacks the feature. A plan change on a profile refresh redirects too.
 */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const s = useSession();
  if (s.status !== 'authenticated') return null;
  if (!hasFeature(s.me, feature)) return <Redirect href="/" />;
  return <>{children}</>;
}
