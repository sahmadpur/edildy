ALTER TYPE "public"."notification_target_kind" ADD VALUE 'problem_report' BEFORE 'none';--> statement-breakpoint
CREATE TABLE "problem_report_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"source" "media_source" NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"captured_at" timestamp with time zone NOT NULL,
	"captured_by_user_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone,
	"storage_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_report_media_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "problem_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"severity" "problem_severity" NOT NULL,
	"text" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"accuracy_m" real,
	"location_at" timestamp with time zone,
	"reported_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid,
	"close_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_reports_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "problem_reports_location_ck" CHECK (num_nonnulls("problem_reports"."lat", "problem_reports"."lng", "problem_reports"."location_at") in (0, 3)),
	CONSTRAINT "problem_reports_closed_ck" CHECK (num_nonnulls("problem_reports"."closed_at", "problem_reports"."closed_by_user_id", "problem_reports"."close_comment") in (0, 3))
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "problem_report_id" uuid;--> statement-breakpoint
ALTER TABLE "problem_report_media" ADD CONSTRAINT "problem_report_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report_media" ADD CONSTRAINT "problem_report_media_report_fk" FOREIGN KEY ("tenant_id","report_id") REFERENCES "public"."problem_reports"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_report_media" ADD CONSTRAINT "problem_report_media_captured_by_fk" FOREIGN KEY ("tenant_id","captured_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_site_fk" FOREIGN KEY ("tenant_id","site_id") REFERENCES "public"."sites"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_reporter_fk" FOREIGN KEY ("tenant_id","reporter_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_closed_by_fk" FOREIGN KEY ("tenant_id","closed_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "problem_report_media_report_idx" ON "problem_report_media" USING btree ("tenant_id","report_id");--> statement-breakpoint
CREATE INDEX "problem_report_media_status_idx" ON "problem_report_media" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "problem_reports_site_idx" ON "problem_reports" USING btree ("tenant_id","site_id","created_at");--> statement-breakpoint
CREATE INDEX "problem_reports_reporter_idx" ON "problem_reports" USING btree ("tenant_id","reporter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "problem_reports_open_idx" ON "problem_reports" USING btree ("tenant_id","created_at") WHERE closed_at is null;--> statement-breakpoint
CREATE INDEX "problem_reports_created_idx" ON "problem_reports" USING btree ("tenant_id","created_at","id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_problem_report_fk" FOREIGN KEY ("tenant_id","problem_report_id") REFERENCES "public"."problem_reports"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_problem_report_active_uq" ON "tasks" USING btree ("problem_report_id") WHERE status <> 'cancelled' and problem_report_id is not null;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_one_source_ck" CHECK ("tasks"."problem_id" is null or "tasks"."problem_report_id" is null);