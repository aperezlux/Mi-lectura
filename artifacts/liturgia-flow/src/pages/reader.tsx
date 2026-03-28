import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useReaders, useUnavailability, useUnavailabilityMutations, useCalendar } from "@/hooks/use-liturgia";
import { cn, formatDate } from "@/lib/utils";
import { Calendar as CalendarIcon, UserCircle, AlertCircle } from "lucide-react";

export default function ReaderPortal() {
  const { data: readers = [], isLoading: loadingReaders } = useReaders();
  const [selectedReaderId, setSelectedReaderId] = useState<number | null>(null);

  const { data: unavailabilities = [], isLoading: loadingUnavail } = useUnavailability(selectedReaderId || undefined);
  const { block, unblock } = useUnavailabilityMutations();
  const { data: calendar = [] } = useCalendar(); // Can be optimized with specific reader endpoint later

  // Simple Month Calendar logic
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const toggleDate = (date: Date) => {
    if (!selectedReaderId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check if it's already blocked
    const existing = unavailabilities.find(u => u.blockedDate === dateStr);
    
    if (existing) {
      unblock.mutate({ id: existing.id });
    } else {
      block.mutate({ data: { readerId: selectedReaderId, blockedDate: dateStr } });
    }
  };

  const myAssignments = calendar
    .filter(c => c.readerId === selectedReaderId)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-display text-primary">Portal del Lector</h1>
        <p className="text-muted-foreground">Selecciona tu nombre para gestionar tu disponibilidad y ver tus asignaciones.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-border shadow-lg shadow-primary/5">
        <label className="block text-sm font-medium mb-2">Mi Nombre</label>
        {loadingReaders ? (
          <div className="h-12 bg-muted rounded-xl animate-pulse"></div>
        ) : (
          <select 
            className="flex h-14 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-4 text-lg font-medium text-primary focus-visible:outline-none focus-visible:border-primary transition-colors"
            value={selectedReaderId || ""}
            onChange={e => setSelectedReaderId(Number(e.target.value))}
          >
            <option value="" disabled>-- Selecciona tu nombre --</option>
            {readers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </div>

      {selectedReaderId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Availability Calendar */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-display mb-4 flex items-center gap-2">
              <CalendarIcon className="text-destructive w-5 h-5" />
              Marcar Fechas No Disponibles
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Toca los días que <b>NO</b> podrás asistir. Los días marcados en rojo serán ignorados por el algoritmo al generar el calendario.</p>
            
            <div className="mb-4 flex justify-between items-center">
              <span className="font-semibold text-lg capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</span>
              {/* Pagination could go here if needed, keeping simple for now */}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d, i) => (
                <div key={i} className="text-xs font-bold text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {/* Padding for first day */}
              {Array.from({ length: currentMonth.getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
              
              {daysInMonth.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isBlocked = unavailabilities.some(u => u.blockedDate === dateStr);
                const isPast = day < new Date(today.setHours(0,0,0,0));

                return (
                  <button
                    key={dateStr}
                    disabled={isPast || loadingUnavail}
                    onClick={() => toggleDate(day)}
                    className={cn(
                      "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200",
                      isPast ? "opacity-30 cursor-not-allowed" : "hover:scale-105 active:scale-95",
                      isBlocked ? "bg-destructive text-white shadow-md shadow-destructive/30" : 
                      isToday(day) ? "border-2 border-primary text-primary" : "bg-muted/50 hover:bg-muted text-foreground"
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignments List */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-display mb-4">Mis Próximas Asignaciones</h2>
            
            <div className="space-y-3">
              {myAssignments.length > 0 ? (
                myAssignments.map(assignment => (
                  <div key={assignment.id} className="p-4 rounded-xl border border-border bg-primary/5 flex flex-col gap-1">
                    <span className="font-semibold text-primary">{formatDate(assignment.date)}</span>
                    <span className="text-foreground">{assignment.role}</span>
                    {assignment.logisticComment && (
                      <span className="text-sm text-muted-foreground italic flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" /> {assignment.logisticComment}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                  No tienes asignaciones futuras.
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
