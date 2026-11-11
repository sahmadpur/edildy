import { router } from 'expo-router';
import type { FeatureKey } from '@edildy/contracts';
import { useEffect, useRef } from 'react';
import { teamVisible } from '@/features/team/team-rules';
import { hasFeature } from '@/lib/features';
import { api, useSession } from '@/lib/session';
import { useOffline } from '@/offline/context';
import { rnAppState } from '@/offline/native/ports';
import { nativePush, notificationEvents, pushTokenStore } from './native';
import { createRouteContext, startTapRouting } from './notification-router';
import { startPushRegistration } from './push-registration';

/**
 * Spec §7.2–7.3, mounted inside OfflineProvider: it runs after login and at every start while signed in, once the user's
 * local store is ready (so a cold-start tap can look the occurrence up). Registration, taps and foreground receipts.
 * Without notifications in the plan (BR-01) the phone does not register for push; a tap on an older push still opens,
 * on Home when its screen's feature is off.
 */
export function NotificationsBridge() {
  const services = useOffline();
  const s = useSession();
  const canManageTasks = useRef(false);
  canManageTasks.current = s.status === 'authenticated' && s.me.permissions.includes('tasks.manage');
  const seesTeam = useRef(false);
  seesTeam.current = s.status === 'authenticated' && teamVisible(s.me);
  const features = useRef<readonly FeatureKey[]>([]);
  features.current = s.status === 'authenticated' ? s.me.tenant.subscription.features : [];
  const notificationsOn = s.status === 'authenticated' && hasFeature(s.me, 'notifications');
  useEffect(
    () => (notificationsOn ? startPushRegistration({ push: nativePush, tokens: pushTokenStore, api, appState: rnAppState(), userId: services.userId }) : undefined),
    [services.userId, notificationsOn],
  );
  useEffect(
    () =>
      startTapRouting({
        events: notificationEvents,
        ctx: createRouteContext(
          services,
          () => canManageTasks.current,
          () => seesTeam.current,
          (id) => api.notifications.markRead(id),
          (k) => features.current.includes(k),
        ),
        navigate: (route) => router.push(route),
      }),
    [services],
  );
  return null;
}
