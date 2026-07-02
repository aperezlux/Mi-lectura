<<<<<<< HEAD
﻿import React, { useState, useEffect } from "react";
=======
﻿import React, { useState } from "react";
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, addMonths, subMonths, getDay
} from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useReaders, useUnavailability, useUnavailabilityMutations, useCalendar } from "@/hooks/use-liturgia";
import { cn, formatDate, ensureArray } from "@/lib/utils";
import {
  Calendar as CalendarIcon, UserCircle, AlertCircle,
  ChevronLeft, ChevronRight, CheckCircle, Clock,
  BookOpen, Star, CalendarDays, Sun, Moon, X, KeyRound, LogOut
} from "lucide-react";
import { useVerifyReaderPin } from "@/hooks/use-liturgia";
import type { CalendarEntry } from "@workspace/api-client-react";

type Shift = "morning" | "evening" | "all";

function parseRolePart(roleStr: string): string {
  return roleStr.split(" - ")[0];
}
function parseSchedulePart(roleStr: string): string {
  const parts = roleStr.split(" - ");
  return parts.slice(1).join(" - ");
}

// Days that need shift selection (Thursday=4, Saturday=6, Sunday=0)
function needsShiftPicker(date: Date): boolean {
  const dow = getDay(date);
  return dow === 0 || dow === 4 || dow === 6;
}

// ─── Shift Picker Overlay ────────────────────────────────────────────────────

function ShiftPicker({
  dateLabel,
  onSelect,
  onCancel,
}: {
  dateLabel: string;
  onSelect: (shift: Shift) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="relative z-10 bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm mx-0 sm:mx-4 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-lg text-primary">¿Cuándo no podrás ir?</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-5 capitalize">{dateLabel}</p>

        <div className="space-y-3">
          <button
            onClick={() => onSelect("morning")}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <Sun className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">Solo Mañana</p>
              <p className="text-xs text-amber-700 mt-0.5">No puedo en la misa de mañana, sí en la de la noche</p>
            </div>
          </button>

          <button
            onClick={() => onSelect("evening")}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Moon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-indigo-900">Solo Tarde/Noche</p>
              <p className="text-xs text-indigo-700 mt-0.5">No puedo en la misa de la tarde, sí en la de mañana</p>
            </div>
          </button>

          <button
            onClick={() => onSelect("all")}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-400 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <CalendarIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-900">Todo el día</p>
              <p className="text-xs text-red-700 mt-0.5">No puedo en ninguna misa de este día</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Unavailability Calendar (shared) ────────────────────────────────────────

interface UnavailCalendarProps {
  selectedReaderId: number;
}

function UnavailCalendar({ selectedReaderId }: UnavailCalendarProps) {
  const today = new Date();
  const { data: unavailabilities = [], isLoading: loadingUnavail } = useUnavailability(selectedReaderId);
  const { data: calendar = [] } = useCalendar({ publishedOnly: true });
  const { block, unblock } = useUnavailabilityMutations();

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [pickerState, setPickerState] = useState<{ dateStr: string; label: string } | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDow = getDay(monthStart);
  const emptyCells = firstDow === 0 ? 6 : firstDow - 1;

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const existing = Array.isArray(unavailabilities) ? unavailabilities.find(u => u.blockedDate === dateStr) : undefined;

    if (existing) {
      // Always unblock on click if already blocked
      unblock.mutate({ id: existing.id });
      return;
    }

    if (needsShiftPicker(day)) {
      // Thu/Sat/Sun: show shift picker
      setPickerState({
        dateStr,
        label: format(day, "EEEE, d 'de' MMMM", { locale: es }),
      });
    } else {
      // Weekday: always full day
      block.mutate({ data: { readerId: selectedReaderId, blockedDate: dateStr, shift: "all" } });
    }
  };

  const handleShiftSelect = (shift: Shift) => {
    if (!pickerState) return;
    block.mutate({ data: { readerId: selectedReaderId, blockedDate: pickerState.dateStr, shift } });
    setPickerState(null);
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {pickerState && (
          <ShiftPicker
            dateLabel={pickerState.label}
            onSelect={handleShiftSelect}
            onCancel={() => setPickerState(null)}
          />
        )}
      </AnimatePresence>

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
          const unavail = Array.isArray(unavailabilities) ? unavailabilities.find(u => u.blockedDate === dateStr) : undefined;
          const shift = (unavail?.shift ?? null) as Shift | null;
          const isBlocked = !!unavail;
          const isPartial = isBlocked && shift !== "all";
          const isTotalBlocked = isBlocked && shift === "all";
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
          const isAssigned = ensureArray<CalendarEntry>(calendar)
            .some(c => c.readerId === selectedReaderId && c.date === dateStr);
          const hasShiftPicker = needsShiftPicker(day);

          return (
            <button
              key={dateStr}
              disabled={isPast || loadingUnavail}
              onClick={() => handleDayClick(day)}
              title={
                isPartial
                  ? shift === "morning" ? "Solo Mañana bloqueada — clic para desbloquear" : "Solo Tarde/Noche bloqueada — clic para desbloquear"
                  : isTotalBlocked ? "Todo el día bloqueado — clic para desbloquear"
                  : hasShiftPicker ? "Toca para seleccionar el turno"
                  : "Toca para bloquear este día"
              }
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 relative",
                isPast ? "opacity-25 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer",
                isTotalBlocked
                  ? "bg-destructive text-white shadow-md shadow-destructive/30"
                  : isPartial && shift === "morning"
                  ? "bg-amber-400 text-white shadow-md shadow-amber-400/30"
                  : isPartial && shift === "evening"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                  : isAssigned
                  ? "bg-primary/20 text-primary border-2 border-primary/40"
                  : isToday(day)
                  ? "border-2 border-accent text-primary font-bold"
                  : "bg-muted/40 hover:bg-muted text-foreground"
              )}
            >
              <span className="leading-none">{format(day, "d")}</span>
              {isPartial && (
                <span className="text-[8px] leading-none mt-0.5 opacity-90 font-semibold">
                  {shift === "morning" ? "☀" : "🌙"}
                </span>
              )}
              {isAssigned && !isBlocked && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-destructive inline-block" />
          No disponible (todo el día)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
          Solo mañana
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
          Solo tarde/noche
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-primary/40 bg-primary/20 inline-block" />
          Asignado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-accent inline-block" />
          Hoy
        </span>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Jueves, Sábados y Domingos: podrás elegir si bloqueas solo la mañana, solo la tarde o todo el día.
      </p>
    </div>
  );
}

// ─── Phase 2: Assignments View ────────────────────────────────────────────────

interface AssignmentsViewProps {
  readerId: number;
  readerName: string;
  readerLevel: string;
<<<<<<< HEAD
  availabilityVisible: boolean;
}

function AssignmentsView({ readerId, readerName, readerLevel, availabilityVisible }: AssignmentsViewProps) {
=======
}

function AssignmentsView({ readerId, readerName, readerLevel }: AssignmentsViewProps) {
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: calendar = [] } = useCalendar({ publishedOnly: true });
  const [showCalendar, setShowCalendar] = useState(false);

  const safeCalendar = ensureArray<CalendarEntry>(calendar);

  const myUpcoming = safeCalendar
    .filter(c => c.readerId === readerId && c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const myPast = safeCalendar
    .filter(c => c.readerId === readerId && c.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const nextAssignment = myUpcoming[0];

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
          <div className="px-6 py-8 text-muted-foreground text-sm text-center">
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

      {myPast.length > 0 && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Has realizado <strong>{myPast.length + myUpcoming.length - 1}</strong> lecturas en el historial registrado.
          </p>
        </div>
      )}

      {/* Unavailability calendar toggle */}
<<<<<<< HEAD
      {availabilityVisible && (
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
      )}
=======
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
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
    </div>
  );
}

// ─── Phase 1: Pre-publication view ───────────────────────────────────────────

<<<<<<< HEAD
function PrePublicationView({ readerId, readerName, availabilityVisible }: { readerId: number; readerName: string; availabilityVisible: boolean }) {
=======
function PrePublicationView({ readerId, readerName }: { readerId: number; readerName: string }) {
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
  return (
    <div className="space-y-6">
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

<<<<<<< HEAD
      {availabilityVisible && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h3 className="font-serif text-lg text-primary flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-destructive" />
            Mis días no disponibles
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            Toca los días en que <strong>NO</strong> podrás asistir. El administrador lo tomará en cuenta al generar el calendario.
          </p>
          <UnavailCalendar selectedReaderId={readerId} />
        </div>
      )}
=======
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <h3 className="font-serif text-lg text-primary flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5 text-destructive" />
          Mis días no disponibles
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          Toca los días en que <strong>NO</strong> podrás asistir. El administrador lo tomará en cuenta al generar el calendario.
        </p>
        <UnavailCalendar selectedReaderId={readerId} />
      </div>
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
    </div>
  );
}

// ─── Main Reader Portal ───────────────────────────────────────────────────────

export default function ReaderPortal() {
  const { data: readers = [], isLoading: loadingReaders } = useReaders();
  const [selectedReaderId, setSelectedReaderId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState("");
<<<<<<< HEAD
  const [availabilityVisible, setAvailabilityVisible] = useState(true);
=======
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
  const { data: publishedCalendar = [] } = useCalendar({ publishedOnly: true });
  const verifyPin = useVerifyReaderPin();

  const selectedReader = Array.isArray(readers)
  ? readers.find(r => r.id === selectedReaderId)
  : null;
  const needsPin = !!(selectedReader as any)?.hasPin;

  const handleSelectReader = (id: number | null) => {
    setSelectedReaderId(id);
    setPin("");
    setPinError("");
    setAuthenticated(false);
    verifyPin.reset();
  };

<<<<<<< HEAD
  useEffect(() => {
    const loadAvailabilityVisibility = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) return;
        const data = await response.json();
        const visible = data?.appSettings?.reader_availability_visible !== "false";
        setAvailabilityVisible(visible);
      } catch (err) {
        console.error(err);
      }
    };

    void loadAvailabilityVisibility();
  }, []);

=======
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
  const handleVerifyPin = () => {
    if (!selectedReaderId || !pin.trim()) return;
    setPinError("");
    verifyPin.mutate(
      { data: { readerId: selectedReaderId, pin: pin.trim() } },
      {
        onSuccess: () => setAuthenticated(true),
        onError: () => setPinError("PIN incorrecto. Inténtalo de nuevo."),
      }
    );
  };

  const showPinEntry = !!selectedReaderId && !!selectedReader && needsPin && !authenticated;
  const showContent = !!selectedReaderId && !!selectedReader && (authenticated || !needsPin);

  const hasPublishedAssignments = selectedReaderId
    ? ensureArray<CalendarEntry>(publishedCalendar).some(c => c.readerId === selectedReaderId)
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

      {/* Step 1: Reader selection (hide when PIN entry or content is active) */}
      <AnimatePresence mode="wait">
        {!showPinEntry && !showContent && (
          <motion.div
            key="selector"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white p-6 rounded-2xl border border-border shadow-sm"
          >
            <label className="block text-sm font-medium mb-2">Mi Nombre</label>
            {loadingReaders ? (
              <div className="h-14 bg-muted rounded-xl animate-pulse" />
            ) : (
              <select
                className="flex h-14 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-4 text-lg font-medium text-primary focus-visible:outline-none focus-visible:border-primary transition-colors"
                value={selectedReaderId ?? ""}
                onChange={e => handleSelectReader(Number(e.target.value) || null)}
              >
                <option value="">-- Selecciona tu nombre --</option>
                {readers.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}{(r as any).hasPin ? " 🔑" : ""}
                  </option>
                ))}
              </select>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2: PIN entry */}
      <AnimatePresence mode="wait">
        {showPinEntry && (
          <motion.div
            key="pin-entry"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white rounded-2xl border border-border shadow-lg overflow-hidden"
          >
            {/* Header strip */}
            <div className="bg-primary/5 border-b border-primary/10 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary text-sm" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {selectedReader?.name}
                </p>
                <p className="text-xs text-muted-foreground">Ingresa tu PIN personal para continuar</p>
              </div>
              <button
                onClick={() => handleSelectReader(null)}
                className="ml-auto p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Cambiar nombre"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <input
                type="password"
                value={pin}
                onChange={e => { setPin(e.target.value); setPinError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleVerifyPin(); }}
                placeholder="Tu PIN personal"
                autoFocus
                className="flex h-14 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-5 text-xl text-center tracking-[0.4em] font-semibold text-primary focus-visible:outline-none focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:tracking-normal placeholder:text-base placeholder:font-normal"
              />

              {pinError && (
                <motion.p
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-destructive text-sm text-center flex items-center justify-center gap-1.5"
                >
                  <AlertCircle className="w-4 h-4" /> {pinError}
                </motion.p>
              )}

              <button
                onClick={handleVerifyPin}
                disabled={!pin.trim() || verifyPin.isPending}
                className="w-full h-12 bg-primary text-white rounded-xl font-semibold text-base hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-primary/20"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {verifyPin.isPending ? "Verificando…" : "Entrar"}
              </button>

              <button
                onClick={() => handleSelectReader(null)}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors py-1"
              >
                ← Cambiar nombre
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3: Portal content */}
      <AnimatePresence mode="wait">
        {showContent && (
          <motion.div
            key={selectedReaderId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {/* Session bar */}
            <div className="flex items-center justify-between bg-white/80 border border-primary/15 rounded-2xl px-4 py-2.5 mb-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-primary" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {selectedReader?.name}
                </span>
                <span className="text-muted-foreground text-xs">· {selectedReader?.level}</span>
                {needsPin && (
                  <span className="flex items-center gap-0.5 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                    <KeyRound className="w-2.5 h-2.5" /> Verificado
                  </span>
                )}
              </div>
              <button
                onClick={() => handleSelectReader(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Salir
              </button>
            </div>

            {hasPublishedAssignments ? (
              <AssignmentsView
                readerId={selectedReaderId!}
                readerName={selectedReader!.name}
                readerLevel={selectedReader!.level}
<<<<<<< HEAD
                availabilityVisible={availabilityVisible}
=======
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
              />
            ) : (
              <PrePublicationView
                readerId={selectedReaderId!}
                readerName={selectedReader!.name}
<<<<<<< HEAD
                availabilityVisible={availabilityVisible}
=======
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
