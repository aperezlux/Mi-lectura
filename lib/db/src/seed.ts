import { db } from "./index";
import {
  appSettingsTable,
  DEFAULT_SCHEDULES,
  generationConfigurationsTable,
  generationFunctionAssignmentsTable,
  liturgicalFunctionsTable,
  massSchedulesTable,
  type DayType,
} from "./schema";
import { and, eq } from "drizzle-orm";

const generationConfigurations: Array<{ dayType: string; label: string; isEnabled: boolean; sortOrder: number }> = [
  { dayType: "weekday", label: "Lunes a Viernes", isEnabled: true, sortOrder: 1 },
  { dayType: "thursday_am", label: "Jueves Mañana", isEnabled: true, sortOrder: 2 },
  { dayType: "thursday_pm", label: "Jueves Tarde", isEnabled: true, sortOrder: 3 },
  { dayType: "saturday_am", label: "Sábado Mañana", isEnabled: true, sortOrder: 4 },
  { dayType: "saturday_pm", label: "Sábado Tarde", isEnabled: true, sortOrder: 5 },
  { dayType: "sunday_am", label: "Domingo Mañana", isEnabled: true, sortOrder: 6 },
  { dayType: "sunday_pm", label: "Domingo Tarde", isEnabled: true, sortOrder: 7 },
];

const liturgicalFunctions: Array<{ name: string; isActive: boolean; sortOrder: number; color: string; icon: string; isVisible: boolean; requiresReader: boolean; description: string }> = [
  { name: "Monitor", isActive: true, sortOrder: 1, color: "#8b5cf6", icon: "🎛️", isVisible: true, requiresReader: true, description: "Monitor" },
  { name: "Bienvenida 1", isActive: true, sortOrder: 2, color: "#f59e0b", icon: "👋", isVisible: true, requiresReader: true, description: "Bienvenida 1" },
  { name: "Bienvenida 2", isActive: true, sortOrder: 3, color: "#f59e0b", icon: "👋", isVisible: true, requiresReader: true, description: "Bienvenida 2" },
  { name: "1ª Lectura", isActive: true, sortOrder: 4, color: "#3b82f6", icon: "📖", isVisible: true, requiresReader: true, description: "Primera lectura" },
  { name: "Salmo", isActive: true, sortOrder: 5, color: "#10b981", icon: "🎵", isVisible: true, requiresReader: true, description: "Salmo" },
  { name: "2ª Lectura", isActive: true, sortOrder: 6, color: "#3b82f6", icon: "📖", isVisible: true, requiresReader: true, description: "Segunda lectura" },
  { name: "Oraciones", isActive: true, sortOrder: 7, color: "#ef4444", icon: "🙏", isVisible: true, requiresReader: true, description: "Oraciones" },
] as const;

const appSettings: Array<{ key: string; value: string }> = [
  { key: "reader_availability_visible", value: "true" },
];

const roleOrderByDayType: Record<DayType, string[]> = {
  weekday: ["1ª Lectura", "Salmo"],
  thursday_am: ["1ª Lectura", "Salmo"],
  thursday_pm: ["1ª Lectura", "Salmo", "Oraciones"],
  saturday_am: ["1ª Lectura", "Salmo"],
  saturday_pm: ["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"],
  sunday_am: ["Monitor", "Bienvenida 1", "Bienvenida 2", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"],
  sunday_pm: ["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"],
};

async function seed() {
  await db.insert(generationConfigurationsTable).values(generationConfigurations).onConflictDoNothing({ target: generationConfigurationsTable.dayType });
  await db.insert(liturgicalFunctionsTable).values(liturgicalFunctions).onConflictDoNothing({ target: liturgicalFunctionsTable.name });
  await db.insert(appSettingsTable).values(appSettings).onConflictDoNothing({ target: appSettingsTable.key });

  for (const schedule of DEFAULT_SCHEDULES) {
    const existing = await db.select().from(massSchedulesTable).where(
      and(
        eq(massSchedulesTable.dayType, schedule.dayType),
        eq(massSchedulesTable.name, schedule.name),
        eq(massSchedulesTable.time, schedule.time),
      )
    );

    if (existing.length === 0) {
      await db.insert(massSchedulesTable).values(schedule);
    }
  }

  const configuredRows = await db.select({ id: generationConfigurationsTable.id, dayType: generationConfigurationsTable.dayType }).from(generationConfigurationsTable);
  const functionRows = await db.select({ id: liturgicalFunctionsTable.id, name: liturgicalFunctionsTable.name }).from(liturgicalFunctionsTable);
  const functionIdByName = new Map(functionRows.map((entry) => [entry.name, entry.id]));
  const configIdByDayType = new Map(configuredRows.map((entry) => [entry.dayType, entry.id]));

  for (const config of configuredRows) {
    const roles = roleOrderByDayType[config.dayType as DayType] ?? [];
    const functionIds = roles
      .map((roleName) => functionIdByName.get(roleName))
      .filter((id): id is number => id !== undefined);

    for (const [index, functionId] of functionIds.entries()) {
      const existingRelation = await db.select().from(generationFunctionAssignmentsTable).where(
        and(
          eq(generationFunctionAssignmentsTable.generationConfigurationId, config.id),
          eq(generationFunctionAssignmentsTable.functionId, functionId),
        )
      );

      if (existingRelation.length === 0) {
        await db.insert(generationFunctionAssignmentsTable).values({
          generationConfigurationId: config.id,
          functionId,
          sortOrder: index + 1,
          isActive: true,
        });
      }
    }
  }

  console.log("Seed ejecutado correctamente.");
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error ejecutando seed", error);
    process.exit(1);
  });
