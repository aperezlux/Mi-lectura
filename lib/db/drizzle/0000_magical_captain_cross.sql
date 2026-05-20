CREATE TABLE "readers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"level" text DEFAULT 'Principiante' NOT NULL,
	"pin" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unavailability" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"blocked_date" date NOT NULL,
	"shift" text DEFAULT 'all' NOT NULL,
	CONSTRAINT "unavailability_reader_id_blocked_date_unique" UNIQUE("reader_id","blocked_date")
);
--> statement-breakpoint
CREATE TABLE "calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"role" text NOT NULL,
	"schedule_id" integer,
	"reader_id" integer,
	"logistic_comment" text,
	"is_vacant" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"liturgical_season" text,
	"version_timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mass_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"day_type" text NOT NULL,
	"time" text DEFAULT '06:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unavailability" ADD CONSTRAINT "unavailability_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_schedule_id_mass_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."mass_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;