import { pgTable, serial, text, boolean, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationConfigurationsTable = pgTable(
  "generation_configurations",
  {
    id: serial("id").primaryKey(),
    dayType: text("day_type").notNull().unique(),
    label: text("label").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.dayType)]
);

export const insertGenerationConfigurationSchema = createInsertSchema(generationConfigurationsTable, {
  dayType: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateGenerationConfigurationSchema = insertGenerationConfigurationSchema.partial();

export type InsertGenerationConfiguration = z.infer<typeof insertGenerationConfigurationSchema>;
export type UpdateGenerationConfiguration = z.infer<typeof updateGenerationConfigurationSchema>;
export type GenerationConfiguration = typeof generationConfigurationsTable.$inferSelect;
