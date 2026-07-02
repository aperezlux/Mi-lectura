import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppSettingSchema = createInsertSchema(appSettingsTable, {
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(1000),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateAppSettingSchema = insertAppSettingSchema.partial();

export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type UpdateAppSetting = z.infer<typeof updateAppSettingSchema>;
export type AppSetting = typeof appSettingsTable.$inferSelect;
