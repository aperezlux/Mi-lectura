import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const readersTable = pgTable("readers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  level: text("level").notNull().default("Principiante"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReaderSchema = createInsertSchema(readersTable, {
  name: z.string().min(2).max(100),
  whatsapp: z.string().min(7).max(20).regex(/^[\d\s\+\-\(\)]+$/, "WhatsApp debe contener solo números y símbolos permitidos"),
  level: z.enum(["Principiante", "Experto"]),
}).omit({ id: true, createdAt: true });

export const updateReaderSchema = insertReaderSchema.partial();

export type InsertReader = z.infer<typeof insertReaderSchema>;
export type UpdateReader = z.infer<typeof updateReaderSchema>;
export type Reader = typeof readersTable.$inferSelect;
