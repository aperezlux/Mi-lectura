import React, { useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, addMonths, subMonths, getDay
} from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useReaders, useUnavailability, useUnavailabilityMutations, useCalendar } from "@/hooks/use-liturgia";
import { cn, formatDate } from "@/lib/utils";
import {
  Calendar as CalendarIcon, UserCircle, AlertCircle,
  ChevronLeft, ChevronRight, CheckCircle, Clock,
  BookOpen, Star, CalendarDays
} from "lucide-react";

function parseRolePart(roleStr: string): string {
  return roleStr.split(" - ")[0];
}
function parseSchedulePart(roleStr: string): string {
  const parts = roleStr.split(" - ");
  return parts.slice(1).join(" - ");
}

// ─── Unavailability Calendar (shared) ────────────────────────────────────────

interface UnavailCalendarProps {
  selectedReaderId: number;
  compact?: boolean;
}

function UnavailCalendar({ selectedReaderId, compact = false }: UnavailCalendarProps) {
  const today = new Date();
  const { data: unavailabilities = [], isLoading: loadingUnavail } = useUnavailability(selectedReaderId);
  const { data: calendar = [] } = useCalendar({ publishedOnly: true });
  const { block, unblock } = useUnavailabilityMutations();

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDow = getDay(monthStart);
  const emptyCells = firstDow === 0 ? 6 : firstDow - 1;

  const toggleDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = unavailabilities.find(u => u.blockedDate === dateStr);
    if (existing) {
      unblock.mutate({ id: existing.id });
    } else {
      block.mutate({ data: { readerId: selectedReaderId, blockedDate: dateStr } });
    }
  };

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-base capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="text-xs font-bold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: emptyCells }).map((_, i) => <div key={`p-${i}`} />)}
        {daysInMonth.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isBlocked = unavailabilities.some(u => u.blockedDate === dateStr);
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
          const isAssigned = calendar.some(c => c.readerId === selectedReaderId && c.date === dateStr);

          return (
            <button
              key={dateStr}
              disabled={isPast || loadingUnavail}
              onClick={() => toggleDate(day)}
              title={isAssigned ? "Tienes asignación publicada en este día" : undefined}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 relative",
                isPast ? "opacity-25 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer",
                isBlocked
                  ? "bg-destructive text-white shadow-md shadow-destructive/30"
                  : isAssigned
                  ? "bg-primary/20 text-primary border-2 border-primary/40"
                  : isToday(day)
                  ? "border-2 border-accent text-primary font-bold"
                  : "bg-muted/40 hover:bg-muted text-foreground"
              )}
            >
              {format(day, "d")}
              {isAssigned && !isBlocked && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-destructive inline-block" /> No disponible</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-primary/40 bg-primary/20 inline-block" /> Asignado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-accent inline-block" /> Hoy</span>
      </div>
    </div>
  );
}

// ─── Phase 2: Assignments View ────────────────────────────────────────────────

interface AssignmentsViewProps {
  readerId: number;
  readerName: string;
  readerLevel: string;
}

function AssignmentsView({ readerId, readerName, readerLevel }: AssignmentsViewProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: calendar = [] } = useCalendar({ publishedOnly: true });
  const [showCalendar, setShowCalendar] = useState(false);

  const myUpcoming = calendar
    .filter(c => c.readerId === readerId && c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const myPast = calendar
    .filter(c => c.readerId === readerId && c.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const nextAssignment = myUpcoming[0];

  // Group upcoming by date
  const grouped = new Map<string, typeof myUpcoming>();
  for (const e of myUpcoming) {
    if (!grouped.has(e.date)) grouped.set(e.date, []);
    grouped.get(e.date)!.push(e);
  }

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-primary/20 shadow-sm overflow-hidden"
      >
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bienvenido(a),</p>
              <h2 className="text-2xl font-serif text-primary">{readerName}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 text-accent" />
                <span className="text-xs text-muted-foreground">{readerLevel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next assignment highlight */}
        {nextAssignment ? (
          <div className="px-6 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">Tu próxima función</p>
            <div className="flex items-start gap-4 bg-primary/5 rounded-xl p-4 border border-primary/15">
              <div className="text-center bg-primary text-white rounded-xl px-3 py-2 shrink-0 min-w-[60px]">
                <div className="text-xs font-medium capitalize">{format(new Date(nextAssignment.date + "T12:00:00"), "MMM", { locale: es })}</div>
                <div className="text-2xl font-bold font-serif">{format(new Date(nextAssignment.date + "T12:00:00"), "d")}</div>
                <div className="text-xs capitalize">{format(new Date(nextAssignment.date + "T12:00:00"), "EEE", { locale: es })}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-lg font-serif">{parseRolePart(nextAssignment.role)}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" /> {parseSchedulePart(nextAssignment.role)}
                </p>
                {nextAssignment.logisticComment && (
                  <p className="text-sm text-amber-700 italic flex items-center gap-1 mt-2 bg-amber-50 rounded-lg px-2 py-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {nextAssignment.logisticComment}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 text-muted-foreground text-sm text-center py-6">
            No tienes funciones próximas asignadas en el calendario publicado.
          </div>
        )}
      </motion.div>

      {/* Full upcoming assignments table */}
      {myUpcoming.length > 0 && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h3 className="font-serif text-lg text-primary">Tus próximas funciones</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">{myUpcoming.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Misa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Función</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from(grouped.entries()).map(([date, entries]) =>
                  entries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={cn(
                        "hover:bg-primary/5 transition-colors",
                        entry.date === today && "bg-accent/10"
                      )}
                    >
                      {idx === 0 && (
                        <td className="px-4 py-3 font-medium whitespace-nowrap" rowSpan={entries.length}>
                          <div className="font-serif text-primary">{formatDate(date)}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {format(new Date(date + "T12:00:00"), "EEEE", { locale: es })}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-muted-foreground">{parseSchedulePart(entry.role)}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-primary">{parseRolePart(entry.role)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-amber-700 italic">
                        {entry.logisticComment || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past assignments (collapsed) */}
      {myPast.length > 0 && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Has realizado <strong>{myPast.length + myUpcoming.length - 1}</strong> lecturas en el historial registrado.
          </p>
        </div>
      )}

      {/* Unavailability calendar toggle */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full px-5 py-4 flex items-center gap-2 text-left hover:bg-muted/20 transition-colors"
        >
          <CalendarIcon className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Mis días no disponibles</span>
            <p className="text-xs text-muted-foreground mt-0.5">Marca días en los que no podrás asistir</p>
          </div>
          <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform", showCalendar && "rotate-90")} />
        </button>
        <AnimatePresence>
          {showCalendar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 border-t border-border pt-4">
                <UnavailCalendar selectedReaderId={readerId} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Phase 1: Pre-publication view ───────────────────────────────────────────

function PrePublicationView({ readerId, readerName }: { readerId: number; readerName: string }) {
  return (
    <div className="space-y-6">
      {/* Status message */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-primary/15 shadow-sm p-6 text-center"
      >
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>
        <h3 className="text-xl font-serif text-primary mb-2">Hola, {readerName}</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          El calendario aún no ha sido publicado. El administrador lo publicará cuando esté listo.
          Mientras tanto, puedes marcar los días en que <strong>no</strong> estarás disponible.
        </p>
      </motion.div>

      {/* Unavailability calendar */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <h3 className="font-serif text-lg text-primary flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5 text-destructive" />
          Mis días no disponibles
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          Toca los días en que <strong>NO</strong> podrás asistir a ninguna misa. El administrador lo tomará en cuenta al generar el calendario.
        </p>
        <UnavailCalendar selectedReaderId={readerId} />
      </div>
    </div>
  );
}

// ─── Main Reader Portal ───────────────────────────────────────────────────────

export default function ReaderPortal() {
  const { data: readers = [], isLoading: loadingReaders } = useReaders();
  const [selectedReaderId, setSelectedReaderId] = useState<number | null>(null);
  const { data: publishedCalendar = [] } = useCalendar({ publishedOnly: true });

  const selectedReader = readers.find(r => r.id === selectedReaderId);

  // Check if there are ANY published entries for this reader
  const hasPublishedAssignments = selectedReaderId
    ? publishedCalendar.some(c => c.readerId === selectedReaderId)
    : false;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <UserCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-serif text-primary">Portal del Lector</h1>
        <p className="text-muted-foreground text-sm">
          Selecciona tu nombre para ver tus asignaciones y gestionar tu disponibilidad.
        </p>
      </div>

      {/* Reader selector */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
        <label className="block text-sm font-medium mb-2">Mi Nombre</label>
        {loadingReaders ? (
          <div className="h-14 bg-muted rounded-xl animate-pulse" />
        ) : (
          <select
            className="flex h-14 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-4 text-lg font-medium text-primary focus-visible:outline-none focus-visible:border-primary transition-colors"
            value={selectedReaderId ?? ""}
            onChange={e => setSelectedReaderId(Number(e.target.value) || null)}
          >
            <option value="">-- Selecciona tu nombre --</option>
            {readers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        {selectedReader && (
          <p className="mt-3 text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-primary">{selectedReader.name}</span>
            <span className="ml-1 text-xs">· {selectedReader.level}</span>
          </p>
        )}
      </div>

      {/* Two-phase content */}
      <AnimatePresence mode="wait">
        {selectedReaderId && selectedReader && (
          <motion.div
            key={selectedReaderId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {hasPublishedAssignments ? (
              <AssignmentsView
                readerId={selectedReaderId}
                readerName={selectedReader.name}
                readerLevel={selectedReader.level}
              />
            ) : (
              <PrePublicationView
                readerId={selectedReaderId}
                readerName={selectedReader.name}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
