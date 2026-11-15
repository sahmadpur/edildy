import { type Indicator, indicatorOf, type OccurrenceStatus } from '@edildy/contracts';
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
  /** The group the card was sorted into; it sets the card's dot colour wherever the card is listed. */
  group: GroupKey;
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
 * Spec §7.3: İşə başla (open; overdue in red), Davam edən (my open execution), Planlanmış (not open yet), Bitmiş (finished).
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
        group: 'rework',
        overdue: dueAt !== null && now >= Date.parse(dueAt),
        late: false,
        claimedBy: null,
        action: 'continue',
        rework: { round: e.rework.round, dueAt, items: e.rework.items.length },
      });
    } else if (e?.state === 'active' && now < closes) {
      groups.inProgress.push({ occurrence: o, group: 'inProgress', overdue: now >= due, late: false, claimedBy: null, action: 'continue', rework: null });
    } else if (e || CLOSED_STATUSES.has(o.status) || now >= closes) {
      // Nov 2026 feedback point 7: the worker sees every finished run the phone holds (the archive), not only today's.
      // A run nobody did (missed, cancelled) only matters on its own day.
      const keep = e !== null || FINISHED_STATUSES.has(o.status) || o.localDate === today;
      if (!keep) continue;
      const late = e?.completedAt ? Date.parse(e.completedAt) >= due : false;
      groups.done.push({ occurrence: o, group: 'done', overdue: false, late, claimedBy, action: e ? 'view' : 'none', rework: null });
    } else if (now < Date.parse(o.startsAt)) {
      groups.upcoming.push({ occurrence: o, group: 'upcoming', overdue: false, late: false, claimedBy, action: 'preview', rework: null });
    } else {
      groups.now.push({ occurrence: o, group: 'now', overdue: now >= due || o.status === 'overdue', late: false, claimedBy, action: claimedBy ? 'none' : 'start', rework: null });
    }
  }
  groups.done.sort((a, b) => doneAt(b) - doneAt(a));
  return groups;
}

/** Newest first in the archive: when my execution finished, else the run's due time. */
function doneAt(c: CardModel): number {
  return c.occurrence.execution ? finishedAt(c.occurrence.execution) : Date.parse(c.occurrence.dueAt);
}

/** İşə başla (always on top), then the three Göstərici lists, each opened by the box of the same name (feedback 2026-11-15). */
export const HOME_SECTIONS = ['myTasks', 'late', 'completed', 'planned'] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];
/** The boxes over the folding lists. İşə başla has no box: its list is shown on top whenever it holds a run. */
export const HOME_BOXES = ['late', 'completed', 'planned'] as const satisfies readonly HomeSection[];
export type HomeBox = (typeof HOME_BOXES)[number];
export type HomeSections = Record<HomeSection, CardModel[]>;
export type HomeStats = Record<HomeSection, number>;

const DONE_BY_SERVER: ReadonlySet<string> = new Set(['completed', 'audit_pending', 'audited']);

/**
 * The status the server would show for the card right now. The phone's copy can lag: my own execution may not have
 * reached the server yet (it decides first), and the server jobs move pending → overdue at due_at → missed at
 * closes_at and started/in_progress → partial at closes_at.
 */
export function effectiveStatus(c: CardModel, now: number): OccurrenceStatus {
  const o = c.occurrence;
  const e = o.execution;
  const closed = now >= Date.parse(o.closesAt);
  switch (e?.state) {
    case 'rework':
      return 'correction_required';
    case 'completed':
      // Finished here (a resubmitted correction too): completed, or the audit state the server already gave it.
      return DONE_BY_SERVER.has(o.status) ? o.status : 'completed';
    case 'partial':
      return 'partial';
    case 'active':
      return closed ? 'partial' : 'in_progress';
  }
  if (now < Date.parse(o.startsAt)) return o.status;
  switch (o.status) {
    case 'pending':
      return closed ? 'missed' : now >= Date.parse(o.dueAt) ? 'overdue' : 'pending';
    case 'overdue':
      return closed ? 'missed' : 'overdue';
    case 'started':
    case 'in_progress':
      return closed ? 'partial' : o.status;
    default:
      return o.status;
  }
}

/** The Göstərici of a card: the web's rule (INDICATOR_STATUSES) over its effective status. */
export const cardIndicator = (c: CardModel, now: number): Indicator | null => indicatorOf(effectiveStatus(c, now));

/**
 * İşə başla: my work now (runs to correct, open ones nobody else holds, my executions in progress), then open runs a
 * colleague holds (listed, not counted). Gecikən, Tamamlanan and Planlanmış sort every run on the phone by the same
 * status rule as the web (feedback 2026-11-15); open runs a colleague holds are theirs, so they count in none, and a
 * cancelled run in none. Occurrences someone else holds are not my tasks; runs to correct are (Spec decision 6).
 */
export function homeSections(groups: Groups, now: number): HomeSections {
  const mine = [...groups.rework, ...groups.now.filter((c) => !c.claimedBy), ...groups.inProgress];
  const all = [...mine, ...groups.upcoming, ...groups.done];
  const of = (k: Indicator) => all.filter((c) => cardIndicator(c, now) === k);
  return {
    // Open runs a colleague holds are listed after mine ("Murad icra edir") but not counted.
    myTasks: [...mine, ...groups.now.filter((c) => c.claimedBy)],
    late: of('late'),
    completed: of('completed'),
    planned: of('planned'),
  };
}

export function homeStats(sections: HomeSections): HomeStats {
  return { myTasks: sections.myTasks.filter((c) => !c.claimedBy).length, late: sections.late.length, completed: sections.completed.length, planned: sections.planned.length };
}
