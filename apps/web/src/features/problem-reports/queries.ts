import type { CloseProblemReportInput, ProblemReportListQuery } from '@edildy/contracts';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MediaUrlSource } from '@/features/executions/queries';
import { api } from '@/lib/session';

export type ReportFilters = Omit<ProblemReportListQuery, 'cursor' | 'limit'>;

export const reportKeys = { all: ['problem-reports'] as const, list: (f: ReportFilters) => ['problem-reports', 'list', f] as const };

/** Newest first, 50 per page; the tab asks for more with "Daha çox göstər". */
export const useProblemReports = (filters: ReportFilters, enabled = true) =>
  useInfiniteQuery({
    queryKey: reportKeys.list(filters),
    queryFn: ({ pageParam }) => api.problemReports.list({ ...filters, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

/** POST /problem-reports/:id/close; the lists refetch (the report's state changed; its tasks are unaffected). */
export function useCloseProblemReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CloseProblemReportInput }) => api.problemReports.close(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

/** GET /problem-report-media/:id/url: a report's media, for anyone who can read the report. */
export const REPORT_MEDIA_SOURCE: MediaUrlSource = { key: (id) => ['problem-report-media', 'url', id], fetch: (id) => api.problemReportMedia.url(id) };

/** GET /tasks/:id/report-media/:mediaId/url: the source report's media, for task readers. */
export const taskReportMediaSource = (taskId: string): MediaUrlSource => ({
  key: (id) => ['tasks', 'report-media', taskId, id],
  fetch: (id) => api.tasks.reportMediaUrl(taskId, id),
});
