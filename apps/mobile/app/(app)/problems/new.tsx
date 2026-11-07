import { useLocalSearchParams } from 'expo-router';
import { NewReportScreen } from '@/features/problems/new-report-screen';

export default function NewReportRoute() {
  const { n } = useLocalSearchParams<{ n?: string }>();
  // Tabs keep a visited screen mounted, so each "+" press brings a new nonce: every visit gets its own form, media and location search.
  return <NewReportScreen key={n ?? 'new'} />;
}
