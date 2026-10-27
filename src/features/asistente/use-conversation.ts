import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Cursor, flattenPages, listMessages } from "@/features/asistente/message-service";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

/** La clave lleva al autor: la caché no se limpia al cerrar sesión y la conversación es privada. */
export const conversationQueryKey = (veterinarianId: string | null) =>
  ["asistente", "mensajes", veterinarianId] as const;

/**
 * Conversación persistida del autor: los últimos 50 mensajes y «Cargar anteriores» (3.2). La lista
 * `messages` es cronológica; anclar la posición al cargar anteriores es de la lista (4.4).
 */
export function useConversation() {
  const veterinarianId = useSessionStore((state) => state.veterinarianId);
  const query = useInfiniteQuery({
    enabled: veterinarianId !== null,
    // Un refetch al volver a la ventana podría pisar un mensaje recién persistido (`setQueryData`).
    refetchOnWindowFocus: false,
    queryKey: conversationQueryKey(veterinarianId),
    initialPageParam: undefined as Cursor | undefined,
    queryFn: ({ pageParam }) => listMessages(supabase, pageParam),
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const messages = useMemo(() => flattenPages(query.data?.pages ?? []), [query.data]);
  return {
    messages,
    isLoading: query.isLoading,
    error: query.error,
    hasOlder: query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: () => query.fetchNextPage(),
  };
}
