import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { unavailabilityTable, readersTable, insertUnavailabilitySchema, appSettingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const SELECTED_FIELDS = {
  id: unavailabilityTable.id,
  readerId: unavailabilityTable.readerId,
  blockedDate: unavailabilityTable.blockedDate,
  shift: unavailabilityTable.shift,
  readerName: readersTable.name,
};

async function isReaderAvailabilityVisible(): Promise<boolean> {
  const rows = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "reader_availability_visible"))
    .limit(1);

  // If missing, keep existing default behavior (visible).
  const value = rows[0]?.value;
  return value == null ? true : value !== "false";
}

router.get("/unavailability", async (req, res) => {
  try {
    const visible = await isReaderAvailabilityVisible();
    if (!visible) {
      res.json([]);
      return;
    }

    const readerIdParam = req.query.readerId;

    if (readerIdParam) {
      const readerId = parseInt(readerIdParam as string);
      if (!isNaN(readerId)) {
        const rows = await db
          .select(SELECTED_FIELDS)
          .from(unavailabilityTable)
          .leftJoin(readersTable, eq(unavailabilityTable.readerId, readersTable.id))
          .where(eq(unavailabilityTable.readerId, readerId));
        res.json(rows);
        return;
      }
    }

    const rows = await db
      .select(SELECTED_FIELDS)
      .from(unavailabilityTable)
      .leftJoin(readersTable, eq(unavailabilityTable.readerId, readersTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get unavailability");
    res.status(500).json({ error: "Error al obtener indisponibilidades" });
  }
});

router.post("/unavailability", async (req, res) => {
  try {
    const visible = await isReaderAvailabilityVisible();
    if (!visible) {
      res.status(403).json({ error: "Indisponibilidad deshabilitada por el administrador" });
      return;
    }

    const parsed = insertUnavailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }

    const { readerId, blockedDate, shift = "all" } = parsed.data;

    const existing = await db
      .select()
      .from(unavailabilityTable)
      .where(
        and(
          eq(unavailabilityTable.readerId, readerId),
          eq(unavailabilityTable.blockedDate, blockedDate)
        )
      )
      .limit(1);

    let targetId: number;

    if (existing.length > 0) {
      await db
        .update(unavailabilityTable)
        .set({ shift })
        .where(eq(unavailabilityTable.id, existing[0].id));
      targetId = existing[0].id;
    } else {
      const [inserted] = await db
        .insert(unavailabilityTable)
        .values({ readerId, blockedDate, shift })
        .returning();
      targetId = inserted.id;
    }

    const [row] = await db
      .select(SELECTED_FIELDS)
      .from(unavailabilityTable)
      .leftJoin(readersTable, eq(unavailabilityTable.readerId, readersTable.id))
      .where(eq(unavailabilityTable.id, targetId))
      .limit(1);

    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create unavailability");
    res.status(500).json({ error: "Error al registrar indisponibilidad" });
  }
});

router.delete("/unavailability/:id", async (req, res) => {
  try {
    const visible = await isReaderAvailabilityVisible();
    if (!visible) {
      res.status(403).json({ error: "Indisponibilidad deshabilitada por el administrador" });
      return;
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db.delete(unavailabilityTable).where(eq(unavailabilityTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete unavailability");
    res.status(500).json({ error: "Error al eliminar indisponibilidad" });
  }
});

export default router;
