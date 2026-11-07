import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useOffline } from '@/offline/context';
import { type OccurrenceView, StartRefusedError } from '@/offline/execution-store';

/**
 * Start (or reopen) a run and show its execution screen. Shared by the Home cards and the preview of a run that has
 * just opened. The route param is the OCCURRENCE id (see the execution screen). `replace` swaps the preview for the run.
 */
export function useStartOccurrence() {
  const { t } = useTranslation();
  const services = useOffline();
  return async (o: Pick<OccurrenceView, 'id' | 'execution'>, opts: { replace?: boolean } = {}) => {
    const go = () => (opts.replace ? router.replace : router.push)({ pathname: '/execution/[id]', params: { id: o.id } });
    if (o.execution) return go(); // `store.start` is only for occurrences this phone has no execution of
    try {
      await services.store.start(o.id, services.userId);
      if (!opts.replace) go();
    } catch (e) {
      Alert.alert(e instanceof StartRefusedError ? t(`mobile.checklists.startBlocked.${e.reason}`) : t('errors.INTERNAL', { requestId: '—' }));
    }
  };
}
