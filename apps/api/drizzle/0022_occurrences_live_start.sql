DROP INDEX "occurrences_live_day_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_live_start_uq" ON "occurrences" USING btree ("assignment_id","starts_at") WHERE status <> 'cancelled';