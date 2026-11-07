import { router } from 'expo-router';

/**
 * The run screens are hidden tabs, and a tab navigator with `backBehavior="history"` moves a route it jumps to to the
 * end of its history. So pushing the run again from the finish screen left the finish screen behind it, and the run's
 * back arrow then opened the finish screen (Nov 2026 feedback point 20). These helpers only ever go back.
 */

/** Leave the run: back to wherever it was opened from (Home, the inbox, a push), else Home. */
export function leaveRun(): void {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}

/** From the finish or resubmit screen back to the run, optionally jumping to one item (`focus` changes on every jump). */
export function backToRun(occurrenceId: string, jump?: { itemId: string; focus: string }): void {
  if (router.canGoBack()) {
    router.back();
    // The run is focused again now; a jump to the same route only changes its params, never the history.
    if (jump) router.navigate({ pathname: '/execution/[id]', params: { id: occurrenceId, ...jump } });
    return;
  }
  router.replace({ pathname: '/execution/[id]', params: jump ? { id: occurrenceId, ...jump } : { id: occurrenceId } });
}
