-- Shifts with several periods (feedback 2026-11-11, item 12): each shift's single start/end becomes its first period.
ALTER TABLE "shifts" ADD COLUMN "ranges" jsonb;--> statement-breakpoint
UPDATE "shifts" SET "ranges" = jsonb_build_array(jsonb_build_object('startTime', to_char("start_time", 'HH24:MI'), 'endTime', to_char("end_time", 'HH24:MI')));--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "ranges" SET NOT NULL;
