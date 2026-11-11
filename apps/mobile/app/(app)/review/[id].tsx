import { useLocalSearchParams } from 'expo-router';
import { FeatureGate } from '@/components/feature-gate';
import { ReviewScreen } from '@/features/tasks/review-screen';

export default function ReviewRoute() {
  const { id, n } = useLocalSearchParams<{ id: string; n?: string }>();
  // The nonce makes every visit to the same task a fresh screen: nothing from a decision made earlier stays on it.
  return (
    <FeatureGate feature="tasks">
      <ReviewScreen key={`${id}:${n ?? ''}`} taskId={id} />
    </FeatureGate>
  );
}
