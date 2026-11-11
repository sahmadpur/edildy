import { FeatureGate } from '@/components/feature-gate';
import { ProblemsScreen } from '@/features/problems/problems-screen';

export default function ProblemsRoute() {
  return (
    <FeatureGate feature="problems">
      <ProblemsScreen />
    </FeatureGate>
  );
}
