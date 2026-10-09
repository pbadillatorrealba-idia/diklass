import { z } from "zod";

/**
 * Nombre visible del profesional (FR-095): mismas reglas que `update_own_profile` (014), que
 * sigue mandando. Se colapsan los espacios antes de medir, como el servidor.
 */
export const displayNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres.")
      .max(80, "El nombre admite hasta 80 caracteres."),
  );
