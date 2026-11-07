import type { OccurrenceView } from '@/offline/execution-store';
import type { LocalExecution } from '@/offline/local-model';

/** `rework` (spec §8.1, "Needs correction") sits above today's runs. */
export const GROUP_KEYS = ['rework', 'now', 'inProgress', 'upcoming', 'done'] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];
/** `preview`: a run not open yet, shown read-only with its questions (Nov 2026 feedback point 12). */
export type CardAction = 'start' | 'continue' | 'view' | 'preview' | 'none';

/** A run sent back to me for correction (spec §8.1). */
export interface ReworkCard {
  round: number;
  /** The manager's due date; null when none was set. */
  dueAt: string | null;
  /** How many items were sent back. */
  items: number;
}

export interface CardModel {
  occurrence: OccurrenceView;
  /** Past due and not finished: shown in red (FR-10.02). For a run to correct: its due date has passed. */
  overdue: boolean;
  /** Finished at or after due_at. */
  late: boolean;
  /** "Murad icra edir" when someone else holds the claim. */
  claimedBy: string | null;
  action: CardAction;
  /** Set on the cards of the `rework` group only. */
  rework: ReworkCard | null;
}

export type Groups = Record<GroupKey, CardModel[]>;

/** Closed for everyone but the executor of a run sent back for correction, whose execution decides first (spec §3.1). */
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['completed', 'partial', 'missed', 'cancelled', 'audit_pending', 'audited', 'correction_required']);
/** Done by someone: what the Tamamlanan list holds besides my own executions. */
const FINISHED_STATUSES: ReadonlySet<string> = new Set(['completed', 'partial', 'audit_pending', 'audited', 'correction_required']);

/** When my execution stopped being open: completed, locked at closes_at, or (refused, rejected) last changed. */
export function finishedAt(e: LocalExecution): number {
  return Date.parse(e.completedAt ?? e.lockedAt ?? e.updatedAt);
}

/**
 * Spec §7.3: İndi (open; overdue in red), Davam edən (my open execution), Gələcək (not open yet), Bitmiş (finished).
 * Nov 2026: Bitmiş keeps every finished run on the phone (about a week, `sync-pull.ts` prunes older ones; the Home
 * archive pages the rest from the API), newest first; a missed or cancelled run without an execution only today.
 * SP8 spec §8.1: runs sent back to me come first, whatever their date; they are not limited by closes_at.
 */
export function groupOccurrences(list: OccurrenceView[], userId: string, now: number, today: string): Groups {
  const groups: Groups = { rework: [], now: [], inProgress: [], upcoming: [], done: [] };
  for (const o of list) {
    const e = o.execution;
    const due = Date.parse(o.dueAt);
    const closes = Date.parse(o.closesAt);
    const claimedBy = o.claim && o.claim.executorUserId !== userId ? o.claim.executorName : null;
    if (e?.state === 'rework' && e.rework) {
      const dueAt = e.rework.dueAt;
      groups.rework.push({
        occurrence: o,
        overdue: dueAt !== null && now >= Date.parse(dueAt),
        late: false,
        claimedBy: null,
        action: 'continue',
        rework: { round: e.rework.round, dueAt, items: e.rework.items.length },
      });
    } else if (e?.state === 'active' && now < closes) {
      groups.inProgress.push({ occurrence: o, overdue: now >= due, late: false, claimedBy: null, action: 'continue', rework: null });
    } else if (e || CLOSED_STATUSES.has(o.status) || now >= closes) {
      // Nov 2026 feedback point 7: the worker sees every finished run the phone holds (the archive), not only today's.
      // A run nobody did (missed, cancelled) only matters on its own day.
      const keep = e !== null || FINISHED_STATUSES.has(o.status) || o.localDate === today;
      if (!keep) continue;
      const late = e?.completedAt ? Date.parse(e.completedAt) >= due : false;
      groups.done.push({ occurrence: o, overdue: false, late, claimedBy, action: e ? 'view' : 'none', rework: null });
    } else if (now < Date.parse(o.startsAt)) {
      groups.upcoming.push({ occurrence: o, overdue: false, late: false, claimedBy, action: 'preview', rework: null });
    } else {
      groups.now.push({ occurrence: o, overdue: now >= due || o.status === 'overdue', late: false, claimedBy, action: claimedBy ? 'none' : 'start', rework: null });
    }
  }
  groups.done.sort((a, b) => doneAt(b) - doneAt(a));
  return groups;
}

/** Newest first in the archive: when my execution finished, else the run's due time. */
function doneAt(c: CardModel): number {
  return c.occurrence.execution ? finishedAt(c.occurrence.execution) : Date.parse(c.occurrence.dueAt);
}

/** The four Home boxes, each opening the list of the same name below them (Nov 2026 feedback points 4–10). */
export const HOME_SECTIONS = ['myTasks', 'overdue', 'completed', 'upcoming'] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];
export type HomeSections = Record<HomeSection, CardModel[]>;
export type HomeStats = Record<HomeSection, number>;

/** A run that closed without anyone doing it: counted as late on its day, not as completed. */
const isMissed = (c: CardModel) => !c.occurrence.execution && (c.occurrence.status === 'missed' || c.occurrence.status === 'cancelled');

/**
 * Tapşırıqlar: my work now (runs to correct, open ones nobody else holds, my executions in progress), then open runs a
 * colleague holds (listed, not counted). Gecikən: the
 * overdue ones among them and today's missed runs. Tamamlanan: everything finished, newest first. Gələcək: not open yet.
 * Occurrences someone else holds are not my tasks; runs to correct are (Spec decision 6).
 */
export function homeSections(groups: Groups): HomeSections {
  const mine = [...groups.rework, ...groups.now.filter((c) => !c.claimedBy), ...groups.inProgress];
  return {
    // Open runs a colleague holds are listed after mine ("Murad icra edir") but not counted.
    myTasks: [...mine, ...groups.now.filter((c) => c.claimedBy)],
    overdue: [...mine.filter((c) => c.overdue), ...groups.done.filter((c) => isMissed(c) && c.occurrence.status === 'missed')],
    completed: groups.done.filter((c) => !isMissed(c)),
    upcoming: groups.upcoming,
  };
}

export function homeStats(sections: HomeSections): HomeStats {
  return { myTasks: sections.myTasks.filter((c) => !c.claimedBy).length, overdue: sections.overdue.length, completed: sections.completed.length, upcoming: sections.upcoming.length };
}
