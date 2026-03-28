import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  calendarTable,
  readersTable,
  massSchedulesTable,
  unavailabilityTable,
  updateCalendarSchema,
} from "@workspace/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { z } from "zod/v4";
import { generateAssignments } from "../lib/assignmentAlgorithm";

const router: IRouter = Router();

const generateInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(["15days", "1month"]),
});

const swapSchema = z.object({
  entryIdA: z.number().int().positive(),
  entryIdB: z.number().int().positive(),
});

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function getEntriesWithJoins(filters?: { startDate?: string; endDate?: string }) {
  const baseQuery = () =>
    db
      .select({
        id: calendarTable.id,
        date: calendarTable.date,
        role: calendarTable.role,
        scheduleId: calendarTable.scheduleId,
        scheduleName: massSchedulesTable.name,
        scheduleTime: massSchedulesTable.time,
        readerId: calendarTable.readerId,
        readerName: readersTable.name,
        logisticComment: calendarTable.logisticComment,
        isVacant: calendarTable.isVacant,
        liturgicalSeason: calendarTable.liturgicalSeason,
        versionTimestamp: calendarTable.versionTimestamp,
      })
      .from(calendarTable)
      .leftJoin(readersTable, eq(calendarTable.readerId, readersTable.id))
      .leftJoin(massSchedulesTable, eq(calendarTable.scheduleId, massSchedulesTable.id));

  if (filters?.startDate && filters?.endDate) {
    return baseQuery()
      .where(
        and(
          gte(calendarTable.date, filters.startDate),
          lte(calendarTable.date, filters.endDate)
        )
      )
      .orderBy(calendarTable.date, massSchedulesTable.sortOrder, calendarTable.role);
  }

  return baseQuery().orderBy(
    calendarTable.date,
    massSchedulesTable.sortOrder,
    calendarTable.role
  );
}

router.get("/calendar", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const rows = await getEntriesWithJoins({ startDate, endDate });
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

    const { startDate, period } = parsed.data;
    const endDate =
      period === "15days"
        ? addDays(startDate, 14)
        : (() => {
            const d = new Date(startDate + "T12:00:00");
            d.setMonth(d.getMonth() + 1);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split("T")[0];
          })();

    const assignments = await generateAssignments(startDate, period);

    await db
      .delete(calendarTable)
      .where(
        and(gte(calendarTable.date, startDate), lte(calendarTable.date, endDate))
      );

    if (assignments.length > 0) {
      await db.insert(calendarTable).values(
        assignments.map((a) => ({
          date: a.date,
          role: a.role,
          scheduleId: a.scheduleId,
          readerId: a.readerId,
          isVacant: a.isVacant,
          liturgicalSeason: a.liturgicalSeason,
        }))
      );
    }

    const rows = await getEntriesWithJoins({ startDate, endDate });
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to generate calendar");
    res.status(500).json({ error: "Error al generar el calendario" });
  }
});

router.post("/calendar/swap", async (req, res) => {
  try {
    const parsed = swapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }
    const { entryIdA, entryIdB } = parsed.data;

    const [entryA] = await db
      .select()
      .from(calendarTable)
      .where(eq(calendarTable.id, entryIdA))
      .limit(1);
    const [entryB] = await db
      .select()
      .from(calendarTable)
      .where(eq(calendarTable.id, entryIdB))
      .limit(1);

    if (!entryA || !entryB) {
      res.status(404).json({ error: "Una o ambas entradas no encontradas" });
      return;
    }

    // Validate: reader A is available on entry B's date (if reader A exists)
    if (entryA.readerId && entryB.date) {
      const conflictA = await db
        .select()
        .from(unavailabilityTable)
        .where(
          and(
            eq(unavailabilityTable.readerId, entryA.readerId),
            eq(unavailabilityTable.blockedDate, entryB.date)
          )
        )
        .limit(1);
      if (conflictA.length > 0) {
        res.status(400).json({
          error: `El lector asignado en la entrada A tiene la fecha ${entryB.date} bloqueada`,
        });
        return;
      }
    }

    // Validate: reader B is available on entry A's date
    if (entryB.readerId && entryA.date) {
      const conflictB = await db
        .select()
        .from(unavailabilityTable)
        .where(
          and(
            eq(unavailabilityTable.readerId, entryB.readerId),
            eq(unavailabilityTable.blockedDate, entryA.date)
          )
        )
        .limit(1);
      if (conflictB.length > 0) {
        res.status(400).json({
          error: `El lector asignado en la entrada B tiene la fecha ${entryA.date} bloqueada`,
        });
        return;
      }
    }

    // Swap reader IDs
    await db
      .update(calendarTable)
      .set({ readerId: entryB.readerId, isVacant: entryB.readerId === null, versionTimestamp: new Date() })
      .where(eq(calendarTable.id, entryIdA));
    await db
      .update(calendarTable)
      .set({ readerId: entryA.readerId, isVacant: entryA.readerId === null, versionTimestamp: new Date() })
      .where(eq(calendarTable.id, entryIdB));

    const [updatedA] = await getEntriesWithJoins({ startDate: entryA.date, endDate: entryA.date });
    const [updatedB] = await getEntriesWithJoins({ startDate: entryB.date, endDate: entryB.date });

    res.json([updatedA, updatedB].filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Failed to swap calendar entries");
    res.status(500).json({ error: "Error al intercambiar asignaciones" });
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

    // Validate unavailability if reassigning reader
    if (parsed.data.readerId) {
      const [entry] = await db
        .select()
        .from(calendarTable)
        .where(eq(calendarTable.id, id))
        .limit(1);
      if (entry) {
        const conflict = await db
          .select()
          .from(unavailabilityTable)
          .where(
            and(
              eq(unavailabilityTable.readerId, parsed.data.readerId),
              eq(unavailabilityTable.blockedDate, entry.date)
            )
          )
          .limit(1);
        if (conflict.length > 0) {
          res.status(400).json({
            error: `Este lector tiene la fecha ${entry.date} marcada como no disponible`,
          });
          return;
        }
      }
    }

    const updateData: any = {
      ...parsed.data,
      versionTimestamp: new Date(),
    };
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

    const rows = await db
      .select({
        id: calendarTable.id,
        date: calendarTable.date,
        role: calendarTable.role,
        scheduleId: calendarTable.scheduleId,
        scheduleName: massSchedulesTable.name,
        scheduleTime: massSchedulesTable.time,
        readerId: calendarTable.readerId,
        readerName: readersTable.name,
        logisticComment: calendarTable.logisticComment,
        isVacant: calendarTable.isVacant,
        liturgicalSeason: calendarTable.liturgicalSeason,
        versionTimestamp: calendarTable.versionTimestamp,
      })
      .from(calendarTable)
      .leftJoin(readersTable, eq(calendarTable.readerId, readersTable.id))
      .leftJoin(massSchedulesTable, eq(calendarTable.scheduleId, massSchedulesTable.id))
      .where(eq(calendarTable.id, id))
      .limit(1);

    res.json(rows[0]);
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
