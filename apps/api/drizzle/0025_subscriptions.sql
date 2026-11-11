CREATE TYPE "public"."subscription_period" AS ENUM('monthly', 'quarterly', 'half_year', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('basic', 'pro', 'enterprise', 'xl');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan" "subscription_plan" DEFAULT 'xl' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_period" "subscription_period" DEFAULT 'yearly' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_starts_on" date DEFAULT current_date NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_ends_on" date;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "branch_limit" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "extra_features" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "staff_limit_override" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "worker_limit_override" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "expiry_notice" text;--> statement-breakpoint
-- Existing organisations keep everything (XL, no end date) until Edildy staff assign their real plan; their branch
-- limit starts at the active top-level sites they already have, so nothing they own is over the limit.
-- The backfill must see every tenant's rows (see 0004 for why row_security is switched off).
SET LOCAL row_security = off;--> statement-breakpoint
UPDATE "tenants" t SET
  "plan_starts_on" = t."created_at"::date,
  "branch_limit" = greatest(1, (SELECT count(*) FROM "sites" s WHERE s."tenant_id" = t."id" AND s."parent_id" IS NULL AND s."active"));--> statement-breakpoint
SET LOCAL row_security = on;
