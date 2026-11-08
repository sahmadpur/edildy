import { router } from 'expo-router';
import { colors } from '@/lib/theme';
import type { CalendarEntry } from './calendar-model';

/** A block's soft fill and text colour, from its dot colour. */
const TINTS: Record<string, { bg: string; fg: string }> = {
  [colors.primary]: { bg: colors.primarySoft, fg: colors.primaryDeep },
  [colors.danger]: { bg: colors.dangerSoft, fg: colors.dangerText },
  [colors.warning]: { bg: colors.warningSoft, fg: colors.warningText },
  [colors.success]: { bg: colors.successSoft, fg: colors.successText },
  [colors.planned]: { bg: colors.plannedSoft, fg: colors.plannedText },
};

export const tintOf = (color: string) => TINTS[color] ?? { bg: colors.fill, fg: colors.text };

/**
 * The route param of a run is the OCCURRENCE id, like Home (the execution screen resolves the current execution, and
 * shows a run not open yet read-only); a run only the server holds opens on its archive page.
 */
export function openEntry(e: CalendarEntry): void {
  if (e.target?.kind === 'run') router.push({ pathname: '/execution/[id]', params: { id: e.target.occurrenceId } });
  else if (e.target?.kind === 'archive') router.push({ pathname: '/archive/[id]', params: { id: e.target.executionId } });
}
