import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/** Resolves who an attribution names; readable for peers of the same clinic (T056). */
export function useVeterinarianDisplayName(veterinarianId: string) {
  return useQuery({
    queryKey: ["veterinarian-display-name", veterinarianId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veterinarians")
        .select("display_name")
        .eq("id", veterinarianId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data?.display_name ?? null;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}
