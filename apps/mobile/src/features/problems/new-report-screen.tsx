import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/features/tasks/screen-header';
import { useTranslation } from 'react-i18next';

/** Placeholder until the form lands (Task 14 of the problem reports plan). */
export function NewReportScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScreenHeader title={t('mobile.problems.new.title')} />
    </Screen>
  );
}
