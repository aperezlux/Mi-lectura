import { pgTable, serial, integer, date, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { readersTable } from "./readers";
import { massSchedulesTable } from "./schedules";

export const calendarTable = pgTable("calendar", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  role: text("role").notNull(),
  scheduleId: integer("schedule_id").references(() => massSchedulesTable.id, { onDelete: "set null" }),
  readerId: integer("reader_id").references(() => readersTable.id, { onDelete: "set null" }),
  logisticComment: text("logistic_comment"),
  isVacant: boolean("is_vacant").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  liturgicalSeason: text("liturgical_season"),
  versionTimestamp: timestamp("version_timestamp").notNull().defaultNow(),
});

export const insertCalendarSchema = createInsertSchema(calendarTable, {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  role: z.string().min(1).max(200),
  readerId: z.number().int().positive().optional().nullable(),
  logisticComment: z.string().max(500).optional().nullable(),
  isVacant: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  liturgicalSeason: z.string().optional().nullable(),
}).omit({ id: true, versionTimestamp: true });

export const updateCalendarSchema = z.object({
  readerId: z.number().int().positive().optional().nullable(),
  role: z.string().min(1).max(200).optional(),
  logisticComment: z.string().max(500).optional().nullable(),
  isVacant: z.boolean().optional(),
});

export type InsertCalendar = z.infer<typeof insertCalendarSchema>;
export type UpdateCalendar = z.infer<typeof updateCalendarSchema>;
export type Calendar = typeof calendarTable.$inferSelect;
