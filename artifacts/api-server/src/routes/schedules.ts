import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  massSchedulesTable,
  updateScheduleSchema,
<<<<<<< HEAD
  ROLES_BY_DAY_TYPE,
  generationConfigurationsTable,
  liturgicalFunctionsTable,
  generationFunctionAssignmentsTable,
  appSettingsTable,
=======
  DEFAULT_SCHEDULES,
  ROLES_BY_DAY_TYPE,
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
  type DayType,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

<<<<<<< HEAD
router.get("/schedules", async (req, res) => {
  try {
=======
async function ensureDefaultSchedules() {
  const existing = await db.select().from(massSchedulesTable);
  if (existing.length === 0) {
    await db.insert(massSchedulesTable).values(DEFAULT_SCHEDULES);
  }
}

router.get("/schedules", async (req, res) => {
  try {
    await ensureDefaultSchedules();
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
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

<<<<<<< HEAD
router.get("/config", async (req, res) => {
  try {
    const generationConfigurations = await db
      .select()
      .from(generationConfigurationsTable)
      .orderBy(asc(generationConfigurationsTable.sortOrder), asc(generationConfigurationsTable.dayType));

    const liturgicalFunctions = await db
      .select()
      .from(liturgicalFunctionsTable)
      .orderBy(asc(liturgicalFunctionsTable.sortOrder), asc(liturgicalFunctionsTable.name));

    const functionAssignments = await db
      .select()
      .from(generationFunctionAssignmentsTable)
      .orderBy(asc(generationFunctionAssignmentsTable.generationConfigurationId), asc(generationFunctionAssignmentsTable.sortOrder));

    const appSettingRows = await db
      .select()
      .from(appSettingsTable)
      .orderBy(asc(appSettingsTable.key));

    const appSettings = Object.fromEntries(appSettingRows.map((entry) => [entry.key, entry.value]));

    res.json({ generationConfigurations, liturgicalFunctions, functionAssignments, appSettings });
  } catch (err) {
    req.log.error({ err }, "Failed to get configuration");
    res.status(500).json({ error: "Error al obtener la configuración" });
  }
});

router.put("/config", async (req, res) => {
  try {
    const payload = (req.body ?? {}) as {
      generationConfigurations?: Array<any>;
      liturgicalFunctions?: Array<any>;
      functionAssignments?: Array<any>;
      appSettings?: Record<string, string>;
    };

    const generationConfigurations = payload.generationConfigurations ?? [];
    const liturgicalFunctions = payload.liturgicalFunctions ?? [];
    const functionAssignments = payload.functionAssignments ?? [];
    const appSettingsEntries = Object.entries(payload.appSettings ?? {});

    await db.transaction(async (tx) => {
      await tx.delete(generationFunctionAssignmentsTable);
      await tx.delete(generationConfigurationsTable);
      await tx.delete(liturgicalFunctionsTable);
      await tx.delete(appSettingsTable);

      if (generationConfigurations.length > 0) {
        await tx.insert(generationConfigurationsTable).values(generationConfigurations.map((entry) => ({
          dayType: entry.dayType,
          label: entry.label,
          isEnabled: entry.isEnabled ?? true,
          sortOrder: entry.sortOrder ?? 0,
        })));
      }

      if (liturgicalFunctions.length > 0) {
        await tx.insert(liturgicalFunctionsTable).values(liturgicalFunctions.map((entry) => ({
          name: entry.name,
          isActive: entry.isActive ?? true,
          sortOrder: entry.sortOrder ?? 0,
          color: entry.color ?? null,
          icon: entry.icon ?? null,
          isVisible: entry.isVisible ?? true,
          requiresReader: entry.requiresReader ?? true,
          description: entry.description ?? null,
        })));
      }

      if (functionAssignments.length > 0) {
        await tx.insert(generationFunctionAssignmentsTable).values(functionAssignments.map((entry) => ({
          generationConfigurationId: entry.generationConfigurationId,
          functionId: entry.functionId,
          sortOrder: entry.sortOrder ?? 0,
          isActive: entry.isActive ?? true,
        })));
      }

      if (appSettingsEntries.length > 0) {
        await tx.insert(appSettingsTable).values(appSettingsEntries.map(([key, value]) => ({ key, value: String(value) })));
      }
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update configuration");
    res.status(500).json({ error: "Error al guardar la configuración" });
  }
});

=======
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
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
