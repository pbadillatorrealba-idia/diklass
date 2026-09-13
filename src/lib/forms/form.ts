import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export function validateWithSchema<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  return result.success
    ? { value: result.data, errors: {} }
    : { value: null, errors: result.error };
}
