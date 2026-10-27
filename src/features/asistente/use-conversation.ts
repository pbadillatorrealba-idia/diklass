import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Cursor, flattenPages, listMessages } from "@/features/asistente/message-service";
import { supabase } from "@/lib/supabase/client";

export const CONVERSATION_QUERY_KEY = ["asistente", "mensajes"] as const;

/**
 * Conversación persistida del autor: los últimos 50 mensajes y «Cargar anteriores» (3.2). La lista
 * `messages` es cronológica; anclar la posición al cargar anteriores es de la lista (4.4).
 */
export function useConversation() {
  const query = useInfiniteQuery({
    queryKey: CONVERSATION_QUERY_KEY,
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
