import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { teamVisible } from './team-rules';

/**
 * Decision 1: the Team routes check access themselves, because a hidden tab is still reachable by URL (a deep link, a
 * typed route). Without access (or reports in the plan) the viewer lands on Home. A profile refresh that removes access redirects an open screen.
 */
export function TeamGate({ children }: { children: ReactNode }) {
  const s = useSession();
  if (s.status !== 'authenticated') return null;
  if (!teamVisible(s.me)) return <Redirect href="/" />;
  return <>{children}</>;
}
