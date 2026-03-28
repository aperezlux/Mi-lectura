import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { calendarTable, readersTable, updateCalendarSchema } from "@workspace/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { z } from "zod/v4";
import { generateAssignments } from "../lib/assignmentAlgorithm";

const router: IRouter = Router();

const generateInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(["15days", "1month"]),
  roles: z.array(z.string().min(1)).optional(),
});

const DEFAULT_ROLES = [
  "Lector 1 Misa Sábado PM",
  "Lector 2 Misa Sábado PM",
  "Lector 1 Misa Domingo AM",
  "Lector 2 Misa Domingo AM",
];

async function getEntriesWithReaders(filters?: { startDate?: string; endDate?: string }) {
  let query = db
    .select({
      id: calendarTable.id,
      date: calendarTable.date,
      role: calendarTable.role,
      readerId: calendarTable.readerId,
      readerName: readersTable.name,
      logisticComment: calendarTable.logisticComment,
      isVacant: calendarTable.isVacant,
      liturgicalSeason: calendarTable.liturgicalSeason,
      versionTimestamp: calendarTable.versionTimestamp,
    })
    .from(calendarTable)
    .leftJoin(readersTable, eq(calendarTable.readerId, readersTable.id));

  if (filters?.startDate && filters?.endDate) {
    const rows = await db
      .select({
        id: calendarTable.id,
        date: calendarTable.date,
        role: calendarTable.role,
        readerId: calendarTable.readerId,
        readerName: readersTable.name,
        logisticComment: calendarTable.logisticComment,
        isVacant: calendarTable.isVacant,
        liturgicalSeason: calendarTable.liturgicalSeason,
        versionTimestamp: calendarTable.versionTimestamp,
      })
      .from(calendarTable)
      .leftJoin(readersTable, eq(calendarTable.readerId, readersTable.id))
      .where(
        and(
          gte(calendarTable.date, filters.startDate),
          lte(calendarTable.date, filters.endDate)
        )
      )
      .orderBy(calendarTable.date, calendarTable.role);
    return rows;
  }

  return await query.orderBy(calendarTable.date, calendarTable.role);
}

router.get("/calendar", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const rows = await getEntriesWithReaders({ startDate, endDate });
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get calendar");
    res.status(500).json({ error: "Error al obtener el calendario" });
  }
});

router.post("/calendar/generate", async (req, res) => {
  try {
    const parsed = generateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }

    const { startDate, period, roles = DEFAULT_ROLES } = parsed.data;

    const assignments = await generateAssignments(startDate, period, roles);

    // Delete existing entries in the range and re-insert
    const endDate =
      period === "15days"
        ? new Date(new Date(startDate + "T12:00:00").getTime() + 14 * 86400000)
            .toISOString()
            .split("T")[0]
        : (() => {
            const d = new Date(startDate + "T12:00:00");
            d.setMonth(d.getMonth() + 1);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split("T")[0];
          })();

    await db
      .delete(calendarTable)
      .where(
        and(
          gte(calendarTable.date, startDate),
          lte(calendarTable.date, endDate)
        )
      );

    if (assignments.length > 0) {
      await db.insert(calendarTable).values(
        assignments.map((a) => ({
          date: a.date,
          role: a.role,
          readerId: a.readerId,
          isVacant: a.isVacant,
          liturgicalSeason: a.liturgicalSeason,
        }))
      );
    }

    const rows = await getEntriesWithReaders({ startDate, endDate });
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to generate calendar");
    res.status(500).json({ error: "Error al generar el calendario" });
  }
});

router.put("/calendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const parsed = updateCalendarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }

    const updateData: any = { ...parsed.data, versionTimestamp: new Date() };

    if (parsed.data.readerId !== undefined) {
      updateData.isVacant = parsed.data.readerId === null;
    }

    const [updated] = await db
      .update(calendarTable)
      .set(updateData)
      .where(eq(calendarTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Entrada no encontrada" });
      return;
    }

    const [row] = await db
      .select({
        id: calendarTable.id,
        date: calendarTable.date,
        role: calendarTable.role,
        readerId: calendarTable.readerId,
        readerName: readersTable.name,
        logisticComment: calendarTable.logisticComment,
        isVacant: calendarTable.isVacant,
        liturgicalSeason: calendarTable.liturgicalSeason,
        versionTimestamp: calendarTable.versionTimestamp,
      })
      .from(calendarTable)
      .leftJoin(readersTable, eq(calendarTable.readerId, readersTable.id))
      .where(eq(calendarTable.id, id))
      .limit(1);

    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update calendar entry");
    res.status(500).json({ error: "Error al actualizar la entrada" });
  }
});

router.delete("/calendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db.delete(calendarTable).where(eq(calendarTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete calendar entry");
    res.status(500).json({ error: "Error al eliminar la entrada" });
  }
});

export default router;
