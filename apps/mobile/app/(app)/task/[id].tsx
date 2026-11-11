import { useLocalSearchParams } from 'expo-router';
import { FeatureGate } from '@/components/feature-gate';
import { TaskScreen } from '@/features/tasks/task-screen';

export default function TaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A new key per task, so a capture in progress never lands on another task.
  return (
    <FeatureGate feature="tasks">
      <TaskScreen key={id} taskId={id} />
    </FeatureGate>
  );
}
