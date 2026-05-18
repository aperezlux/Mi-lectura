import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  massSchedulesTable,
  updateScheduleSchema,
  DEFAULT_SCHEDULES,
  ROLES_BY_DAY_TYPE,
  type DayType,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

async function ensureDefaultSchedules() {
  const existing = await db.select().from(massSchedulesTable);
  if (existing.length === 0) {
    await db.insert(massSchedulesTable).values(DEFAULT_SCHEDULES);
  }
}

router.get("/schedules", async (req, res) => {
  try {
    await ensureDefaultSchedules();
    const schedules = await db
      .select()
      .from(massSchedulesTable)
      .orderBy(asc(massSchedulesTable.sortOrder));

    const withRoles = schedules.map((s) => ({
      ...s,
      roles: ROLES_BY_DAY_TYPE[s.dayType as DayType] ?? [],
    }));
    res.json(withRoles);
  } catch (err) {
    req.log.error({ err }, "Failed to get schedules");
    res.status(500).json({ error: "Error al obtener horarios" });
  }
});

router.put("/schedules/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = updateScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }
    const [updated] = await db
      .update(massSchedulesTable)
      .set(parsed.data)
      .where(eq(massSchedulesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Horario no encontrado" });
      return;
    }
    res.json({ ...updated, roles: ROLES_BY_DAY_TYPE[updated.dayType as DayType] ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to update schedule");
    res.status(500).json({ error: "Error al actualizar horario" });
  }
});

export default router;
