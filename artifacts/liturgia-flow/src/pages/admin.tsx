import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit2, Trash2, MessageCircle, AlertCircle, Sparkles,
  Calendar as CalIcon, Table as TableIcon, Clock, ArrowLeftRight,
  ChevronLeft, ChevronRight, Settings, Grid3X3, Globe, BarChart3,
  TrendingUp, TrendingDown, Minus, SendHorizonal, CheckCircle2
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameMonth
} from "date-fns";
import { es } from "date-fns/locale";
import {
  useReaders, useReaderMutations, useCalendar, useCalendarMutations,
  useUnavailability, useSchedules, useScheduleMutations, useCalendarStats
} from "@/hooks/use-liturgia";
import { formatDate, getLiturgicalSeason, checkProximityConflict, cn } from "@/lib/utils";
import type { Reader, CalendarEntry, CreateReaderInput, UpdateReaderInputLevel, MassSchedule } from "@workspace/api-client-react";

// ─── Primitive UI Components ────────────────────────────────────────────────

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl border border-border shadow-sm overflow-hidden", className)}>{children}</div>
);

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
}>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  const v: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-primary text-primary hover:bg-primary/5",
    ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  };
  const s: Record<string, string> = {
    sm: "h-9 px-3 text-xs", md: "h-11 px-6 font-medium", lg: "h-14 px-8 text-lg font-medium", icon: "h-11 w-11",
  };
  return (
    <button ref={ref} className={cn("inline-flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none", v[variant], s[size], className)} {...props} />
  );
});

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("flex h-12 w-full rounded-xl border border-border bg-transparent px-4 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
  )
);

const Badge = ({ children, className, variant = "default" }: { children: React.ReactNode; className?: string; variant?: "default" | "outline" | "destructive" | "warning" }) => {
  const v: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    outline: "border border-border text-foreground",
    destructive: "bg-destructive/10 text-destructive border border-destructive/20",
    warning: "bg-amber-100 text-amber-800 border border-amber-200",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", v[variant], className)}>{children}</span>;
};

const SelectEl = ({ value, onChange, options, placeholder, className }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; placeholder?: string; className?: string;
}) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={cn("flex h-12 w-full rounded-xl border border-border bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
    {placeholder && <option value="" disabled>{placeholder}</option>}
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Dialog = ({ isOpen, onClose, title, children, wide }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className={cn("fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 p-4", wide ? "max-w-2xl" : "max-w-lg")}>
          <Card className="w-full shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
            <h2 className="text-2xl font-serif mb-6">{title}</h2>
            {children}
          </Card>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseRolePart(roleStr: string): string {
  return roleStr.split(" - ")[0];
}

function parseSchedulePart(roleStr: string): string {
  const parts = roleStr.split(" - ");
  return parts.slice(1).join(" - ");
}

const SEASON_COLORS: Record<string, { bg: string; badge: string; border: string }> = {
  "Verde":  { bg: "rgba(134,180,134,0.10)", badge: "bg-green-100 text-green-800", border: "border-green-300" },
  "Morado": { bg: "rgba(140,100,180,0.10)", badge: "bg-purple-100 text-purple-800", border: "border-purple-300" },
  "Dorado": { bg: "rgba(201,146,42,0.12)", badge: "bg-amber-100 text-amber-800", border: "border-amber-300" },
  "Blanco": { bg: "rgba(220,230,250,0.12)", badge: "bg-blue-50 text-blue-700", border: "border-blue-200" },
  "Rojo":   { bg: "rgba(200,80,80,0.10)", badge: "bg-red-100 text-red-800", border: "border-red-300" },
};

function getGeneratedAt(entries: CalendarEntry[]): string | null {
  if (entries.length === 0) return null;
  const timestamps = entries
    .map(e => e.versionTimestamp)
    .filter(Boolean)
    .sort()
    .reverse();
  if (!timestamps[0]) return null;
  const d = new Date(timestamps[0]);
  return `${d.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`;
}

// ─── Week Grid View (5-column reference layout) ─────────────────────────────

const GRID_COLUMNS = [
  { key: "thursday",    label: "Jueves",    abbr: "Jue" },
  { key: "saturday_am", label: "Sáb A.M.",  abbr: "SáAM" },
  { key: "saturday_pm", label: "Sáb P.M.",  abbr: "SáPM" },
  { key: "sunday_am",   label: "Dom A.M.",  abbr: "DoAM" },
  { key: "sunday_pm",   label: "Dom P.M.",  abbr: "DoPM" },
] as const;

// Unified role rows (superset of all schedules)
const GRID_ROLES = [
  "Bienvenida 1",
  "Bienvenida 2",
  "Monitor",
  "1ª Lectura",
  "Salmo",
  "2ª Lectura",
  "Oraciones",
];

// Which roles apply to each day type
const ROLES_FOR_COL: Record<string, Set<string>> = {
  thursday:    new Set(["1ª Lectura", "Salmo", "Oraciones"]),
  saturday_am: new Set(["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"]),
  saturday_pm: new Set(["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"]),
  sunday_am:   new Set(["Bienvenida 1", "Bienvenida 2", "Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"]),
  sunday_pm:   new Set(["Monitor", "1ª Lectura", "Salmo", "2ª Lectura", "Oraciones"]),
};

function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

interface WeekGridViewProps {
  entries: CalendarEntry[];
  schedules: MassSchedule[];
  onEditEntry: (entry: CalendarEntry) => void;
}

function WeekGridView({ entries, schedules, onEditEntry }: WeekGridViewProps) {
  // Build scheduleId → dayType lookup
  const scheduleTypeMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of schedules) m.set(s.id, s.dayType);
    return m;
  }, [schedules]);

  // Group entries by week (Mon key) → dayType → role → entry
  const weeks = useMemo(() => {
    const weekMap = new Map<string, Map<string, CalendarEntry[]>>();

    for (const e of entries) {
      if (!e.scheduleId) continue;
      const dayType = scheduleTypeMap.get(e.scheduleId);
      if (!dayType) continue;
      // Only show in grid for the 5 key schedule types
      if (!GRID_COLUMNS.some(c => c.key === dayType)) continue;

      const weekKey = getWeekMonday(e.date);
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
      const weekData = weekMap.get(weekKey)!;
      if (!weekData.has(dayType)) weekData.set(dayType, []);
      weekData.get(dayType)!.push(e);
    }

    // Sort weeks
    return Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries, scheduleTypeMap]);

  if (weeks.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
        No hay asignaciones para mostrar en la cuadrícula.<br/>
        <span className="text-sm">Genera el calendario primero desde la pestaña "Generar".</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {weeks.map(([weekKey, weekData]) => {
        const weekEnd = new Date(weekKey + "T12:00:00");
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekLabel = `${format(new Date(weekKey + "T12:00:00"), "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;

        // Get schedule info per column
        const colInfo = GRID_COLUMNS.map(col => {
          const colEntries = weekData.get(col.key) ?? [];
          const date = colEntries[0]?.date;
          const schedule = schedules.find(s => s.dayType === col.key && s.isActive);
          return { ...col, entries: colEntries, date, schedule };
        });

        return (
          <div key={weekKey}>
            {/* Week header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-primary/20" />
              <span className="text-sm font-semibold text-primary px-2 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Semana del {weekLabel}
              </span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-primary/20 shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                {/* Column headers */}
                <thead>
                  <tr className="border-b-2 border-primary/20">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-primary bg-secondary/60 w-28">
                      Función
                    </th>
                    {colInfo.map(col => (
                      <th key={col.key} className="px-3 py-2 text-center bg-secondary/60 border-l border-primary/10">
                        <div className="font-bold text-primary text-xs" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{col.label}</div>
                        {col.schedule && (
                          <div className="text-primary/70 text-xs font-mono font-semibold">{col.schedule.time}</div>
                        )}
                        {col.date && (
                          <div className="text-muted-foreground text-xs">{format(new Date(col.date + "T12:00:00"), "d MMM", { locale: es })}</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Role rows */}
                <tbody className="divide-y divide-border">
                  {GRID_ROLES.map(role => {
                    // Check if this role appears in ANY column this week
                    const hasAnything = colInfo.some(col => ROLES_FOR_COL[col.key]?.has(role));
                    if (!hasAnything) return null;

                    return (
                      <tr key={role} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 text-xs font-semibold text-muted-foreground bg-secondary/20 border-r border-primary/10 whitespace-nowrap">
                          {role}
                        </td>
                        {colInfo.map(col => {
                          const applicable = ROLES_FOR_COL[col.key]?.has(role);
                          if (!applicable) {
                            return <td key={col.key} className="px-2 py-2.5 text-center border-l border-primary/10 bg-muted/10"><span className="text-muted-foreground/30 text-xs">—</span></td>;
                          }

                          const entry = col.entries.find(e => parseRolePart(e.role) === role);
                          if (!entry) {
                            return (
                              <td key={col.key} className="px-2 py-2.5 text-center border-l border-primary/10">
                                <span className="text-muted-foreground/40 text-xs italic">sin fecha</span>
                              </td>
                            );
                          }

                          return (
                            <td key={col.key} className="px-2 py-2.5 text-center border-l border-primary/10">
                              {entry.isVacant ? (
                                <button onClick={() => onEditEntry(entry)} className="group">
                                  <Badge variant="destructive" className="text-xs cursor-pointer group-hover:bg-destructive/20 transition-colors">
                                    🚨 VACANTE
                                  </Badge>
                                </button>
                              ) : (
                                <button onClick={() => onEditEntry(entry)} className="group text-left w-full">
                                  <span className="block text-xs font-semibold text-foreground group-hover:text-primary transition-colors" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                                    {entry.readerName}
                                  </span>
                                  {entry.logisticComment && (
                                    <span className="text-[10px] text-amber-700 italic block mt-0.5">{entry.logisticComment}</span>
                                  )}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Monthly Calendar ────────────────────────────────────────────────────────

interface MonthlyCalendarProps {
  entries: CalendarEntry[];
  onEditEntry: (entry: CalendarEntry) => void;
}

function MonthlyCalendar({ entries, onEditEntry }: MonthlyCalendarProps) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const entryByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [entries]);

  const firstDow = getDay(monthStart);
  const emptyCells = firstDow === 0 ? 6 : firstDow - 1;

  const selectedEntries = selectedDate ? (entryByDate.get(selectedDate) ?? []) : [];
  const selectedSeason = selectedDate ? getLiturgicalSeason(selectedDate) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-xl font-serif capitalize">{format(monthDate, "MMMM yyyy", { locale: es })}</h3>
        <Button variant="ghost" size="icon" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(SEASON_COLORS).map(([name, c]) => (
          <span key={name} className={cn("px-2 py-0.5 rounded-full border", c.badge, c.border)}>{name}</span>
        ))}
      </div>

      <div className="border border-primary/20 rounded-2xl overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b border-primary/20">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-primary bg-secondary/60">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: emptyCells }).map((_, i) => (
            <div key={`e-${i}`} className="min-h-[80px] border-b border-r border-border/30 bg-gray-50/50" />
          ))}

          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEntries = entryByDate.get(dateStr) ?? [];
            const season = dayEntries.length > 0 ? getLiturgicalSeason(dateStr) : null;
            const colors = season ? SEASON_COLORS[season.name] : null;
            const isSelected = selectedDate === dateStr;
            const vacantCount = dayEntries.filter(e => e.isVacant).length;

            const bySchedule = new Map<string, CalendarEntry[]>();
            for (const e of dayEntries) {
              const key = parseSchedulePart(e.role);
              if (!bySchedule.has(key)) bySchedule.set(key, []);
              bySchedule.get(key)!.push(e);
            }

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={cn("min-h-[80px] border-b border-r border-border/30 p-1.5 text-left transition-all hover:brightness-95", !isSameMonth(day, monthDate) && "opacity-50", isSelected && "ring-2 ring-inset ring-primary")}
                style={{ background: colors ? colors.bg : undefined }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full", isSelected ? "bg-primary text-white" : "text-foreground")}>
                    {format(day, "d")}
                  </span>
                  {vacantCount > 0 && <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-1 font-bold">!{vacantCount}</span>}
                </div>
                {Array.from(bySchedule.entries()).slice(0, 2).map(([schedName, es]) => (
                  <div key={schedName} className="text-[10px] leading-tight mb-0.5">
                    <span className="text-muted-foreground font-medium">{schedName.split(" ").slice(-2).join(" ")}: </span>
                    {es.slice(0, 2).map(e => e.isVacant ? <span key={e.id} className="text-red-500">✗ </span> : <span key={e.id}>{e.readerName?.split(" ")[0]} </span>)}
                    {es.length > 2 && <span className="text-muted-foreground">+{es.length - 2}</span>}
                  </div>
                ))}
                {bySchedule.size > 2 && <div className="text-[10px] text-muted-foreground">+{bySchedule.size - 2} misas</div>}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="text-xl font-serif">
                    {format(new Date(selectedDate + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                  </h4>
                  {selectedSeason && (
                    <Badge className={cn("mt-1", SEASON_COLORS[selectedSeason.name]?.badge)}>
                      Temporada {selectedSeason.name}
                    </Badge>
                  )}
                </div>
                <button onClick={() => setSelectedDate(null)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
              </div>

              {selectedEntries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay asignaciones para este día.</p>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const groups = new Map<string, CalendarEntry[]>();
                    for (const e of selectedEntries) {
                      const key = parseSchedulePart(e.role);
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(e);
                    }
                    return Array.from(groups.entries()).map(([schedName, grp]) => (
                      <div key={schedName}>
                        <h5 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {schedName}
                        </h5>
                        <table className="w-full text-sm">
                          <tbody>
                            {grp.map(entry => (
                              <tr key={entry.id} className="border-b border-border/40 last:border-0">
                                <td className="py-2 pr-3 text-muted-foreground w-40">{parseRolePart(entry.role)}</td>
                                <td className="py-2 font-medium">
                                  {entry.isVacant ? <Badge variant="destructive" className="text-xs">🚨 VACANTE</Badge> : <span className="font-serif">{entry.readerName}</span>}
                                </td>
                                <td className="py-2 text-right">
                                  <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => onEditEntry(entry)}>
                                    <Edit2 className="w-3 h-3 mr-1" /> Editar
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Edit Modal (Reassign / Swap) ────────────────────────────────────────────

interface EditModalProps {
  entry: CalendarEntry | null;
  sameDay: CalendarEntry[];
  readers: Reader[];
  allUnavailability: any[];
  onClose: () => void;
  onReassign: (entryId: number, readerId: number | null, comment?: string) => void;
  onSwap: (a: number, b: number) => void;
  isLoading: boolean;
}

function EditModal({ entry, sameDay, readers, allUnavailability, onClose, onReassign, onSwap, isLoading }: EditModalProps) {
  const [tab, setTab] = useState<"reassign" | "swap">("reassign");
  const [selectedReaderId, setSelectedReaderId] = useState<string>(entry?.readerId?.toString() ?? "0");
  const [comment, setComment] = useState<string>(entry?.logisticComment ?? "");
  const [swapTargetId, setSwapTargetId] = useState<string>("");

  if (!entry) return null;

  const blockedOnDate = new Set(
    allUnavailability.filter((u: any) => u.blockedDate === entry.date).map((u: any) => u.readerId)
  );
  const availableReaders = readers.filter(r => !blockedOnDate.has(r.id));
  const otherEntries = sameDay.filter(e => e.id !== entry.id);

  return (
    <Dialog isOpen onClose={onClose} title="Editar Asignación" wide>
      <div className="space-y-5">
        <div className="bg-secondary/50 rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Entrada seleccionada</p>
          <p className="font-medium">{formatDate(entry.date)} · {parseSchedulePart(entry.role)}</p>
          <p className="text-sm font-serif">{parseRolePart(entry.role)}</p>
          <p className="text-sm">Actual: <span className={cn("font-semibold", entry.isVacant ? "text-destructive" : "text-primary")}>{entry.isVacant ? "VACANTE" : entry.readerName}</span></p>
        </div>

        <div className="flex rounded-xl overflow-hidden border border-border">
          <button onClick={() => setTab("reassign")} className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", tab === "reassign" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}>
            <Edit2 className="w-4 h-4 inline mr-1" /> Reasignar
          </button>
          <button onClick={() => setTab("swap")} disabled={otherEntries.length === 0} className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", tab === "swap" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}>
            <ArrowLeftRight className="w-4 h-4 inline mr-1" /> Intercambiar
          </button>
        </div>

        {tab === "reassign" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Lector</label>
              <SelectEl value={selectedReaderId} onChange={setSelectedReaderId} options={[{ label: "-- VACANTE --", value: "0" }, ...availableReaders.map(r => ({ label: r.name + (r.level === "Experto" ? " ★" : ""), value: r.id.toString() }))]} />
              {blockedOnDate.size > 0 && <p className="text-xs text-amber-700 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{blockedOnDate.size} lector(es) no disponibles (ocultos).</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comentario logístico</label>
              <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Ej. Llegar 20 min antes" className="h-10" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1" disabled={isLoading} onClick={() => { onReassign(entry.id, selectedReaderId === "0" ? null : Number(selectedReaderId), comment); onClose(); }}>
                {isLoading ? "Guardando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        )}

        {tab === "swap" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Elige otra asignación del mismo día para intercambiar lectores.</p>
            <SelectEl value={swapTargetId} onChange={setSwapTargetId} placeholder="-- Seleccionar --" options={otherEntries.map(e => ({ label: `${parseRolePart(e.role)} → ${e.isVacant ? "VACANTE" : e.readerName}`, value: e.id.toString() }))} />
            {swapTargetId && (() => {
              const target = otherEntries.find(e => e.id.toString() === swapTargetId);
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
                  <p className="font-medium mb-1">Resultado del intercambio:</p>
                  <ul className="space-y-0.5">
                    <li>• {parseRolePart(entry.role)} → <strong>{target?.isVacant ? "VACANTE" : target?.readerName}</strong></li>
                    <li>• {parseRolePart(target?.role ?? "")} → <strong>{entry.isVacant ? "VACANTE" : entry.readerName}</strong></li>
                  </ul>
                </div>
              );
            })()}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1" disabled={isLoading || !swapTargetId} onClick={() => { if (swapTargetId) { onSwap(entry.id, Number(swapTargetId)); onClose(); } }}>
                {isLoading ? "Intercambiando..." : "Confirmar Intercambio"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ─── CalendarTab ─────────────────────────────────────────────────────────────

function CalendarTab() {
  const { data: calendar = [], isLoading } = useCalendar();
  const { data: readers = [] } = useReaders();
  const { data: allUnavailability = [] } = useUnavailability();
  const { data: schedules = [] } = useSchedules();
  const { updateEntry, swap, publish } = useCalendarMutations();

  const [viewMode, setViewMode] = useState<"tabla" | "mensual" | "cuadricula">("cuadricula");
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const sameDayEntries = useMemo(() => {
    if (!editingEntry) return [];
    return calendar.filter(e => e.date === editingEntry.date);
  }, [editingEntry, calendar]);

  const generatedAt = getGeneratedAt(calendar);
  const draftCount = calendar.filter(e => !e.isPublished).length;
  const publishedCount = calendar.filter(e => e.isPublished).length;
  const hasUnpublished = draftCount > 0;

  const handleReassign = (entryId: number, readerId: number | null, logisticComment?: string) => {
    updateEntry.mutate({ id: entryId, data: { readerId: readerId ?? undefined, isVacant: readerId === null, logisticComment: logisticComment ?? null } });
  };

  const handleSwap = (a: number, b: number) => {
    swap.mutate({ data: { entryIdA: a, entryIdB: b } });
  };

  const generateWhatsApp = () => {
    let msg = `🙏 *CALENDARIO LITÚRGICO DE LECTORES*\n`;
    msg += `*Parroquia Santo Cristo de Esquipulas*\n`;
    if (generatedAt) msg += `_Generado el: ${generatedAt}_\n`;
    msg += `\n`;

    let curDate = "";
    let curSched = "";
    const sorted = [...calendar].sort((a, b) => a.date.localeCompare(b.date) || a.role.localeCompare(b.role));

    sorted.forEach(c => {
      const schedPart = parseSchedulePart(c.role);
      if (c.date !== curDate) {
        msg += `\n📅 *${formatDate(c.date)}*\n`;
        curDate = c.date;
        curSched = "";
      }
      if (schedPart !== curSched) {
        msg += `  ⏰ _${schedPart}_\n`;
        curSched = schedPart;
      }
      msg += `   • ${parseRolePart(c.role)}: ${c.isVacant ? "🚨 VACANTE" : c.readerName}`;
      if (c.logisticComment) msg += ` _(${c.logisticComment})_`;
      msg += `\n`;
    });

    msg += `\n🙏 _Dios habla cada día; el reto es aprender a escucharlo._ ❤️`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (isLoading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const VIEW_OPTIONS = [
    { key: "cuadricula", label: "Cuadrícula", icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { key: "tabla", label: "Lista", icon: <TableIcon className="w-3.5 h-3.5" /> },
    { key: "mensual", label: "Mensual", icon: <CalIcon className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div>
            <h2 className="text-2xl font-serif">Calendario Asignado</h2>
            {generatedAt && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Generado el: <span className="font-semibold">{generatedAt}</span>
              </p>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              {publishedCount > 0 && (
                <span className="text-xs bg-green-100 text-green-800 border border-green-200 rounded-full px-2.5 py-0.5 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> {publishedCount} publicadas
                </span>
              )}
              {hasUnpublished && (
                <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" /> {draftCount} en borrador
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex rounded-xl border border-border overflow-hidden">
              {VIEW_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setViewMode(opt.key)} className={cn("px-3 py-2 text-xs flex items-center gap-1 transition-colors", viewMode === opt.key ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted")}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
            {hasUnpublished && (
              <Button onClick={() => setShowPublishConfirm(true)} size="sm" className="gap-1.5 bg-green-700 text-white border-green-800 hover:bg-green-800" disabled={publish.isPending}>
                <Globe className="w-4 h-4" /> Publicar
              </Button>
            )}
            <Button onClick={generateWhatsApp} variant="outline" size="sm" className="gap-1.5 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </Button>
          </div>
      </div>

      {viewMode === "cuadricula" && <WeekGridView entries={calendar} schedules={schedules} onEditEntry={setEditingEntry} />}
      {viewMode === "mensual" && <MonthlyCalendar entries={calendar} onEditEntry={setEditingEntry} />}
      {viewMode === "tabla" && (
        <Card className="overflow-x-auto border border-primary/20 shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="border-b-2 border-primary/25">
              <tr>
                {["Fecha", "Temporada", "Misa", "Rol", "Lector Asignado", "Comentario", ""].map(h => (
                  <th key={h} className="px-4 py-3 font-semibold text-primary text-sm bg-secondary/70 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {calendar.map(entry => {
                const season = getLiturgicalSeason(entry.date);
                const conflict = entry.readerId ? checkProximityConflict(calendar, entry.readerId, entry.date) : false;
                const colors = SEASON_COLORS[entry.liturgicalSeason ?? season.name];
                return (
                  <tr key={entry.id} className="hover:brightness-95 transition-colors" style={{ background: colors?.bg }}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3"><Badge className={colors?.badge ?? ""}>{entry.liturgicalSeason ?? season.name}</Badge></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{parseSchedulePart(entry.role)}</td>
                    <td className="px-4 py-3 font-medium">{parseRolePart(entry.role)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {entry.isVacant ? <Badge variant="destructive" className="text-xs font-bold uppercase tracking-widest">🚨 VACANTE</Badge> : <span className="font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{entry.readerName}</span>}
                        {!entry.isVacant && conflict && <AlertCircle className="w-4 h-4 text-amber-500" title="Asignado en misa contigua" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground italic">{entry.logisticComment || "—"}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" onClick={() => setEditingEntry(entry)} className="text-xs gap-1"><Edit2 className="w-3 h-3" /> Editar</Button>
                    </td>
                  </tr>
                );
              })}
              {calendar.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No hay asignaciones. Usa "Generar" para crear el calendario.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      <EditModal
        entry={editingEntry}
        sameDay={sameDayEntries}
        readers={readers}
        allUnavailability={allUnavailability}
        onClose={() => setEditingEntry(null)}
        onReassign={handleReassign}
        onSwap={handleSwap}
        isLoading={updateEntry.isPending || swap.isPending}
      />
    </div>
  );
}

// ─── GenerateTab ──────────────────────────────────────────────────────────────

function GenerateTab() {
  const { data: schedules = [] } = useSchedules();
  const { generate } = useCalendarMutations();
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split("T")[0],
    period: "1month" as "15days" | "1month",
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (window.confirm("Se borrarán y regenerarán las asignaciones del período indicado. ¿Continuar?")) {
      generate.mutate({ data: { startDate: formData.startDate, period: formData.period } });
    }
  };

  const activeSchedules = schedules.filter((s: MassSchedule) => s.isActive);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-serif text-primary flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent" /> Asignación Inteligente
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          El algoritmo asigna lectores únicos por rol y día, respeta indisponibilidades y aplica la regla de proximidad (Sáb P.M. → bloquea Dom A.M.). Los roles se toman de la Configuración.
        </p>
      </div>

      {activeSchedules.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3 text-primary">Misas activas que se generarán:</p>
          <div className="space-y-2">
            {activeSchedules.map((s: MassSchedule) => (
              <div key={s.id} className="flex items-start gap-2 text-sm">
                <Clock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-mono font-semibold text-primary">{s.time}</span>
                  <span className="text-muted-foreground text-xs ml-2">{(s.roles ?? []).join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de Inicio</label>
              <Input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Período</label>
              <SelectEl value={formData.period} onChange={v => setFormData({ ...formData, period: v as any })} options={[{ label: "1 Mes", value: "1month" }, { label: "15 Días", value: "15days" }]} />
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={generate.isPending}>
            {generate.isPending ? "Generando..." : "Generar y Asignar Calendario"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// ─── ConfigTab ────────────────────────────────────────────────────────────────

function ConfigTab() {
  const { data: schedules = [], isLoading } = useSchedules();
  const { update } = useScheduleMutations();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editName, setEditName] = useState("");

  const handleSave = (id: number) => {
    update.mutate({ id, data: { time: editTime, name: editName } });
    setEditingId(null);
  };

  if (isLoading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-serif text-primary flex items-center gap-2">
          <Settings className="w-6 h-6 text-accent" /> Configuración de Horarios
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Modifica la hora de cada misa y activa o desactiva jornadas. Los cambios se reflejan automáticamente en los mensajes de WhatsApp del calendario ya generado y en futuras generaciones.
        </p>
      </div>

      <div className="space-y-3">
        {schedules.map((s: MassSchedule) => (
          <Card key={s.id} className={cn("p-4 transition-opacity", !s.isActive && "opacity-60")}>
            <div className="flex items-start gap-3">
              <button
                onClick={() => update.mutate({ id: s.id, data: { isActive: !s.isActive } })}
                title={s.isActive ? "Desactivar" : "Activar"}
                className={cn("mt-1 shrink-0 w-10 h-6 rounded-full transition-colors border relative", s.isActive ? "bg-primary/20 border-primary/40" : "bg-muted border-border")}
              >
                <span className={cn("absolute top-1 left-1 w-4 h-4 rounded-full transition-transform", s.isActive ? "bg-primary translate-x-4" : "bg-muted-foreground")} />
              </button>
              <div className="flex-1 min-w-0">
                {editingId === s.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Nombre</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-10 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Hora (HH:MM)</label>
                      <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="h-10 mt-1 w-40" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(s.id)} disabled={update.isPending}>Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{s.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono font-bold text-primary">{s.time}</span>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingId(s.id); setEditTime(s.time); setEditName(s.name); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(s.roles ?? []).map((role: string) => <Badge key={role} variant="outline" className="text-xs">{role}</Badge>)}
                    </div>
                    {!s.isActive && <p className="text-xs text-amber-700 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Misa desactivada.</p>}
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Nota:</strong> Los mensajes de WhatsApp ya reflejan el horario actual. Para actualizar asignaciones existentes al nuevo horario, regenera el calendario.
      </div>
    </div>
  );
}

// ─── ReadersTab ───────────────────────────────────────────────────────────────

function ReadersTab() {
  const { data: readers = [], isLoading } = useReaders();
  const { create, update, remove } = useReaderMutations();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReader, setEditingReader] = useState<Reader | null>(null);
  const [formData, setFormData] = useState({ name: "", whatsapp: "", level: "Principiante" as UpdateReaderInputLevel });

  const openCreate = () => { setEditingReader(null); setFormData({ name: "", whatsapp: "", level: "Principiante" }); setIsModalOpen(true); };
  const openEdit = (r: Reader) => { setEditingReader(r); setFormData({ name: r.name, whatsapp: r.whatsapp, level: r.level }); setIsModalOpen(true); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (editingReader) update.mutate({ id: editingReader.id, data: formData }); else create.mutate({ data: formData as CreateReaderInput }); setIsModalOpen(false); };

  if (isLoading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif">Directorio de Lectores</h2>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-5 h-5" /> Nuevo Lector</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {readers.map(reader => (
          <Card key={reader.id} className="p-5 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{reader.name}</h3>
                <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1"><MessageCircle className="w-3 h-3" /> {reader.whatsapp}</p>
              </div>
              <Badge variant={reader.level === "Experto" ? "default" : "outline"}>{reader.level}</Badge>
            </div>
            <div className="mt-auto flex gap-2 pt-4 border-t border-border/50">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(reader)}><Edit2 className="w-4 h-4 mr-2" /> Editar</Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => window.confirm("¿Eliminar este lector?") && remove.mutate({ id: reader.id })}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
        {readers.length === 0 && <div className="col-span-full py-12 text-center text-muted-foreground">No hay lectores registrados aún.</div>}
      </div>
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingReader ? "Editar Lector" : "Nuevo Lector"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre Completo</label>
            <Input required minLength={2} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Juan Pérez" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <Input required value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="Ej. +50200000000" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nivel</label>
            <SelectEl value={formData.level} onChange={v => setFormData({ ...formData, level: v as UpdateReaderInputLevel })} options={[{ label: "Principiante", value: "Principiante" }, { label: "Experto", value: "Experto" }]} />
          </div>
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={create.isPending || update.isPending}>Guardar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

const TABS = [
  { key: "readers",  label: "Lectores" },
  { key: "calendar", label: "Calendario" },
  { key: "generate", label: "Generar" },
  { key: "config",   label: "Configuración" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("readers");
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap gap-2 p-1.5 bg-muted/50 rounded-2xl w-full border border-border">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 relative flex-1", activeTab === tab.key ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-black/5")}>
            {activeTab === tab.key && <motion.div layoutId="activeTab" className="absolute inset-0 bg-white rounded-xl shadow-sm border border-border" style={{ zIndex: -1 }} />}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === "readers" && <ReadersTab />}
            {activeTab === "calendar" && <CalendarTab />}
            {activeTab === "generate" && <GenerateTab />}
            {activeTab === "config" && <ConfigTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
