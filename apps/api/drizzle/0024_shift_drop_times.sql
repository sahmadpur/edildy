ALTER TABLE "shifts" DROP CONSTRAINT "shifts_nonzero_ck";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "end_time";