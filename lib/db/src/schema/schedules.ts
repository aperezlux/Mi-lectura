import { pgTable, serial, text, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const DAY_TYPES = ["weekday", "thursday", "saturday_am", "saturday_pm", "sunday_am", "sunday_pm"] as const;
export type DayType = typeof DAY_TYPES[number];

export const ROLES_BY_DAY_TYPE: Record<DayType, string[]> = {
  weekday:     ["1ª Lectura", "Salmo"],
  thursday:    ["1ª Lectura", "Salmo", "Oraciones"],
  saturday_am: ["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"],
  saturday_pm: ["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"],
  sunday_am:   ["Monitor", "Bienvenida 1", "Bienvenida 2", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"],
  sunday_pm:   ["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"],
};

export const DEFAULT_SCHEDULES: Array<{
  name: string; dayType: DayType; time: string; isActive: boolean; sortOrder: number;
}> = [
  { name: "Misa Diaria (Lun-Mié, Vie)", dayType: "weekday",     time: "06:00", isActive: true, sortOrder: 1 },
  { name: "Misa Jueves",                 dayType: "thursday",    time: "06:00", isActive: true, sortOrder: 2 },
  { name: "Misa Sábado A.M.",            dayType: "saturday_am", time: "07:00", isActive: true, sortOrder: 3 },
  { name: "Misa Sábado P.M.",            dayType: "saturday_pm", time: "18:00", isActive: true, sortOrder: 4 },
  { name: "Misa Domingo A.M.",           dayType: "sunday_am",   time: "08:00", isActive: true, sortOrder: 5 },
  { name: "Misa Domingo P.M.",           dayType: "sunday_pm",   time: "18:00", isActive: true, sortOrder: 6 },
];

export const massSchedulesTable = pgTable("mass_schedules", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull(),
  dayType:   text("day_type").notNull(),
  time:      text("time").notNull().default("06:00"),
  isActive:  boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const updateScheduleSchema = z.object({
  time:     z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM requerido").optional(),
  isActive: z.boolean().optional(),
  name:     z.string().min(2).max(100).optional(),
});

export type MassSchedule = typeof massSchedulesTable.$inferSelect;
export type UpdateSchedule = z.infer<typeof updateScheduleSchema>;
