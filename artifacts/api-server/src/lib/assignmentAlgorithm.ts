import { db } from "@workspace/db";
import { readersTable, unavailabilityTable, calendarTable } from "@workspace/db/schema";
import { eq, gte, lte, and, sql } from "drizzle-orm";
import { getLiturgicalSeason } from "./liturgical";

interface AssignmentSlot {
  date: string;
  role: string;
  liturgicalSeason: string;
}

interface ReaderWithCount {
  id: number;
  name: string;
  whatsapp: string;
  level: string;
  assignmentCount: number;
}

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
    const day = current.getDay();
    if (day === 0 || day === 6) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export async function generateAssignments(
  startDate: string,
  period: "15days" | "1month",
  roles: string[]
): Promise<Array<{
  date: string;
  role: string;
  readerId: number | null;
  isVacant: boolean;
  liturgicalSeason: string;
}>> {
  const dates = generateDateRange(startDate, period);

  const allReaders = await db.select().from(readersTable).orderBy(readersTable.name);

  if (allReaders.length === 0) {
    return dates.flatMap((date) =>
      roles.map((role) => ({
        date,
        role,
        readerId: null,
        isVacant: true,
        liturgicalSeason: getLiturgicalSeason(date),
      }))
    );
  }

  const endDate = addDays(startDate, period === "15days" ? 14 : 30);
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
    .where(and(eq(calendarTable.isVacant, false)))
    .groupBy(calendarTable.readerId);

  const countMap = new Map<number, number>();
  for (const row of historicalCounts) {
    if (row.readerId) {
      countMap.set(row.readerId, Number(row.count));
    }
  }

  const readersWithCounts: ReaderWithCount[] = allReaders.map((r) => ({
    ...r,
    assignmentCount: countMap.get(r.id) ?? 0,
  }));

  const results: Array<{
    date: string;
    role: string;
    readerId: number | null;
    isVacant: boolean;
    liturgicalSeason: string;
  }> = [];

  // Track assignments made in this generation for proximity rule + same-day uniqueness
  const sessionAssignments = new Map<string, Set<number>>(); // date -> set of readerIds
  const saturdayPMAssignments = new Map<string, number[]>(); // saturday date -> readerIds

  const assignmentCountSession = new Map<number, number>();
  for (const reader of readersWithCounts) {
    assignmentCountSession.set(reader.id, reader.assignmentCount);
  }

  const slots: AssignmentSlot[] = [];
  for (const date of dates) {
    for (const role of roles) {
      slots.push({ date, role, liturgicalSeason: getLiturgicalSeason(date) });
    }
  }

  for (const slot of slots) {
    const { date, role } = slot;
    const dayOfWeek = getDayOfWeek(date);
    const isSaturdayPM = dayOfWeek === 6 && role.toLowerCase().includes("sábado");
    const isSundayAM = dayOfWeek === 0 && role.toLowerCase().includes("domingo");

    if (!sessionAssignments.has(date)) {
      sessionAssignments.set(date, new Set());
    }
    const usedOnDate = sessionAssignments.get(date)!;

    // For Sunday AM: find the previous Saturday
    let blockedBySaturdayPM = new Set<number>();
    if (isSundayAM) {
      const prevSat = addDays(date, -1);
      if (saturdayPMAssignments.has(prevSat)) {
        blockedBySaturdayPM = new Set(saturdayPMAssignments.get(prevSat)!);
      }
    }

    // Sort eligible readers by assignment count (ascending = equity)
    const eligible = readersWithCounts
      .filter((r) => {
        const isBlocked = blockedMap.get(r.id)?.has(date) ?? false;
        const usedToday = usedOnDate.has(r.id);
        const blockedByProximity = blockedBySaturdayPM.has(r.id);
        return !isBlocked && !usedToday && !blockedByProximity;
      })
      .sort(
        (a, b) =>
          (assignmentCountSession.get(a.id) ?? 0) - (assignmentCountSession.get(b.id) ?? 0)
      );

    if (eligible.length === 0) {
      results.push({
        date: slot.date,
        role: slot.role,
        readerId: null,
        isVacant: true,
        liturgicalSeason: slot.liturgicalSeason,
      });
    } else {
      const chosen = eligible[0];
      usedOnDate.add(chosen.id);
      assignmentCountSession.set(
        chosen.id,
        (assignmentCountSession.get(chosen.id) ?? 0) + 1
      );

      if (isSaturdayPM) {
        if (!saturdayPMAssignments.has(date)) {
          saturdayPMAssignments.set(date, []);
        }
        saturdayPMAssignments.get(date)!.push(chosen.id);
      }

      results.push({
        date: slot.date,
        role: slot.role,
        readerId: chosen.id,
        isVacant: false,
        liturgicalSeason: slot.liturgicalSeason,
      });
    }
  }

  return results;
}
