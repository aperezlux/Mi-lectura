import { pgTable, serial, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { generationConfigurationsTable } from "./generation-configurations";
import { liturgicalFunctionsTable } from "./liturgical-functions";

export const generationFunctionAssignmentsTable = pgTable(
  "generation_function_assignments",
  {
    id: serial("id").primaryKey(),
    generationConfigurationId: integer("generation_configuration_id")
      .notNull()
      .references(() => generationConfigurationsTable.id, { onDelete: "cascade" }),
    functionId: integer("function_id")
      .notNull()
      .references(() => liturgicalFunctionsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.generationConfigurationId, table.functionId)]
);

export const insertGenerationFunctionAssignmentSchema = createInsertSchema(generationFunctionAssignmentsTable, {
  generationConfigurationId: z.number().int().positive(),
  functionId: z.number().int().positive(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateGenerationFunctionAssignmentSchema = insertGenerationFunctionAssignmentSchema.partial();

export type InsertGenerationFunctionAssignment = z.infer<typeof insertGenerationFunctionAssignmentSchema>;
export type UpdateGenerationFunctionAssignment = z.infer<typeof updateGenerationFunctionAssignmentSchema>;
export type GenerationFunctionAssignment = typeof generationFunctionAssignmentsTable.$inferSelect;
