import { FeatureGate } from '@/components/feature-gate';
import { InboxScreen } from '@/features/notifications/inbox-screen';

export default function NotificationsRoute() {
  return (
    <FeatureGate feature="notifications">
      <InboxScreen />
    </FeatureGate>
  );
}
