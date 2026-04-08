import React, { useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, addMonths, subMonths, getDay
} from "date-fns";
import { es } from "date-fns/locale";
import { useReaders, useUnavailability, useUnavailabilityMutations, useCalendar } from "@/hooks/use-liturgia";
import { cn, formatDate } from "@/lib/utils";
import { Calendar as CalendarIcon, UserCircle, AlertCircle, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";

function parseRolePart(roleStr: string): string {
  return roleStr.split(" - ")[0];
}
function parseSchedulePart(roleStr: string): string {
  const parts = roleStr.split(" - ");
  return parts.slice(1).join(" - ");
}

export default function ReaderPortal() {
  const { data: readers = [], isLoading: loadingReaders } = useReaders();
  const [selectedReaderId, setSelectedReaderId] = useState<number | null>(null);

  const { data: unavailabilities = [], isLoading: loadingUnavail } = useUnavailability(selectedReaderId || undefined);
  const { block, unblock } = useUnavailabilityMutations();
  const { data: calendar = [] } = useCalendar();

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the calendar grid: start on Monday
  const firstDow = getDay(monthStart); // 0=Sun
  const emptyCells = firstDow === 0 ? 6 : firstDow - 1;

  const toggleDate = (date: Date) => {
    if (!selectedReaderId) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = unavailabilities.find(u => u.blockedDate === dateStr);
    if (existing) {
      unblock.mutate({ id: existing.id });
    } else {
      block.mutate({ data: { readerId: selectedReaderId, blockedDate: dateStr } });
    }
  };

  const myAssignments = calendar
    .filter(c => c.readerId === selectedReaderId && c.date >= format(today, "yyyy-MM-dd"))
    .sort((a, b) => a.date.localeCompare(b.date));

  const selectedReader = readers.find(r => r.id === selectedReaderId);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <UserCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-serif text-primary">Portal del Lector</h1>
        <p className="text-muted-foreground text-sm">
          Selecciona tu nombre para gestionar tu disponibilidad y ver tus próximas asignaciones.
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
            Bienvenido, <span className="font-semibold text-primary">{selectedReader.name}</span>
            <span className="ml-1 text-xs">({selectedReader.level})</span>
          </p>
        )}
      </div>

      {selectedReaderId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Availability Calendar */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-serif mb-1 flex items-center gap-2">
              <CalendarIcon className="text-destructive w-5 h-5" />
              Marcar Indisponibilidad
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Toca los días en que <strong>NO</strong> podrás asistir. El algoritmo los ignorará al generar asignaciones.
            </p>

            {/* Month navigation */}
            <div className="flex justify-between items-center mb-4">
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
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
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
                const isPast = day < new Date(today.setHours(0, 0, 0, 0));
                const isAssigned = calendar.some(c => c.readerId === selectedReaderId && c.date === dateStr);

                return (
                  <button
                    key={dateStr}
                    disabled={isPast || loadingUnavail}
                    onClick={() => toggleDate(day)}
                    title={isAssigned ? "Ya tienes asignación este día" : undefined}
                    className={cn(
                      "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 relative",
                      isPast ? "opacity-25 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer",
                      isBlocked ? "bg-destructive text-white shadow-md shadow-destructive/30" :
                        isAssigned ? "bg-primary/20 text-primary border-2 border-primary/40" :
                          isToday(day) ? "border-2 border-accent text-primary font-bold" :
                            "bg-muted/40 hover:bg-muted text-foreground"
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
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive inline-block" /> No disponible</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-primary/40 bg-primary/20 inline-block" /> Asignado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-accent inline-block" /> Hoy</span>
            </div>
          </div>

          {/* My upcoming assignments */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-serif mb-4">Mis Próximas Asignaciones</h2>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {myAssignments.length > 0 ? (
                myAssignments.map(assignment => (
                  <div key={assignment.id} className="p-4 rounded-xl border border-border bg-primary/5 hover:bg-primary/10 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-primary text-sm">{formatDate(assignment.date)}</span>
                      {assignment.isVacant && (
                        <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold">⚠ Pendiente</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{parseSchedulePart(assignment.role)}</p>
                    <p className="font-medium mt-1">{parseRolePart(assignment.role)}</p>
                    {assignment.logisticComment && (
                      <p className="text-sm text-amber-700 italic flex items-center gap-1 mt-2 bg-amber-50 rounded-lg px-2 py-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {assignment.logisticComment}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No tienes asignaciones próximas.</p>
                  <p className="text-xs mt-1">El administrador generará el calendario próximamente.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
