import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { readersTable, insertReaderSchema, updateReaderSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

function safeReader(reader: typeof readersTable.$inferSelect) {
  const { pin, ...rest } = reader;
  return { ...rest, hasPin: !!pin };
}

router.get("/readers", async (req, res) => {
  try {
    const readers = await db.select().from(readersTable).orderBy(readersTable.name);
    res.json(readers.map(safeReader));
  } catch (err) {
    req.log.error({ err }, "Failed to get readers");
    res.status(500).json({ error: "Error al obtener lectores" });
  }
});

router.post("/readers/verify-pin", async (req, res) => {
  try {
    const parsed = z.object({
      readerId: z.number().int(),
      pin: z.string().min(1),
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }
    const { readerId, pin } = parsed.data;
    const [reader] = await db.select().from(readersTable).where(eq(readersTable.id, readerId));
    if (!reader) {
      res.status(404).json({ error: "Lector no encontrado" });
      return;
    }
    if (reader.pin && reader.pin !== pin) {
      res.status(401).json({ error: "PIN incorrecto" });
      return;
    }
    res.json(safeReader(reader));
  } catch (err) {
    req.log.error({ err }, "Failed to verify reader PIN");
    res.status(500).json({ error: "Error al verificar PIN" });
  }
});

router.post("/readers", async (req, res) => {
  try {
    const parsed = insertReaderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }
    const [reader] = await db.insert(readersTable).values(parsed.data).returning();
    res.status(201).json(safeReader(reader));
  } catch (err) {
    req.log.error({ err }, "Failed to create reader");
    res.status(500).json({ error: "Error al crear lector" });
  }
});

router.put("/readers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = updateReaderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.message });
      return;
    }
    const updateData = { ...parsed.data };
    if (updateData.pin === "" || updateData.pin === undefined) {
      delete updateData.pin;
    }
    const [reader] = await db
      .update(readersTable)
      .set(updateData)
      .where(eq(readersTable.id, id))
      .returning();
    if (!reader) {
      res.status(404).json({ error: "Lector no encontrado" });
      return;
    }
    res.json(safeReader(reader));
  } catch (err) {
    req.log.error({ err }, "Failed to update reader");
    res.status(500).json({ error: "Error al actualizar lector" });
  }
});

router.delete("/readers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db.delete(readersTable).where(eq(readersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete reader");
    res.status(500).json({ error: "Error al eliminar lector" });
  }
});

export default router;
