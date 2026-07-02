import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const liturgicalFunctionsTable = pgTable("liturgical_functions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  color: text("color"),
  icon: text("icon"),
  isVisible: boolean("is_visible").notNull().default(true),
  requiresReader: boolean("requires_reader").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLiturgicalFunctionSchema = createInsertSchema(liturgicalFunctionsTable, {
  name: z.string().min(1).max(100),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  color: z.string().max(100).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  isVisible: z.boolean().optional(),
  requiresReader: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateLiturgicalFunctionSchema = insertLiturgicalFunctionSchema.partial();

export type InsertLiturgicalFunction = z.infer<typeof insertLiturgicalFunctionSchema>;
export type UpdateLiturgicalFunction = z.infer<typeof updateLiturgicalFunctionSchema>;
export type LiturgicalFunction = typeof liturgicalFunctionsTable.$inferSelect;
