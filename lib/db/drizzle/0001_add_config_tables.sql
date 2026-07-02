CREATE TABLE IF NOT EXISTS "generation_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_type" text NOT NULL,
	"label" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_configurations_day_type_unique" UNIQUE("day_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "liturgical_functions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color" text,
	"icon" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"requires_reader" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "liturgical_functions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_function_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"generation_configuration_id" integer NOT NULL,
	"function_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_function_assignments_generation_configuration_id_function_id_unique" UNIQUE("generation_configuration_id","function_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "generation_function_assignments" ADD CONSTRAINT "generation_function_assignments_generation_configuration_id_generation_configurations_id_fk" FOREIGN KEY ("generation_configuration_id") REFERENCES "public"."generation_configurations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "generation_function_assignments" ADD CONSTRAINT "generation_function_assignments_function_id_liturgical_functions_id_fk" FOREIGN KEY ("function_id") REFERENCES "public"."liturgical_functions"("id") ON DELETE cascade ON UPDATE no action;