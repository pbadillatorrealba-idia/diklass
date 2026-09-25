import type {
  Adherence,
  AdverseEventSeverity,
  Evolution,
} from "@/features/retroalimentacion/schema";

/**
 * Etiquetas de interfaz de la retroalimentación clínica. Vocabulario visible en español; los
 * valores que viajan al contenido siguen siendo los identificadores canónicos del modelo (D2).
 */

export const ADHERENCE_LABELS: Record<Adherence, string> = {
  completa: "Completa",
  parcial: "Parcial",
  ninguna: "Ninguna",
  desconocida: "Desconocida",
};

export const EVOLUTION_LABELS: Record<Evolution, string> = {
  mejoria: "Mejoría",
  mejoriaParcial: "Mejoría parcial",
  sinCambios: "Sin cambios",
  empeoramiento: "Empeoramiento",
  desconocida: "Desconocida",
};

export const ADVERSE_EVENT_SEVERITY_LABELS: Record<AdverseEventSeverity, string> = {
  leve: "Leve",
  moderado: "Moderado",
  grave: "Grave",
};
