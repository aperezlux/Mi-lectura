import { db } from "@workspace/db";
import {
  readersTable,
  unavailabilityTable,
  calendarTable,
  massSchedulesTable,
  ROLES_BY_DAY_TYPE,
  DEFAULT_SCHEDULES,
  MORNING_DAY_TYPES,
  EVENING_DAY_TYPES,
  generationConfigurationsTable,
  liturgicalFunctionsTable,
  generationFunctionAssignmentsTable,
  type DayType,
} from "@workspace/db/schema";
import { eq, gte, lte, and, sql, asc, desc, isNotNull } from "drizzle-orm";
import { getLiturgicalSeason } from "./liturgical";

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T12:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay(); // 0=Sun, 6=Sat
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function generateDateRange(startDate: string, period: "15days" | "1month"): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T12:00:00");
  const endDate = new Date(start);

  if (period === "15days") {
    endDate.setDate(endDate.getDate() + 13); // 14 days total (2 weeks)
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // last day of current month
  }

  let current = new Date(start);
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function dayTypesForDayOfWeek(dow: number): DayType[] {
  switch (dow) {
    case 0: return ["sunday_am", "sunday_pm"];
    case 1:
    case 2:
    case 3:
    case 5: return ["weekday"];
    case 4: return ["thursday_am", "thursday_pm"];
    case 6: return ["saturday_am", "saturday_pm"];
    default: return [];
  }
}

// Is a reader's shift blocking them from a specific day type?
function isShiftBlocked(shift: string, dayType: string): boolean {
  if (shift === "all") return true;
  if (shift === "morning") {
    return (
      (MORNING_DAY_TYPES as string[]).includes(dayType) ||
      dayType.endsWith("_am")
    );
  }
  if (shift === "evening") {
    return (
      (EVENING_DAY_TYPES as string[]).includes(dayType) ||
      dayType.endsWith("_pm")
    );
  }
  return false;
}

async function ensureDefaultSchedules() {
  const existing = await db.select().from(massSchedulesTable).limit(1);
  if (existing.length === 0) {
    await db.insert(massSchedulesTable).values(DEFAULT_SCHEDULES);
  }
}

function normalizeLabel(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function legacyDowMaskForDayType(dayType: string): Set<number> {
  if (dayType === "weekday") return new Set([1, 2, 3, 5]); // Mon/Tue/Wed/Fri
  if (dayType.startsWith("thursday_")) return new Set([4]);
  if (dayType.startsWith("saturday_")) return new Set([6]);
  if (dayType.startsWith("sunday_")) return new Set([0]);
  return new Set([0, 1, 2, 3, 4, 5, 6]); // Unknown -> disable everywhere fallback
}

function dowMaskFromConfigLabel(label: string, dayType: string): Set<number> {
  const norm = normalizeLabel(label);
  const result = new Set<number>();

  // Full weekday names
  if (/\blunes\b/.test(norm)) result.add(1);
  if (/\bmartes\b/.test(norm)) result.add(2);
  if (/\bmiercol/.test(norm)) result.add(3);
  if (/\bjueves\b/.test(norm)) result.add(4);
  if (/\bviernes\b/.test(norm)) result.add(5);
  if (/\bsabado\b/.test(norm)) result.add(6);
  if (/\bdomingo\b/.test(norm)) result.add(0);

  // Abbreviations / variants (tolerant parsing)
  if (/\blun\b/.test(norm)) result.add(1);
  if (/\bmar\b/.test(norm)) result.add(2);
  if (/\bmie\b/.test(norm)) result.add(3);
  if (/\bju[eé]\b/.test(norm)) result.add(4);
  if (/\bvie\b/.test(norm)) result.add(5);
  if (/\bsab\b/.test(norm)) result.add(6);

  // If it's a "Lunes a Viernes" like label, include full Mon-Fri weekdays.
  // This fixes the observed "Monday disable disables entire weekday range".
  if (/\blunes\b/.test(norm) && /\bviernes\b/.test(norm) && dayType === "weekday") {
    return new Set([1, 2, 3, 5]);
  }

  if (result.size === 0) return legacyDowMaskForDayType(dayType);
  return result;
}

async function getConfiguredRolesByDayType(): Promise<{
  rolesByDayType: Record<string, string[]>;
  disabledDowByDayType: Record<string, Set<number>>;
}> {
  const configurations = await db
    .select({
      id: generationConfigurationsTable.id,
      dayType: generationConfigurationsTable.dayType,
      label: generationConfigurationsTable.label,
      isEnabled: generationConfigurationsTable.isEnabled,
    })
    .from(generationConfigurationsTable)
    .orderBy(asc(generationConfigurationsTable.sortOrder), asc(generationConfigurationsTable.dayType));

  const assignments = await db
    .select({
      generationConfigurationId: generationFunctionAssignmentsTable.generationConfigurationId,
      functionName: liturgicalFunctionsTable.name,
      sortOrder: generationFunctionAssignmentsTable.sortOrder,
    })
    .from(generationFunctionAssignmentsTable)
    .innerJoin(liturgicalFunctionsTable, eq(generationFunctionAssignmentsTable.functionId, liturgicalFunctionsTable.id))
    .where(eq(generationFunctionAssignmentsTable.isActive, true));

  const rolesByDayType: Record<string, string[]> = {};
  const disabledDowByDayType: Record<string, Set<number>> = {};

  const assignmentsByConfig = new Map<number, Array<{ functionName: string; sortOrder: number }>>();
  for (const assignment of assignments) {
    const current = assignmentsByConfig.get(assignment.generationConfigurationId) ?? [];
    current.push({ functionName: assignment.functionName, sortOrder: assignment.sortOrder });
    assignmentsByConfig.set(assignment.generationConfigurationId, current);
  }

  for (const config of configurations) {
    const dayType = config.dayType;
    const configuredRoles = (assignmentsByConfig.get(config.id) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((entry) => entry.functionName);

    rolesByDayType[dayType] = configuredRoles.length > 0
      ? configuredRoles
      : (ROLES_BY_DAY_TYPE[dayType as DayType] ?? []);

    if (!config.isEnabled) {
      disabledDowByDayType[dayType] = dowMaskFromConfigLabel(config.label, dayType);
    }
  }

  return { rolesByDayType, disabledDowByDayType };
}

// Extract the role name part (before " - ")
function parseRoleName(roleStr: string): string {
  return roleStr.split(" - ")[0];
}

export async function generateAssignments(
  startDate: string,
  period: "15days" | "1month"
): Promise<Array<{
  date: string;
  role: string;
  scheduleId: number;
  readerId: number | null;
  isVacant: boolean;
  liturgicalSeason: string;
}>> {
  await ensureDefaultSchedules();
  const { rolesByDayType, disabledDowByDayType } = await getConfiguredRolesByDayType();

  const activeSchedules = await db
    .select()
    .from(massSchedulesTable)
    .where(eq(massSchedulesTable.isActive, true))
    .orderBy(asc(massSchedulesTable.sortOrder));

  const allReaders = await db.select().from(readersTable).orderBy(readersTable.name);

  const dates = generateDateRange(startDate, period);
  const endDate = dates[dates.length - 1];

  if (allReaders.length === 0) {
    return dates.flatMap((date) => {
      const dow = getDayOfWeek(date);
      const dayTypes = dayTypesForDayOfWeek(dow);
      return activeSchedules
        .filter((s) => dayTypes.includes(s.dayType as DayType))
        .flatMap((schedule) => {
          const scheduleDayType = schedule.dayType as string;
          const isDisabledForThisDow = disabledDowByDayType[scheduleDayType]?.has(dow) ?? false;
          const roles = isDisabledForThisDow ? [] : (rolesByDayType[scheduleDayType] ?? []);
          return roles.map((role) => ({
            date,
            role: `${role} - ${schedule.name} ${schedule.time}`,
            scheduleId: schedule.id,
            readerId: null,
            isVacant: true,
            liturgicalSeason: getLiturgicalSeason(date),
          }));
        });
    });
  }

  const unavailabilityRows = await db
    .select()
    .from(unavailabilityTable)
    .where(
      and(
        gte(unavailabilityTable.blockedDate, startDate),
        lte(unavailabilityTable.blockedDate, endDate)
      )
    );

  // blockedMap: readerId → date → shift ("morning" | "evening" | "all")
  const blockedMap = new Map<number, Map<string, string>>();
  for (const row of unavailabilityRows) {
    if (!blockedMap.has(row.readerId)) {
      blockedMap.set(row.readerId, new Map());
    }
    blockedMap.get(row.readerId)!.set(row.blockedDate, row.shift ?? "all");
  }

  // Historical total assignment counts (equity)
  const historicalCounts = await db
    .select({
      readerId: calendarTable.readerId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(calendarTable)
    .where(eq(calendarTable.isVacant, false))
    .groupBy(calendarTable.readerId);

  const countMap = new Map<number, number>();
  for (const row of historicalCounts) {
    if (row.readerId) countMap.set(row.readerId, Number(row.count));
  }

  // Track session assignment counts
  const assignmentCountSession = new Map<number, number>();
  for (const reader of allReaders) {
    assignmentCountSession.set(reader.id, countMap.get(reader.id) ?? 0);
  }

  // Last role per reader (for role rotation) - look at last 4 weeks
  const fourWeeksAgo = addDays(startDate, -28);
  const recentRoleRows = await db
    .select({
      readerId: calendarTable.readerId,
      role: calendarTable.role,
      date: calendarTable.date,
    })
    .from(calendarTable)
    .where(
      and(
        eq(calendarTable.isVacant, false),
        gte(calendarTable.date, fourWeeksAgo),
        isNotNull(calendarTable.readerId)
      )
    )
    .orderBy(desc(calendarTable.date));

  // Build: readerId → last role name
  const lastRoleMap = new Map<number, string>();
  // readerId → last week key they were assigned
  const lastWeekMap = new Map<number, string>();

  for (const row of recentRoleRows) {
    if (!row.readerId) continue;
    if (!lastRoleMap.has(row.readerId)) {
      lastRoleMap.set(row.readerId, parseRoleName(row.role));
    }
    if (!lastWeekMap.has(row.readerId)) {
      lastWeekMap.set(row.readerId, getISOWeek(row.date));
    }
  }

  const results: Array<{
    date: string;
    role: string;
    scheduleId: number;
    readerId: number | null;
    isVacant: boolean;
    liturgicalSeason: string;
  }> = [];

  // Track session: date → set of readerIds used that day
  const usedPerDay = new Map<string, Set<number>>();
  // Proximity: date → list of readerIds used in saturday_pm
  const satPmReaders = new Map<string, number[]>();
  // Session tracking of last week per reader (updates as we assign)
  const sessionLastWeek = new Map<number, string>(lastWeekMap);

  for (const date of dates) {
    const dow = getDayOfWeek(date);
    const applicableTypes = dayTypesForDayOfWeek(dow);
    const daySchedules = activeSchedules.filter((s) =>
      applicableTypes.includes(s.dayType as DayType)
    );

    if (!usedPerDay.has(date)) {
      usedPerDay.set(date, new Set());
    }

    const currentWeek = getISOWeek(date);

    for (const schedule of daySchedules) {
      const dayType = schedule.dayType as string;
      const isDisabledForThisDow = disabledDowByDayType[dayType]?.has(dow) ?? false;
      const roles = isDisabledForThisDow ? [] : (rolesByDayType[dayType] ?? []);

      let proximityBlocked = new Set<number>();
      if (dayType === "sunday_am") {
        const prevSat = addDays(date, -1);
        if (satPmReaders.has(prevSat)) {
          proximityBlocked = new Set(satPmReaders.get(prevSat)!);
        }
      }

      for (const roleName of roles) {
        const usedToday = usedPerDay.get(date)!;

        // Sorting comparator shared between passes
        const sortReaders = (a: typeof allReaders[0], b: typeof allReaders[0]) => {
          // Primary: session assignment count (equity)
          const countA = assignmentCountSession.get(a.id) ?? 0;
          const countB = assignmentCountSession.get(b.id) ?? 0;
          if (countA !== countB) return countA - countB;
          // Secondary: week alternation
          const sameWeekA = sessionLastWeek.get(a.id) === currentWeek ? 1 : 0;
          const sameWeekB = sessionLastWeek.get(b.id) === currentWeek ? 1 : 0;
          if (sameWeekA !== sameWeekB) return sameWeekA - sameWeekB;
          // Tertiary: role rotation
          const sameRoleA = lastRoleMap.get(a.id) === roleName ? 1 : 0;
          const sameRoleB = lastRoleMap.get(b.id) === roleName ? 1 : 0;
          return sameRoleA - sameRoleB;
        };

        // Pass 1: strict — no same-day reuse, no proximity conflict
        const eligible = allReaders
          .filter((r) => {
            const shift = blockedMap.get(r.id)?.get(date);
            if (shift && isShiftBlocked(shift, dayType)) return false;
            return !usedToday.has(r.id) && !proximityBlocked.has(r.id);
          })
          .sort(sortReaders);

        // Pass 2 fallback — relax same-day uniqueness (allow reader to serve twice)
        // Only used when no one is available in Pass 1
        const fallback = eligible.length === 0
          ? allReaders
              .filter((r) => {
                const shift = blockedMap.get(r.id)?.get(date);
                if (shift && isShiftBlocked(shift, dayType)) return false;
                return !proximityBlocked.has(r.id);
              })
              .sort(sortReaders)
          : [];

        const chosen = eligible[0] ?? fallback[0] ?? null;

        const fullRole = `${roleName} - ${schedule.name} ${schedule.time}`;

        if (!chosen) {
          results.push({
            date,
            role: fullRole,
            scheduleId: schedule.id,
            readerId: null,
            isVacant: true,
            liturgicalSeason: getLiturgicalSeason(date),
          });
        } else {
          usedToday.add(chosen.id);
          assignmentCountSession.set(
            chosen.id,
            (assignmentCountSession.get(chosen.id) ?? 0) + 1
          );
          lastRoleMap.set(chosen.id, roleName);
          sessionLastWeek.set(chosen.id, currentWeek);

          if (dayType === "saturday_pm") {
            if (!satPmReaders.has(date)) satPmReaders.set(date, []);
            satPmReaders.get(date)!.push(chosen.id);
          }
          results.push({
            date,
            role: fullRole,
            scheduleId: schedule.id,
            readerId: chosen.id,
            isVacant: false,
            liturgicalSeason: getLiturgicalSeason(date),
          });
        }
      }
    }
  }

  return results;
}
