import type { ChecklistSummary, ProblemSeverity, ReportFiltersQuery as ReportFilters, RunAuditState, RunBucket } from '@edildy/contracts';
import { queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/session';

/** Spec §6.1: the home page asks again every minute while it is visible. */
export const DASHBOARD_REFETCH_MS = 60_000;

export const reportKeys = {
  /** Every report query: invalidated by "Yenilə" and when a report's drawer closes. */
  all: ['reports'] as const,
  summary: (f: ReportFilters) => ['reports', 'summary', f] as const,
  sites: (f: ReportFilters) => ['reports', 'sites', f] as const,
  employees: (f: ReportFilters) => ['reports', 'employees', f] as const,
  runs: (f: ReportFilters, bucket: RunBucket, auditState: RunAuditState | null = null) => ['reports', 'runs', f, bucket, auditState] as const,
  problems: (f: ReportFilters, severity: ProblemSeverity | null) => ['reports', 'problems', f, severity] as const,
  tasks: (f: ReportFilters) => ['reports', 'tasks', f] as const,
};

/** Polling only while the tab is visible, and once more when the window gets focus back (decision 10). */
const LIVE = { refetchInterval: DASHBOARD_REFETCH_MS, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;

/** One period's summary; the home page runs six of these side by side (useQueries). */
export const summaryQueryOptions = (filters: ReportFilters, o: { live?: boolean } = {}) =>
  queryOptions({
    queryKey: reportKeys.summary(filters),
    queryFn: () => api.reports.summary(filters),
    ...(o.live ? LIVE : {}),
  });

/** `filters` is null while the filter bar shows a range the API would refuse: nothing is asked. */
export const useReportSummary = (filters: ReportFilters | null, o: { live?: boolean } = {}) =>
  useQuery({ ...summaryQueryOptions(filters!, o), enabled: filters !== null });

export const useSiteReport = (filters: ReportFilters) => useQuery({ queryKey: reportKeys.sites(filters), queryFn: () => api.reports.sites(filters) });

export const useEmployeeReport = (filters: ReportFilters) =>
  useQuery({ queryKey: reportKeys.employees(filters), queryFn: () => api.reports.employees(filters) });

/** Pages of 50, newest due first; "Daha çox göstər" passes nextCursor back with the same filters. */
export const useReportRuns = (filters: ReportFilters, bucket: RunBucket, auditState: RunAuditState | null = null) =>
  useInfiniteQuery({
    queryKey: reportKeys.runs(filters, bucket, auditState),
    queryFn: ({ pageParam }) => api.reports.runs({ ...filters, bucket, ...(auditState ? { auditState } : {}), ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** The counts come with every page and cover the whole filtered set (Part 1 decision 12): read them from the first. */
export const useReportProblems = (filters: ReportFilters, severity: ProblemSeverity | null) =>
  useInfiniteQuery({
    queryKey: reportKeys.problems(filters, severity),
    queryFn: ({ pageParam }) => api.reports.problems({ ...filters, ...(severity ? { severity } : {}), ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useReportTasks = (filters: ReportFilters) =>
  useInfiniteQuery({
    queryKey: reportKeys.tasks(filters),
    queryFn: ({ pageParam }) => api.reports.tasks({ ...filters, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** The employee picker: the period's employee report without its own filter (decision 4); shares the tab's cache. */
export function useEmployeeOptions(filters: ReportFilters | null) {
  const query: ReportFilters | null = filters
    ? { from: filters.from, to: filters.to, ...(filters.siteId ? { siteId: filters.siteId } : {}), ...(filters.checklistId ? { checklistId: filters.checklistId } : {}) }
    : null;
  return useQuery({
    queryKey: reportKeys.employees(query!),
    queryFn: () => api.reports.employees(query!),
    enabled: query !== null,
    staleTime: 5 * 60_000,
  });
}

/** Every checklist, deactivated ones included (the picker filters them), following nextCursor. */
export const useReportChecklistOptions = (enabled: boolean) =>
  useQuery({
    queryKey: ['checklists', 'report-options'],
    queryFn: async () => {
      const all: ChecklistSummary[] = [];
      let cursor: string | undefined;
      do {
        const p = await api.checklists.list({ limit: 200, ...(cursor ? { cursor } : {}) });
        all.push(...p.items);
        cursor = p.nextCursor ?? undefined;
      } while (cursor);
      return all;
    },
    enabled,
    staleTime: 5 * 60_000,
  });
