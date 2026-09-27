-- Reordered by hand: drop the tasks -> projects link before the table, since
-- DROP TABLE ... CASCADE already removes the foreign key.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "tasks_project_id_idx";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "project_id";--> statement-breakpoint
DROP TABLE "projects";--> statement-breakpoint
DROP TYPE "public"."project_status";--> statement-breakpoint
DROP TYPE "public"."project_visibility";
