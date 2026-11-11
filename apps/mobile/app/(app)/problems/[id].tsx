import { useLocalSearchParams } from 'expo-router';
import { FeatureGate } from '@/components/feature-gate';
import { ReportScreen } from '@/features/problems/report-screen';

export default function ReportRoute() {
  const { id, remote } = useLocalSearchParams<{ id: string; remote?: string }>();
  return (
    <FeatureGate feature="problems">
      <ReportScreen key={id} id={id} remote={remote === '1'} />
    </FeatureGate>
  );
}
