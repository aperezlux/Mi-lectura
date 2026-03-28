import { db } from "@workspace/db";
import {
  readersTable,
  unavailabilityTable,
  calendarTable,
  massSchedulesTable,
  ROLES_BY_DAY_TYPE,
  DEFAULT_SCHEDULES,
  type DayType,
} from "@workspace/db/schema";
import { eq, gte, lte, and, sql, asc } from "drizzle-orm";
import { getLiturgicalSeason } from "./liturgical";

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T12:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay(); // 0=Sun, 6=Sat
}

function generateDateRange(startDate: string, period: "15days" | "1month"): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T12:00:00");
  const endDate = new Date(start);

  if (period === "15days") {
    endDate.setDate(endDate.getDate() + 14);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(endDate.getDate() - 1);
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
    case 4: return ["thursday"];
    case 6: return ["saturday_am", "saturday_pm"];
    default: return [];
  }
}

async function ensureDefaultSchedules() {
  const existing = await db.select().from(massSchedulesTable);
  if (existing.length === 0) {
    await db.insert(massSchedulesTable).values(DEFAULT_SCHEDULES);
  }
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

  const activeSchedules = await db
    .select()
    .from(massSchedulesTable)
    .where(eq(massSchedulesTable.isActive, true))
    .orderBy(asc(massSchedulesTable.sortOrder));

  const allReaders = await db.select().from(readersTable).orderBy(readersTable.name);

  const endDate =
    period === "15days"
      ? addDays(startDate, 14)
      : (() => {
          const d = new Date(startDate + "T12:00:00");
          d.setMonth(d.getMonth() + 1);
          d.setDate(d.getDate() - 1);
          return d.toISOString().split("T")[0];
        })();

  if (allReaders.length === 0) {
    const dates = generateDateRange(startDate, period);
    return dates.flatMap((date) => {
      const dow = getDayOfWeek(date);
      const dayTypes = dayTypesForDayOfWeek(dow);
      return activeSchedules
        .filter((s) => dayTypes.includes(s.dayType as DayType))
        .flatMap((schedule) =>
          (ROLES_BY_DAY_TYPE[schedule.dayType as DayType] ?? []).map((role) => ({
            date,
            role: `${role} - ${schedule.name} ${schedule.time}`,
            scheduleId: schedule.id,
            readerId: null,
            isVacant: true,
            liturgicalSeason: getLiturgicalSeason(date),
          }))
        );
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

  const blockedMap = new Map<number, Set<string>>();
  for (const row of unavailabilityRows) {
    if (!blockedMap.has(row.readerId)) {
      blockedMap.set(row.readerId, new Set());
    }
    blockedMap.get(row.readerId)!.add(row.blockedDate);
  }

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
    if (row.readerId) {
      countMap.set(row.readerId, Number(row.count));
    }
  }

  const assignmentCountSession = new Map<number, number>();
  for (const reader of allReaders) {
    assignmentCountSession.set(reader.id, countMap.get(reader.id) ?? 0);
  }

  const results: Array<{
    date: string;
    role: string;
    scheduleId: number;
    readerId: number | null;
    isVacant: boolean;
    liturgicalSeason: string;
  }> = [];

  const dates = generateDateRange(startDate, period);

  // Track session assignments: date -> set of readerIds used that day
  const usedPerDay = new Map<string, Set<number>>();
  // Proximity: date -> list of readerIds used in saturday_pm
  const satPmReaders = new Map<string, number[]>();

  for (const date of dates) {
    const dow = getDayOfWeek(date);
    const applicableTypes = dayTypesForDayOfWeek(dow);
    const daySchedules = activeSchedules.filter((s) =>
      applicableTypes.includes(s.dayType as DayType)
    );

    if (!usedPerDay.has(date)) {
      usedPerDay.set(date, new Set());
    }

    for (const schedule of daySchedules) {
      const roles = ROLES_BY_DAY_TYPE[schedule.dayType as DayType] ?? [];

      // For sunday_am, check previous saturday for proximity rule
      let proximityBlocked = new Set<number>();
      if (schedule.dayType === "sunday_am") {
        const prevSat = addDays(date, -1);
        if (satPmReaders.has(prevSat)) {
          proximityBlocked = new Set(satPmReaders.get(prevSat)!);
        }
      }

      for (const roleName of roles) {
        const usedToday = usedPerDay.get(date)!;

        const eligible = allReaders
          .filter((r) => {
            const blocked = blockedMap.get(r.id)?.has(date) ?? false;
            const usedThisDay = usedToday.has(r.id);
            const proximityBlock = proximityBlocked.has(r.id);
            return !blocked && !usedThisDay && !proximityBlock;
          })
          .sort(
            (a, b) =>
              (assignmentCountSession.get(a.id) ?? 0) -
              (assignmentCountSession.get(b.id) ?? 0)
          );

        const fullRole = `${roleName} - ${schedule.name} ${schedule.time}`;

        if (eligible.length === 0) {
          results.push({
            date,
            role: fullRole,
            scheduleId: schedule.id,
            readerId: null,
            isVacant: true,
            liturgicalSeason: getLiturgicalSeason(date),
          });
        } else {
          const chosen = eligible[0];
          usedToday.add(chosen.id);
          assignmentCountSession.set(
            chosen.id,
            (assignmentCountSession.get(chosen.id) ?? 0) + 1
          );
          if (schedule.dayType === "saturday_pm") {
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
