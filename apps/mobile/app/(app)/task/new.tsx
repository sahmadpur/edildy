import { useLocalSearchParams } from 'expo-router';
import { FeatureGate } from '@/components/feature-gate';
import { CreateTaskScreen } from '@/features/tasks/create-task-screen';

export default function NewTaskRoute() {
  const { n, problemReportId } = useLocalSearchParams<{ n?: string; problemReportId?: string }>();
  // Tabs keep a visited screen mounted, so each "+" press brings a new nonce: every visit gets its own form, client id and photo cleanup.
  return (
    <FeatureGate feature="tasks">
      <CreateTaskScreen key={n ?? 'new'} problemReportId={problemReportId ?? null} />
    </FeatureGate>
  );
}
