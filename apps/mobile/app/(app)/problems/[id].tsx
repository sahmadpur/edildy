import { useLocalSearchParams } from 'expo-router';
import { ReportScreen } from '@/features/problems/report-screen';

export default function ReportRoute() {
  const { id, remote } = useLocalSearchParams<{ id: string; remote?: string }>();
  return <ReportScreen key={id} id={id} remote={remote === '1'} />;
}
