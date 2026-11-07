-- Problem reports (2026-11-06 design §5): tenant isolation like every other tenant table (see 0010 for the pattern).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['problem_reports','problem_report_media']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Reports and their media are never deleted; the cleanup job purges objects of stale pending media and keeps the rows.
GRANT SELECT, INSERT, UPDATE ON problem_reports, problem_report_media TO taskop_app, taskop_platform;
