import { FeatureGate } from '@/components/feature-gate';
import { TasksScreen } from '@/features/tasks/tasks-screen';

export default function TasksRoute() {
  return (
    <FeatureGate feature="tasks">
      <TasksScreen />
    </FeatureGate>
  );
}
