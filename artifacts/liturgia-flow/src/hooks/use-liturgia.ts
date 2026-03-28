import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetReaders, 
  useCreateReader, 
  useUpdateReader, 
  useDeleteReader,
  useGetCalendar,
  useGenerateCalendar,
  useUpdateCalendarEntry,
  useGetUnavailability,
  useCreateUnavailability,
  useDeleteUnavailability
} from "@workspace/api-client-react";
import { useToast } from "./use-toast";

// Wrappers around generated hooks to add cache invalidation and toast notifications

export function useReaders() {
  return useGetReaders();
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

export function useCalendar(startDate?: string, endDate?: string) {
  return useGetCalendar({ startDate, endDate });
}

export function useCalendarMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const generate = useGenerateCalendar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
        toast({ title: "Calendario generado", description: "Las asignaciones han sido creadas." });
      },
      onError: () => toast({ title: "Error", description: "No se pudo generar el calendario.", variant: "destructive" })
    }
  });

  const updateEntry = useUpdateCalendarEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
        toast({ title: "Asignación actualizada", description: "El cambio ha sido guardado." });
      },
      onError: () => toast({ title: "Error", description: "No se pudo actualizar la asignación.", variant: "destructive" })
    }
  });

  return { generate, updateEntry };
}

export function useUnavailability(readerId?: number) {
  return useGetUnavailability({ readerId });
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
