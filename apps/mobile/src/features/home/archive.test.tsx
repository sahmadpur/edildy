import { fireEvent, screen, within } from '@testing-library/react-native';
import type { OccurrenceDto } from '@edildy/contracts';
import { renderWithServices } from '@/offline/testing/render';
import { createTestServices } from '@/offline/testing/test-services';
import { ArchiveMore } from './archive';

const mockPush = jest.fn();
const mockMine = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', offline: false, me: { user: { fullName: 'Aysel Əliyeva' } } }),
  api: { occurrences: { mine: (...a: unknown[]) => mockMine(...a) } },
}));

const run = (id: string, executionId: string, executorName: string, startsAt: string): OccurrenceDto => ({
  id,
  assignmentId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e98',
  assignmentName: null,
  checklistId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e30',
  checklistName: 'Anbar yoxlaması',
  siteId: '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e40',
  siteName: 'Bakı filialı 1',
  shiftId: null,
  shiftName: null,
  localDate: startsAt.slice(0, 10),
  startsAt,
  dueAt: startsAt,
  closesAt: startsAt,
  status: 'completed',
  statusChangedAt: startsAt,
  cancelReason: null,
  assigneeIds: [],
  unassigned: false,
  executionBrief: { executionId, executorName, state: 'completed', progress: { answered: 3, total: 3, requiredMissing: 0 }, scorePercent: 100, late: false, clockSuspect: false },
});

beforeEach(() => {
  mockPush.mockClear();
  mockMine.mockReset();
});

describe('Home archive', () => {
  it('opens my older runs and only names the colleague on runs assigned to me that they did', async () => {
    const t = await createTestServices({ online: true });
    const mine = run('0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e91', '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e81', 'Aysel Əliyeva', '2026-10-20T05:00:00.000Z');
    const theirs = run('0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e92', '0192f1e2-7c3a-7b4d-8e5f-0a1b2c3d4e82', 'Kamran Rzayev', '2026-10-21T05:00:00.000Z');
    mockMine.mockResolvedValue({ items: [mine, theirs], nextCursor: null });
    await renderWithServices(t.services, <ArchiveMore knownIds={new Set()} today="2026-11-02" timeZone="Asia/Baku" />);
    await fireEvent.press(screen.getByTestId('archive-more'));

    await fireEvent.press(await screen.findByTestId(`archive-${mine.id}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/archive/[id]', params: { id: mine.executionBrief!.executionId } });
    expect(within(screen.getByTestId(`archive-${mine.id}`)).queryByText(/İcra edən/)).toBeNull();

    // GET /executions/:id would answer 404 for Kamran's execution: the row says who did it and does not open.
    mockPush.mockClear();
    const row = screen.getByTestId(`archive-${theirs.id}`);
    expect(within(row).getByText('İcra edən: Kamran Rzayev')).toBeTruthy();
    expect(row.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(row);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
