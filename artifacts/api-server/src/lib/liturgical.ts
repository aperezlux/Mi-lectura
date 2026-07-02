export type LiturgicalSeason = "Verde" | "Morado" | "Dorado" | "Blanco";

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getLiturgicalSeason(dateStr: string): LiturgicalSeason {
  const date = new Date(dateStr + "T12:00:00");
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const easter = getEasterDate(year);
  const easterMs = easter.getTime();
  const dateMs = date.getTime();
  const dayMs = 86400000;

  // Christmas: Dec 25 - Jan 6
  if ((month === 12 && day >= 25) || (month === 1 && day <= 6)) {
    return "Dorado";
  }

  // Advent: 4 Sundays before Christmas
  const christmas = new Date(year, 11, 25);
  const christmasDay = christmas.getDay();
  const daysUntilSunday = christmasDay === 0 ? 0 : 7 - christmasDay;
  const fourthAdventSunday = new Date(christmas.getTime() - daysUntilSunday * dayMs);
  const adventStart = new Date(fourthAdventSunday.getTime() - 21 * dayMs);
  if (date >= adventStart && date < christmas) {
    return "Morado";
  }

  // Easter season: Easter to Pentecost (50 days)
  const pentecost = new Date(easterMs + 49 * dayMs);
  if (date >= easter && date <= pentecost) {
    return "Blanco";
  }

  // Lent: Ash Wednesday (46 days before Easter) to Holy Saturday
  const ashWednesday = new Date(easterMs - 46 * dayMs);
  const holySaturday = new Date(easterMs - dayMs);
  if (date >= ashWednesday && date <= holySaturday) {
    return "Morado";
  }

  return "Verde";
}
