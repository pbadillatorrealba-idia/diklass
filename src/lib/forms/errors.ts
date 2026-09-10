import type { z } from "zod";

export function getFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "form", issue.message]),
  );
}
