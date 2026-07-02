import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  calendarTable,
  readersTable,
  massSchedulesTable,
  unavailabilityTable,
  updateCalendarSchema,
} from "@workspace/db/schema";
import { eq, gte, lte, and, sql, desc, isNotNull } from "drizzle-orm";
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

function parseRoleName(roleStr: string): string {
  return roleStr.split(" - ")[0];
}

async function getEntriesWithJoins(filters?: {
  startDate?: string;
  endDate?: string;
  publishedOnly?: boolean;
}) {
  const conditions: any[] = [];
  if (filters?.startDate) conditions.push(gte(calendarTable.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(calendarTable.date, filters.endDate));
  if (filters?.publishedOnly) conditions.push(eq(calendarTable.isPublished, true));

  const query = db
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
      isPublished: calendarTable.isPublished,
      liturgicalSeason: calendarTable.liturgicalSeason,
      versionTimestamp: calendarTable.versionTimestamp,
    })
    .from(calendarTable)
    .leftJoin(readersTable, eq(calendarTable.readerId, readersTable.id))
    .leftJoin(massSchedulesTable, eq(calendarTable.scheduleId, massSchedulesTable.id));

  if (conditions.length > 0) {
    return query
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(calendarTable.date, massSchedulesTable.sortOrder, calendarTable.role);
  }

  return query.orderBy(calendarTable.date, massSchedulesTable.sortOrder, calendarTable.role);
}

// GET /calendar
router.get("/calendar", async (req, res) => {
  try {
    const { startDate, endDate, publishedOnly } = req.query as {
      startDate?: string;
      endDate?: string;
      publishedOnly?: string;
    };
    const rows = await getEntriesWithJoins({
      startDate,
      endDate,
      publishedOnly: publishedOnly === "true",
    });
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get calendar");
    res.status(500).json({ error: "Error al obtener el calendario" });
  }
});

// GET /calendar/stats — reader participation statistics
router.get("/calendar/stats", async (req, res) => {
  try {
    const allReaders = await db.select().from(readersTable).orderBy(readersTable.name);

    const counts = await db
      .select({
        readerId: calendarTable.readerId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(calendarTable)
      .where(and(eq(calendarTable.isVacant, false), isNotNull(calendarTable.readerId)))
      .groupBy(calendarTable.readerId);

    const countMap = new Map<number, number>();
    for (const row of counts) {
      if (row.readerId) countMap.set(row.readerId, Number(row.count));
    }

    // Last role per reader
    const lastRoleRows = await db
      .select({
        readerId: calendarTable.readerId,
        role: calendarTable.role,
        date: calendarTable.date,
      })
      .from(calendarTable)
      .where(and(eq(calendarTable.isVacant, false), isNotNull(calendarTable.readerId)))
      .orderBy(desc(calendarTable.date));

    const lastRoleMap = new Map<number, { role: string; date: string }>();
    for (const row of lastRoleRows) {
      if (!row.readerId) continue;
      if (!lastRoleMap.has(row.readerId)) {
        lastRoleMap.set(row.readerId, { role: parseRoleName(row.role), date: row.date });
      }
    }

    const totalAssignments = allReaders.reduce((sum, r) => sum + (countMap.get(r.id) ?? 0), 0);
    const avgAssignments = allReaders.length > 0 ? totalAssignments / allReaders.length : 0;

    const stats = allReaders.map((r) => {
      const total = countMap.get(r.id) ?? 0;
      const lastInfo = lastRoleMap.get(r.id);
      return {
        readerId: r.id,
        readerName: r.name,
        totalAssignments: total,
        lastRole: lastInfo?.role ?? null,
        lastAssignedDate: lastInfo?.date ?? null,
        debtScore: avgAssignments - total, // positive = owes more readings
      };
    });

    // Sort by debt score descending (most in debt first)
    stats.sort((a, b) => b.debtScore - a.debtScore);

    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get calendar stats");
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// POST /calendar/generate
router.post("/calendar/generate", async (req, res) => {
  try {
    const parsed = generateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }

    const { startDate, period } = parsed.data;

    const assignments = await generateAssignments(startDate, period);

    // Delete ALL calendar entries from startDate onward to ensure a clean slate
    await db
      .delete(calendarTable)
      .where(gte(calendarTable.date, startDate));

    if (assignments.length > 0) {
      await db.insert(calendarTable).values(
        assignments.map((a) => ({
          date: a.date,
          role: a.role,
          scheduleId: a.scheduleId,
          readerId: a.readerId,
          isVacant: a.isVacant,
          isPublished: false, // draft by default
          liturgicalSeason: a.liturgicalSeason,
        }))
      );
    }

    const generatedEndDate = assignments.length > 0
      ? assignments[assignments.length - 1].date
      : startDate;
    const rows = await getEntriesWithJoins({ startDate, endDate: generatedEndDate });
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to generate calendar");
    res.status(500).json({ error: "Error al generar el calendario" });
  }
});

// POST /calendar/publish — mark all entries as published
router.post("/calendar/publish", async (req, res) => {
  try {
    const now = new Date();
    const result = await db
      .update(calendarTable)
      .set({ isPublished: true, versionTimestamp: now })
      .returning({ id: calendarTable.id });

    res.json({ published: result.length, publishedAt: now.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to publish calendar");
    res.status(500).json({ error: "Error al publicar el calendario" });
  }
});

// POST /calendar/swap
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

    await db
      .update(calendarTable)
      .set({ readerId: entryB.readerId, isVacant: entryB.readerId === null, versionTimestamp: new Date() })
      .where(eq(calendarTable.id, entryIdA));
    await db
      .update(calendarTable)
      .set({ readerId: entryA.readerId, isVacant: entryA.readerId === null, versionTimestamp: new Date() })
      .where(eq(calendarTable.id, entryIdB));

    const rows = await getEntriesWithJoins({
      startDate: entryA.date < entryB.date ? entryA.date : entryB.date,
      endDate: entryA.date > entryB.date ? entryA.date : entryB.date,
    });
    res.json(rows.filter((r) => r.id === entryIdA || r.id === entryIdB));
  } catch (err) {
    req.log.error({ err }, "Failed to swap calendar entries");
    res.status(500).json({ error: "Error al intercambiar asignaciones" });
  }
});

// PUT /calendar/:id
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
        isPublished: calendarTable.isPublished,
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

// DELETE /calendar/:id
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
