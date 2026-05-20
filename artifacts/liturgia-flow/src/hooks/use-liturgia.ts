import { useQueryClient } from "@tanstack/react-query";
import {
  useGetReaders,
  useCreateReader,
  useUpdateReader,
  useDeleteReader,
  useVerifyReaderPin,
  useGetCalendar,
  useGenerateCalendar,
  useUpdateCalendarEntry,
  useSwapCalendarEntries,
  usePublishCalendar,
  useGetCalendarStats,
  useGetUnavailability,
  useCreateUnavailability,
  useDeleteUnavailability,
  useGetSchedules,
  useUpdateSchedule,
  type Reader,
  type CalendarEntry,
  type ReaderStat,
  type Unavailability,
  type MassSchedule,
} from "@workspace/api-client-react";
import { ensureArray } from "@/lib/utils";
import { useToast } from "./use-toast";

export { useVerifyReaderPin };

export function useReaders() {
  const query = useGetReaders();
  return { ...query, data: ensureArray<Reader>(query.data) };
}

export function useReaderMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateReader({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/readers"] });
        toast({ title: "Lector creado", description: "El lector ha sido registrado exitosamente." });
      },
      onError: () => toast({ title: "Error", description: "No se pudo crear el lector.", variant: "destructive" })
    }
  });

  const update = useUpdateReader({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/readers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
        toast({ title: "Lector actualizado", description: "Los datos han sido guardados." });
      },
      onError: () => toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" })
    }
  });

  const remove = useDeleteReader({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/readers"] });
        toast({ title: "Lector eliminado", description: "El registro ha sido borrado." });
      },
      onError: () => toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" })
    }
  });

  return { create, update, remove };
}

export function useCalendar(params?: { startDate?: string; endDate?: string; publishedOnly?: boolean }) {
  const query = useGetCalendar(params);
  return { ...query, data: ensureArray<CalendarEntry>(query.data) };
}

export function useCalendarStats() {
  const query = useGetCalendarStats();
  return { ...query, data: ensureArray<ReaderStat>(query.data) };
}

export function useCalendarMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const generate = useGenerateCalendar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/stats"] });
        toast({ title: "Calendario generado (borrador)", description: "Revisa el calendario y pulsa 'Publicar' cuando esté listo." });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? err?.data?.error ?? "No se pudo generar el calendario.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    }
  });

  const updateEntry = useUpdateCalendarEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/stats"] });
        toast({ title: "Asignación actualizada", description: "El cambio ha sido guardado." });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? err?.data?.error ?? "No se pudo actualizar la asignación.";
        toast({ title: "Conflicto detectado", description: msg, variant: "destructive" });
      }
    }
  });

  const swap = useSwapCalendarEntries({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
        toast({ title: "Intercambio realizado", description: "Las asignaciones han sido intercambiadas." });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? err?.data?.error ?? "No se pudo realizar el intercambio.";
        toast({ title: "Conflicto detectado", description: msg, variant: "destructive" });
      }
    }
  });

  const publish = usePublishCalendar({
    mutation: {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
        toast({
          title: "¡Calendario publicado!",
          description: `${data?.published ?? "Todas las"} asignaciones ahora son visibles para los lectores.`,
        });
      },
      onError: () => toast({ title: "Error", description: "No se pudo publicar el calendario.", variant: "destructive" })
    }
  });

  return { generate, updateEntry, swap, publish };
}

export function useUnavailability(readerId?: number) {
  const query = useGetUnavailability({ readerId });
  return { ...query, data: ensureArray<Unavailability>(query.data) };
}

export function useUnavailabilityMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const block = useCreateUnavailability({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/unavailability"] });
      },
      onError: () => toast({ title: "Error", description: "No se pudo bloquear la fecha.", variant: "destructive" })
    }
  });

  const unblock = useDeleteUnavailability({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/unavailability"] });
      },
      onError: () => toast({ title: "Error", description: "No se pudo desbloquear la fecha.", variant: "destructive" })
    }
  });

  return { block, unblock };
}

export function useSchedules() {
  const query = useGetSchedules();
  return { ...query, data: ensureArray<MassSchedule>(query.data) };
}

export function useScheduleMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const update = useUpdateSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
        toast({ title: "Horario actualizado", description: "El cambio se reflejará en el próximo calendario generado." });
      },
      onError: () => toast({ title: "Error", description: "No se pudo actualizar el horario.", variant: "destructive" })
    }
  });

  return { update };
}
