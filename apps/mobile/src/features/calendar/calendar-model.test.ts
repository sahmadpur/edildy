import type { OccurrenceDto } from '@edildy/contracts';
import { groupOccurrences } from '@/features/checklists/group-occurrences';
import { colors } from '@/lib/theme';
import type { OccurrenceView } from '@/offline/execution-store';
import {
  type CalendarEntry,
  columnDays,
  daySegments,
  entriesOn,
  localEntries,
  mergeEntries,
  MIN_BLOCK_MINUTES,
  monthWeeks,
  remoteEntry,
  stepAnchor,
  viewRange,
  weekdayOf,
  weekStart,
} from './calendar-model';

const TZ = 'Asia/Baku'; // UTC+4, no daylight saving
/** An instant given as Baku wall time on a day. */
const at = (day: string, hhmm: string) => new Date(Date.parse(`${day}T${hhmm}:00.000+04:00`)).toISOString();
const entry = (id: string, day: string, from: string, to: string, over: Partial<CalendarEntry> = {}): CalendarEntry => ({
  id,
  name: id,
  site: 'Bakı filialı 1',
  localDate: day,
  startsAt: at(day, from),
  dueAt: at(day, to),
  closesAt: at(day, to),
  statusKey: null,
  doneBy: null,
  color: colors.primary,
  allDay: false,
  target: null,
  ...over,
});

describe('calendar dates', () => {
  it('starts weeks on Monday', () => {
    expect(weekdayOf('2026-11-02')).toBe(1);
    expect(weekdayOf('2026-11-08')).toBe(7);
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
  });

  it('lays a month out in whole weeks, only as many as it needs', () => {
    const nov = monthWeeks('2026-11-15'); // 1 Nov 2026 is a Sunday
    expect(nov).toHaveLength(6);
    expect(nov[0]![0]).toBe('2026-10-26');
    expect(nov[0]![6]).toBe('2026-11-01');
    expect(nov[5]![6]).toBe('2026-12-06');
    expect(monthWeeks('2027-02-10')).toHaveLength(4); // 1 Feb 2027 is a Monday, 28 days
    expect(viewRange('month', '2026-11-15')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
  });

  it('shows one or three days from the anchor and steps by the view’s period', () => {
    expect(columnDays('day', '2026-11-30')).toEqual(['2026-11-30']);
    expect(columnDays('threeDays', '2026-11-30')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(viewRange('threeDays', '2026-11-30')).toEqual({ from: '2026-11-30', to: '2026-12-02' });
    expect(stepAnchor('day', '2026-11-30', 1, '2026-11-08')).toBe('2026-12-01');
    expect(stepAnchor('threeDays', '2026-11-30', -1, '2026-11-08')).toBe('2026-11-27');
    // A month step lands on the 1st, or on today inside today's month.
    expect(stepAnchor('month', '2026-11-15', 1, '2026-11-08')).toBe('2026-12-01');
    expect(stepAnchor('month', '2026-12-20', -1, '2026-11-08')).toBe('2026-11-08');
    expect(stepAnchor('month', '2026-01-31', -1, '2026-11-08')).toBe('2025-12-01');
  });
});

describe('daySegments', () => {
  const day = '2026-11-02';

  it('places runs by their local time and lays clashing ones side by side', () => {
    const segs = daySegments([entry('a', day, '08:00', '11:00'), entry('b', day, '09:00', '10:00'), entry('c', day, '11:00', '12:00')], day, TZ);
    const by = Object.fromEntries(segs.map((s) => [s.entry.id, s]));
    expect(by.a).toMatchObject({ top: 480, bottom: 660, col: 0, cols: 2 });
    expect(by.b).toMatchObject({ top: 540, bottom: 600, col: 1, cols: 2 });
    // Starts as `a` ends: a new cluster with the full width.
    expect(by.c).toMatchObject({ top: 660, bottom: 720, col: 0, cols: 1 });
  });

  it('gives a short run room for its name and splits a night run across midnight', () => {
    const short = daySegments([entry('s', day, '08:00', '08:10')], day, TZ)[0]!;
    expect(short.bottom - short.top).toBe(MIN_BLOCK_MINUTES);
    const night = entry('n', day, '22:00', '23:59', { closesAt: at('2026-11-03', '02:00') });
    expect(daySegments([night], day, TZ)[0]).toMatchObject({ top: 1320, bottom: 1440 });
    expect(daySegments([night], '2026-11-03', TZ)[0]).toMatchObject({ top: 0, bottom: 120 });
    expect(daySegments([night], '2026-11-04', TZ)).toEqual([]);
  });

  it('leaves whole-day runs to the all-day strip', () => {
    const whole = entry('w', day, '00:00', '00:00', { allDay: true });
    expect(daySegments([whole], day, TZ)).toEqual([]);
    expect(entriesOn([entry('x', day, '10:00', '11:00'), whole], day).map((e) => e.id)).toEqual(['w', 'x']);
  });
});

describe('entries', () => {
  const view = (over: Partial<OccurrenceView>): OccurrenceView => ({
    id: 'o1',
    checklistId: 'c',
    checklistName: 'Açılış yoxlaması',
    siteId: 's',
    siteName: 'Bakı filialı 1',
    shiftName: null,
    localDate: '2026-11-02',
    startsAt: at('2026-11-02', '08:00'),
    dueAt: at('2026-11-02', '10:00'),
    closesAt: at('2026-11-02', '11:00'),
    status: 'pending',
    checklistVersionId: 'v',
    claim: null,
    execution: null,
    unsynced: false,
    ...over,
  });

  it('takes the Home colour and action of each run on the phone', () => {
    const now = Date.parse(at('2026-11-02', '09:00'));
    const groups = groupOccurrences(
      [
        view({}),
        view({ id: 'o2', claim: { executionId: 'e9', executorUserId: 'other', executorName: 'Murad' } }),
        view({ id: 'o3', startsAt: at('2026-11-02', '00:00'), dueAt: at('2026-11-03', '00:00'), closesAt: at('2026-11-03', '00:00') }),
      ],
      'me',
      now,
      '2026-11-02',
    );
    const by = Object.fromEntries(localEntries(groups, TZ).map((e) => [e.id, e]));
    expect(by.o1).toMatchObject({ color: colors.primary, target: { kind: 'run', occurrenceId: 'o1' }, allDay: false, statusKey: null });
    // Past due and still open: red, with the Home card's "Gecikir".
    const late = localEntries(groupOccurrences([view({})], 'me', Date.parse(at('2026-11-02', '10:30')), '2026-11-02'), TZ)[0]!;
    expect(late).toMatchObject({ color: colors.danger, statusKey: 'mobile.checklists.overdue' });
    // Someone else holds it: shown, not opened from here.
    expect(by.o2!.target).toBeNull();
    expect(by.o3!.allDay).toBe(true);
  });

  const dto = (over: Partial<OccurrenceDto>): OccurrenceDto => ({
    id: 'r1',
    assignmentId: 'a',
    assignmentName: null,
    checklistId: 'c',
    checklistName: 'Kassa yoxlaması',
    siteId: 's',
    siteName: 'Bakı filialı 2',
    shiftId: null,
    shiftName: null,
    localDate: '2026-10-20',
    startsAt: at('2026-10-20', '09:00'),
    dueAt: at('2026-10-20', '10:00'),
    closesAt: at('2026-10-20', '11:00'),
    status: 'completed',
    statusChangedAt: at('2026-10-20', '09:40'),
    cancelReason: null,
    assigneeIds: [],
    unassigned: false,
    executionBrief: null,
    ...over,
  });

  it('opens a server-only run I did on its archive page, names a colleague’s, and colours it by status', () => {
    const now = Date.parse(at('2026-11-02', '09:00'));
    const brief = { executionId: 'e1', executorName: 'Aysel', state: 'completed' as const, progress: { answered: 3, total: 3, requiredMissing: 0 }, scorePercent: 100, late: false, clockSuspect: false };
    expect(remoteEntry(dto({ executionBrief: brief }), TZ, now, 'Aysel')).toMatchObject({ color: colors.success, target: { kind: 'archive', executionId: 'e1' }, doneBy: null, statusKey: 'executions.states.completed' });
    // Assigned to me, done by Kamran: GET /executions/:id would answer 404, so it only says who did it.
    expect(remoteEntry(dto({ executionBrief: { ...brief, executorName: 'Kamran' } }), TZ, now, 'Aysel')).toMatchObject({ target: null, doneBy: 'Kamran' });
    expect(remoteEntry(dto({ id: 'r2', status: 'missed' }), TZ, now, 'Aysel')).toMatchObject({ color: colors.danger, target: null, statusKey: 'scheduling.statuses.missed' });
  });

  it('keeps the phone’s copy of a run the server also returns', () => {
    const local = entry('same', '2026-11-02', '08:00', '09:00', { name: 'phone' });
    const merged = mergeEntries([local], [entry('same', '2026-11-02', '08:00', '09:00', { name: 'server' }), entry('old', '2026-10-20', '08:00', '09:00')]);
    expect(merged.map((e) => `${e.id}:${e.name}`)).toEqual(['same:phone', 'old:old']);
  });
});
