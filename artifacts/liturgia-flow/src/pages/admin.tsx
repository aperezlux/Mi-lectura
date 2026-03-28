import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit2, Trash2, MessageCircle, AlertCircle, Sparkles,
  Calendar as CalIcon, Table as TableIcon, Clock, ToggleLeft, ArrowLeftRight, ChevronLeft, ChevronRight, Settings
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameMonth
} from "date-fns";
import { es } from "date-fns/locale";
import {
  useReaders, useReaderMutations, useCalendar, useCalendarMutations,
  useUnavailability, useSchedules, useScheduleMutations
} from "@/hooks/use-liturgia";
import { formatDate, getLiturgicalSeason, checkProximityConflict, cn } from "@/lib/utils";
import type { Reader, CalendarEntry, CreateReaderInput, UpdateReaderInputLevel, MassSchedule } from "@workspace/api-client-react";

// ─── Primitive UI Components ───────────────────────────────────────────────

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl border border-border shadow-sm overflow-hidden", className)}>{children}</div>
);

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "success";
  size?: "sm" | "md" | "lg" | "icon";
}>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-primary text-primary hover:bg-primary/5",
    ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-xs", md: "h-11 px-6 font-medium", lg: "h-14 px-8 text-lg font-medium", icon: "h-11 w-11",
  };
  return (
    <button ref={ref} className={cn("inline-flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none", variants[variant], sizes[size], className)} {...props} />
  );
});

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("flex h-12 w-full rounded-xl border border-border bg-transparent px-4 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
  )
);

const Badge = ({ children, className, variant = "default" }: { children: React.ReactNode; className?: string; variant?: "default" | "outline" | "destructive" | "warning" | "season" }) => {
  const variants: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    outline: "border border-border text-foreground",
    destructive: "bg-destructive/10 text-destructive border border-destructive/20",
    warning: "bg-amber-100 text-amber-800 border border-amber-200",
    season: "",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", variants[variant], className)}>{children}</span>;
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

// ─── Helpers ──────────────────────────────────────────────────────────────

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

// ─── Reassign / Swap Modal ─────────────────────────────────────────────────

interface EditModalProps {
  entry: CalendarEntry | null;
  sameDay: CalendarEntry[];
  readers: Reader[];
  allUnavailability: any[];
  onClose: () => void;
  onReassign: (entryId: number, readerId: number | null) => void;
  onSwap: (entryIdA: number, entryIdB: number) => void;
  isLoading: boolean;
}

function EditModal({ entry, sameDay, readers, allUnavailability, onClose, onReassign, onSwap, isLoading }: EditModalProps) {
  const [tab, setTab] = useState<"reassign" | "swap">("reassign");
  const [selectedReaderId, setSelectedReaderId] = useState<string>(entry?.readerId?.toString() ?? "0");
  const [swapTargetId, setSwapTargetId] = useState<string>("");

  if (!entry) return null;

  const blockedOnThisDate = new Set(
    allUnavailability.filter(u => u.blockedDate === entry.date).map((u: any) => u.readerId)
  );

  const availableReaders = readers.filter(r => !blockedOnThisDate.has(r.id));

  const otherEntries = sameDay.filter(e => e.id !== entry.id);

  return (
    <Dialog isOpen onClose={onClose} title="Editar Asignación" wide>
      <div className="space-y-5">
        <div className="bg-secondary/50 rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Entrada seleccionada</p>
          <p className="font-medium">{formatDate(entry.date)} · {parseSchedulePart(entry.role)}</p>
          <p className="text-sm font-serif">{parseRolePart(entry.role)}</p>
          <p className="text-sm">
            Asignado:{" "}
            <span className={cn("font-semibold", entry.isVacant ? "text-destructive" : "text-primary")}>
              {entry.isVacant ? "VACANTE" : entry.readerName}
            </span>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-border">
          <button
            className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", tab === "reassign" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
            onClick={() => setTab("reassign")}
          >
            <Edit2 className="w-4 h-4 inline mr-1" /> Reasignar
          </button>
          <button
            className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", tab === "swap" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
            onClick={() => setTab("swap")}
            disabled={otherEntries.length === 0}
          >
            <ArrowLeftRight className="w-4 h-4 inline mr-1" /> Intercambiar
          </button>
        </div>

        {tab === "reassign" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Seleccionar Lector</label>
              <SelectEl
                value={selectedReaderId}
                onChange={setSelectedReaderId}
                options={[
                  { label: "-- VACANTE --", value: "0" },
                  ...availableReaders.map(r => ({ label: r.name + (r.level === "Experto" ? " ★" : ""), value: r.id.toString() }))
                ]}
              />
              {blockedOnThisDate.size > 0 && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {blockedOnThisDate.size} lector(es) no disponibles para esta fecha (ocultos).
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button
                className="flex-1"
                disabled={isLoading}
                onClick={() => {
                  const rid = selectedReaderId === "0" ? null : Number(selectedReaderId);
                  onReassign(entry.id, rid);
                  onClose();
                }}
              >
                {isLoading ? "Guardando..." : "Confirmar Reasignación"}
              </Button>
            </div>
          </div>
        )}

        {tab === "swap" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona otra asignación del mismo día con quien intercambiar el lector.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Intercambiar con:</label>
              <SelectEl
                value={swapTargetId}
                onChange={setSwapTargetId}
                placeholder="-- Seleccionar asignación --"
                options={otherEntries.map(e => ({
                  label: `${parseRolePart(e.role)} → ${e.isVacant ? "VACANTE" : e.readerName}`,
                  value: e.id.toString()
                }))}
              />
            </div>
            {swapTargetId && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                <p className="font-medium text-amber-900 mb-1">Resultado del intercambio:</p>
                {(() => {
                  const target = otherEntries.find(e => e.id.toString() === swapTargetId);
                  return (
                    <ul className="text-amber-800 space-y-0.5">
                      <li>• {parseRolePart(entry.role)} → <strong>{target?.isVacant ? "VACANTE" : target?.readerName}</strong></li>
                      <li>• {parseRolePart(target?.role ?? "")} → <strong>{entry.isVacant ? "VACANTE" : entry.readerName}</strong></li>
                    </ul>
                  );
                })()}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button
                className="flex-1"
                disabled={isLoading || !swapTargetId}
                onClick={() => {
                  if (swapTargetId) {
                    onSwap(entry.id, Number(swapTargetId));
                    onClose();
                  }
                }}
              >
                {isLoading ? "Intercambiando..." : "Confirmar Intercambio"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ─── Monthly Calendar ──────────────────────────────────────────────────────

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

  // Build entry lookup by date
  const entryByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [entries]);

  // Starting empty cells
  const firstDow = getDay(monthStart); // 0=Sun
  const emptyCells = firstDow === 0 ? 6 : firstDow - 1; // Mon-first grid

  const selectedEntries = selectedDate ? (entryByDate.get(selectedDate) ?? []) : [];
  const selectedSeason = selectedDate ? getLiturgicalSeason(selectedDate) : null;

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-xl font-serif capitalize">{format(monthDate, "MMMM yyyy", { locale: es })}</h3>
        <Button variant="ghost" size="icon" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(SEASON_COLORS).map(([name, c]) => (
          <span key={name} className={cn("px-2 py-0.5 rounded-full border", c.badge, c.border)}>{name}</span>
        ))}
      </div>

      {/* Grid */}
      <div className="border border-primary/20 rounded-2xl overflow-hidden bg-white">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-primary/20">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-primary bg-secondary/60">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: emptyCells }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-border/30 bg-gray-50/50" />
          ))}

          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEntries = entryByDate.get(dateStr) ?? [];
            const season = dayEntries.length > 0 ? getLiturgicalSeason(dateStr) : null;
            const colors = season ? SEASON_COLORS[season.name] : null;
            const isSelected = selectedDate === dateStr;
            const vacantCount = dayEntries.filter(e => e.isVacant).length;

            // Group entries by schedule
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
                className={cn(
                  "min-h-[80px] border-b border-r border-border/30 p-1.5 text-left transition-all hover:brightness-95",
                  !isSameMonth(day, monthDate) && "bg-gray-50/50 opacity-50",
                  isSelected && "ring-2 ring-inset ring-primary",
                )}
                style={{ background: colors ? colors.bg : undefined }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full", isSelected ? "bg-primary text-white" : "text-foreground")}>
                    {format(day, "d")}
                  </span>
                  {vacantCount > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-1 font-bold">!{vacantCount}</span>
                  )}
                </div>
                {Array.from(bySchedule.entries()).slice(0, 2).map(([schedName, es]) => (
                  <div key={schedName} className="text-[10px] leading-tight mb-0.5">
                    <span className="text-muted-foreground font-medium">{schedName.split(" ").slice(-2).join(" ")}: </span>
                    {es.slice(0, 2).map(e => e.isVacant ? <span key={e.id} className="text-red-500">✗</span> : <span key={e.id}>{e.readerName?.split(" ")[0]} </span>)}
                    {es.length > 2 && <span className="text-muted-foreground">+{es.length - 2}</span>}
                  </div>
                ))}
                {bySchedule.size > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{bySchedule.size - 2} misas</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
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
                  {/* Group by schedule */}
                  {(() => {
                    const scheduleGroups = new Map<string, CalendarEntry[]>();
                    for (const e of selectedEntries) {
                      const key = parseSchedulePart(e.role);
                      if (!scheduleGroups.has(key)) scheduleGroups.set(key, []);
                      scheduleGroups.get(key)!.push(e);
                    }
                    return Array.from(scheduleGroups.entries()).map(([schedName, groupEntries]) => (
                      <div key={schedName}>
                        <h5 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {schedName}
                        </h5>
                        <table className="w-full text-sm">
                          <tbody>
                            {groupEntries.map(entry => (
                              <tr key={entry.id} className="border-b border-border/40 last:border-0">
                                <td className="py-2 pr-3 text-muted-foreground w-40">{parseRolePart(entry.role)}</td>
                                <td className="py-2 font-medium flex-1">
                                  {entry.isVacant ? (
                                    <Badge variant="destructive" className="text-xs">🚨 VACANTE</Badge>
                                  ) : (
                                    <span className="font-serif">{entry.readerName}</span>
                                  )}
                                </td>
                                <td className="py-2 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-primary"
                                    onClick={() => onEditEntry(entry)}
                                  >
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

// ─── CalendarTab ─────────────────────────────────────────────────────────

function CalendarTab() {
  const { data: calendar = [], isLoading } = useCalendar();
  const { data: readers = [] } = useReaders();
  const { data: allUnavailability = [] } = useUnavailability();
  const { updateEntry, swap } = useCalendarMutations();

  const [viewMode, setViewMode] = useState<"table" | "monthly">("table");
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);

  const handleReassign = (entryId: number, readerId: number | null) => {
    updateEntry.mutate({
      id: entryId,
      data: { readerId: readerId ?? undefined, isVacant: readerId === null }
    });
  };

  const handleSwap = (entryIdA: number, entryIdB: number) => {
    swap.mutate({ data: { entryIdA, entryIdB } });
  };

  const sameDayEntries = useMemo(() => {
    if (!editingEntry) return [];
    return calendar.filter(e => e.date === editingEntry.date);
  }, [editingEntry, calendar]);

  const generateWhatsAppMessage = () => {
    let msg = `🙏 *Calendario Litúrgico de Lectores*\n*Parroquia Santo Cristo de Esquipulas*\n\n`;
    let currentDate = "";
    let currentSchedule = "";
    const sorted = [...calendar].sort((a, b) => a.date.localeCompare(b.date) || a.role.localeCompare(b.role));

    sorted.forEach(c => {
      const schedPart = parseSchedulePart(c.role);
      if (c.date !== currentDate) {
        msg += `\n📅 *${formatDate(c.date)}*\n`;
        currentDate = c.date;
        currentSchedule = "";
      }
      if (schedPart !== currentSchedule) {
        msg += `  ⏰ _${schedPart}_\n`;
        currentSchedule = schedPart;
      }
      msg += `   • ${parseRolePart(c.role)}: ${c.isVacant ? "🚨 VACANTE" : c.readerName}\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (isLoading) {
    return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-serif">Calendario Asignado</h2>
        <div className="flex gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={cn("px-3 py-2 text-xs flex items-center gap-1 transition-colors", viewMode === "table" ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted")}
            >
              <TableIcon className="w-3.5 h-3.5" /> Tabla
            </button>
            <button
              onClick={() => setViewMode("monthly")}
              className={cn("px-3 py-2 text-xs flex items-center gap-1 transition-colors", viewMode === "monthly" ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted")}
            >
              <CalIcon className="w-3.5 h-3.5" /> Mensual
            </button>
          </div>
          <Button onClick={generateWhatsAppMessage} variant="outline" size="sm" className="gap-1.5 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </Button>
        </div>
      </div>

      {viewMode === "monthly" ? (
        <MonthlyCalendar entries={calendar} onEditEntry={setEditingEntry} />
      ) : (
        <Card className="overflow-x-auto border border-primary/20 shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="border-b-2 border-primary/25">
              <tr>
                {["Fecha", "Temporada", "Misa", "Rol", "Lector Asignado", ""].map(h => (
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
                    <td className="px-4 py-3">
                      <Badge className={colors?.badge ?? ""}>{entry.liturgicalSeason ?? season.name}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{parseSchedulePart(entry.role)}</td>
                    <td className="px-4 py-3 font-medium">{parseRolePart(entry.role)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {entry.isVacant ? (
                          <Badge variant="destructive" className="text-xs font-bold uppercase tracking-widest">🚨 VACANTE</Badge>
                        ) : (
                          <span className="font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{entry.readerName}</span>
                        )}
                        {!entry.isVacant && conflict && <AlertCircle className="w-4 h-4 text-amber-500" title="Asignado en misa contigua" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" onClick={() => setEditingEntry(entry)} className="text-xs gap-1">
                        <Edit2 className="w-3 h-3" /> Editar
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {calendar.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No hay fechas en el calendario. Usa "Generar" para crear asignaciones.</td>
                </tr>
              )}
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

// ─── GenerateTab ──────────────────────────────────────────────────────────

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
          El algoritmo asigna lectores distintos a cada rol por día, respeta indisponibilidades y aplica la regla de proximidad (Sáb PM → Dom AM). Los roles se toman de la Configuración de Horarios.
        </p>
      </div>

      {/* Preview of what will be generated */}
      {activeSchedules.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3 text-primary">Misas activas que se generarán:</p>
          <div className="space-y-1.5">
            {activeSchedules.map((s: MassSchedule) => (
              <div key={s.id} className="flex items-start gap-2 text-sm">
                <Clock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground"> · {s.time} · </span>
                  <span className="text-xs text-muted-foreground">{s.roles?.join(", ")}</span>
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
              <SelectEl
                value={formData.period}
                onChange={v => setFormData({ ...formData, period: v as any })}
                options={[{ label: "1 Mes", value: "1month" }, { label: "15 Días", value: "15days" }]}
              />
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

// ─── ConfigTab ────────────────────────────────────────────────────────────

function ConfigTab() {
  const { data: schedules = [], isLoading } = useSchedules();
  const { update } = useScheduleMutations();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editName, setEditName] = useState("");

  const handleEdit = (s: MassSchedule) => {
    setEditingId(s.id);
    setEditTime(s.time);
    setEditName(s.name);
  };

  const handleSave = (id: number) => {
    update.mutate({ id, data: { time: editTime, name: editName } });
    setEditingId(null);
  };

  const handleToggleActive = (s: MassSchedule) => {
    update.mutate({ id: s.id, data: { isActive: !s.isActive } });
  };

  if (isLoading) {
    return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-serif text-primary flex items-center gap-2">
          <Settings className="w-6 h-6 text-accent" /> Configuración de Horarios
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Configura la hora de cada misa y activa o desactiva jornadas. Los cambios se reflejan en el próximo calendario generado y en los mensajes de WhatsApp.
        </p>
      </div>

      <div className="space-y-3">
        {schedules.map((s: MassSchedule) => (
          <Card key={s.id} className={cn("p-4 transition-opacity", !s.isActive && "opacity-60")}>
            <div className="flex items-start gap-3">
              {/* Active toggle */}
              <button
                onClick={() => handleToggleActive(s)}
                title={s.isActive ? "Desactivar" : "Activar"}
                className={cn("mt-1 shrink-0 w-10 h-6 rounded-full transition-colors border", s.isActive ? "bg-primary/20 border-primary/40" : "bg-muted border-border")}
              >
                <span className={cn("block w-4 h-4 rounded-full transition-transform mx-1", s.isActive ? "bg-primary translate-x-4" : "bg-muted-foreground translate-x-0")} />
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
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(s)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(s.roles ?? []).map((role: string) => (
                        <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
                      ))}
                    </div>
                    {!s.isActive && (
                      <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Esta misa está desactivada y no se incluirá en la generación.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Nota:</strong> Al cambiar la hora de una misa, los mensajes de WhatsApp del calendario ya generado reflejarán la nueva hora automáticamente. Para reflejar los cambios en las asignaciones, regenera el calendario.
      </div>
    </div>
  );
}

// ─── Admin Page ────────────────────────────────────────────────────────────

const TABS = [
  { key: "readers", label: "Lectores" },
  { key: "calendar", label: "Calendario" },
  { key: "generate", label: "Generar" },
  { key: "config", label: "Configuración" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("readers");

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap gap-2 p-1.5 bg-muted/50 rounded-2xl w-full border border-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 relative flex-1",
              activeTab === tab.key ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-black/5"
            )}
          >
            {activeTab === tab.key && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-white rounded-xl shadow-sm border border-border" style={{ zIndex: -1 }} />
            )}
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

// ─── ReadersTab ────────────────────────────────────────────────────────────

function ReadersTab() {
  const { data: readers = [], isLoading } = useReaders();
  const { create, update, remove } = useReaderMutations();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReader, setEditingReader] = useState<Reader | null>(null);
  const [formData, setFormData] = useState({ name: "", whatsapp: "", level: "Principiante" as UpdateReaderInputLevel });

  const openCreate = () => { setEditingReader(null); setFormData({ name: "", whatsapp: "", level: "Principiante" }); setIsModalOpen(true); };
  const openEdit = (r: Reader) => { setEditingReader(r); setFormData({ name: r.name, whatsapp: r.whatsapp, level: r.level }); setIsModalOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReader) update.mutate({ id: editingReader.id, data: formData });
    else create.mutate({ data: formData as CreateReaderInput });
    setIsModalOpen(false);
  };

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
            <Input required value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="Ej. +34600000000" />
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
