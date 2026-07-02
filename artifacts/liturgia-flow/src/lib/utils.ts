import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseISO, getMonth, getDate, isWeekend, isSameWeek } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Resolve an API path for both local dev (proxy) and Render (VITE_API_URL). */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Coerce unknown API/query data to a safe array (avoids .map/.find crashes). */
export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export function formatDate(dateString: string) {
  if (!dateString) return "";
  const d = parseISO(dateString);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function getLiturgicalSeason(dateString: string) {
  const d = parseISO(dateString);
  const m = getMonth(d); // 0-indexed
  const day = getDate(d);

  // Christmas (Dec 25 - Jan 6)
  if ((m === 11 && day >= 25) || (m === 0 && day <= 6)) {
    return { name: "Navidad", colorClass: "bg-dorado/15 text-dorado border-dorado/30" };
  }
  
  // Advent (Rough approximation: Late Nov to Dec 24)
  if ((m === 10 && day >= 27) || (m === 11 && day < 25)) {
    return { name: "Adviento", colorClass: "bg-morado/15 text-morado border-morado/30" };
  }
  
  // Lent (Rough approximation: March - Mid April)
  if ((m === 2) || (m === 3 && day < 15)) {
    return { name: "Cuaresma", colorClass: "bg-morado/15 text-morado border-morado/30" };
  }
  
  // Easter (Rough approximation: Mid April - May)
  if ((m === 3 && day >= 15) || m === 4) {
    return { name: "Pascua", colorClass: "bg-white text-foreground border-border shadow-sm" };
  }

  // Ordinary Time
  return { name: "Tiempo Ordinario", colorClass: "bg-verde/15 text-verde border-verde/30" };
}

export function checkProximityConflict(calendar: unknown, readerId: number, dateString: string) {
  if (!readerId) return false;
  const targetDate = parseISO(dateString);
  const entries = ensureArray<{ readerId?: number | null; date: string }>(calendar);

  // Find other assignments for this reader in the same week
  const sameWeekAssignments = entries.filter(entry => {
    if (entry.readerId !== readerId || entry.date === dateString) return false;
    return isSameWeek(parseISO(entry.date), targetDate, { weekStartsOn: 1 });
  });

  return sameWeekAssignments.length > 0;
}
