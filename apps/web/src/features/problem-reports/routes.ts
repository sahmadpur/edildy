/** `/problems?tab=reports&report=<id>`: which tab, and a report row to highlight (notification deep links). */
export interface ProblemsSearch {
  tab?: 'checklist' | 'reports';
  report?: string;
}

export const problemsSearch = (s: Record<string, unknown>): ProblemsSearch => ({
  ...(s.tab === 'reports' || s.tab === 'checklist' ? { tab: s.tab } : {}),
  ...(typeof s.report === 'string' && s.report ? { report: s.report } : {}),
});
