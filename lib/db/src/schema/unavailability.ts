import { pgTable, serial, integer, date, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { readersTable } from "./readers";

export const SHIFT_VALUES = ["morning", "evening", "all"] as const;
export type Shift = typeof SHIFT_VALUES[number];

export const unavailabilityTable = pgTable(
  "unavailability",
  {
    id: serial("id").primaryKey(),
    readerId: integer("reader_id")
      .notNull()
      .references(() => readersTable.id, { onDelete: "cascade" }),
    blockedDate: date("blocked_date").notNull(),
    shift: text("shift").notNull().default("all"),
  },
  (t) => [unique().on(t.readerId, t.blockedDate)]
);

export const insertUnavailabilitySchema = createInsertSchema(unavailabilityTable, {
  readerId: z.number().int().positive(),
  blockedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  shift: z.enum(["morning", "evening", "all"]).optional(),
}).omit({ id: true });

export type InsertUnavailability = z.infer<typeof insertUnavailabilitySchema>;
export type Unavailability = typeof unavailabilityTable.$inferSelect;
