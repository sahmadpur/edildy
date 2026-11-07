import { useLocalSearchParams } from 'expo-router';
import { ArchiveRunScreen } from '@/features/home/archive-run-screen';

/** `id` is the EXECUTION id of an older finished run, read online (GET /executions/:id). */
export default function ArchiveRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ArchiveRunScreen key={id} executionId={id} />;
}
