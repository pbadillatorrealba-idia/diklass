import type { GuiónConversación } from "@/features/voz/transcription-port";

/**
 * Guion sintético de demostración del modo de escucha (D2 · D3 del diseño; datos sintéticos,
 * nunca grabaciones reales). Lo consume `SimulatedTranscriptionAdapter` por defecto en la app;
 * el ground truth con etiquetas de SC-004/SC-016 vive aparte, en
 * `tests/fixtures/voz/conversacion-referencia.json`.
 */
export const guionDemo: GuiónConversación = {
  guion: [
    {
      seq: 0,
      calidad: "ok",
      transcripcion:
        "Buenos días doctora. El problema es que Rocky destroza el sofá cuando se queda solo en casa. Empezó hace tres meses. Ah, y ladra todos los días sin parar.",
    },
    {
      seq: 1,
      calidad: "ok",
      transcripcion:
        "Al principio era solo de noche, no, perdón, en realidad es de día cuando salgo a trabajar.",
    },
    { seq: 2, calidad: "insufficient", transcripcion: "… (ruido ambiente inaudible) …" },
    {
      seq: 3,
      calidad: "ok",
      transcripcion:
        "Mi gata Mishu también maúlla de noche, aunque ella no destroza nada. Vive en un departamento pequeño con patio.",
    },
    {
      seq: 4,
      calidad: "ok",
      transcripcion:
        "Le pica mucho la piel. El año pasado tuvo dermatitis atópica y le dimos prednisona, con eso mejoró bastante.",
    },
    {
      seq: 5,
      calidad: "ok",
      transcripcion:
        "Come croquetas dos veces al día. Lo saco a pasear todas las mañanas. Hace poco nació mi bebé y desde que nació todo cambió.",
    },
    {
      seq: 6,
      calidad: "ok",
      transcripcion:
        "Probamos fluoxetina el mes pasado y no hubo mejoría. Ahora ya no toma fluoxetina, la suspendimos.",
    },
  ],
};
