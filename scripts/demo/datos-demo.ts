import type { ReproductiveStatus, Sex, Species } from "@/features/registro/catalogs";
import {
  type AnamnesisField,
  type ConsultationPlanInput,
  type PatientContent,
  type Provenance,
  patientContentSchema,
  type TutorContent,
} from "@/features/registro/schema";
import type { FeedbackContent } from "@/features/retroalimentacion/schema";
import { rutCheckDigit } from "@/lib/rut";

/** Elenco editorial inventado; contactos de prueba sin notificaciones ni verificación externa. */
export type TutorDemo = TutorContent & { key: string };
const rut = (n: number) => {
  const body = String(5_000_000 + n);
  return `${body}-${rutCheckDigit(body)}`;
};

const tutor = (
  n: number,
  name: string,
  surname: string,
  contact: { phone?: string; email?: string },
  address: string,
  city: string,
  postalCode: string,
): TutorDemo => ({
  key: `T${String(n).padStart(2, "0")}`,
  name,
  surname,
  rut: rut(n),
  phone: contact.phone ?? null,
  email: contact.email ?? null,
  address,
  city,
  postalCode,
});

export const TUTORES_DEMO: TutorDemo[] = [
  tutor(
    1,
    "Camila",
    "Muñoz Rojas",
    { phone: "+56 9 5550 0101", email: "camila.munoz@example.test" },
    "Av. Irarrázaval 2345, depto. 304",
    "Ñuñoa",
    "7750000",
  ),
  tutor(
    2,
    "Matías",
    "González Soto",
    { phone: "+56 9 5550 0102" },
    "Los Leones 1180",
    "Providencia",
    "7500000",
  ),
  tutor(
    3,
    "Francisca",
    "Contreras Díaz",
    { email: "francisca.contreras@example.test" },
    "Camino El Alba 9870",
    "Las Condes",
    "7550000",
  ),
  tutor(
    4,
    "Sebastián",
    "Pérez Fuentes",
    { phone: "+56 9 5550 0104", email: "sebastian.perez@example.test" },
    "Av. Vicuña Mackenna 6500",
    "La Florida",
    "8240000",
  ),
  tutor(
    5,
    "Valentina",
    "Silva Araya",
    { phone: "+56 9 5550 0105" },
    "Av. Pajaritos 3030",
    "Maipú",
    "9250000",
  ),
  tutor(
    6,
    "Felipe",
    "Rojas Morales",
    { phone: "+56 9 5550 0106", email: "felipe.rojas@example.test" },
    "Av. Concha y Toro 1420",
    "Puente Alto",
    "8150000",
  ),
  tutor(
    7,
    "Catalina",
    "Soto Vargas",
    { email: "catalina.soto@example.test" },
    "Calle Álvarez 790",
    "Viña del Mar",
    "2520000",
  ),
  tutor(
    8,
    "Ignacio",
    "Díaz Tapia",
    { phone: "+56 9 5550 0108" },
    "Subida Ecuador 455",
    "Valparaíso",
    "2340000",
  ),
  tutor(
    9,
    "Javiera",
    "Reyes Campos",
    { phone: "+56 9 5550 0109", email: "javiera.reyes@example.test" },
    "Barros Arana 1230",
    "Concepción",
    "4030000",
  ),
  tutor(
    10,
    "Cristóbal",
    "Torres Núñez",
    { phone: "+56 9 5550 0110" },
    "Av. Alemania 0560",
    "Temuco",
    "4780000",
  ),
  tutor(
    11,
    "Constanza",
    "Fuentes Sepúlveda",
    { email: "constanza.fuentes@example.test" },
    "Av. Picarte 2210",
    "Valdivia",
    "5090000",
  ),
  tutor(
    12,
    "Nicolás",
    "Araya Herrera",
    { phone: "+56 9 5550 0112", email: "nicolas.araya@example.test" },
    "Av. Angamos 0880",
    "Antofagasta",
    "1240000",
  ),
  tutor(
    13,
    "María José",
    "Vásquez Castillo",
    { phone: "+56 9 5550 0113" },
    "Calle Cordovez 640",
    "La Serena",
    "1700000",
  ),
  tutor(
    14,
    "Joaquín",
    "Espinoza Cortés",
    { phone: "+56 9 5550 0114", email: "joaquin.espinoza@example.test" },
    "Av. Brasil 1120",
    "Rancagua",
    "2820000",
  ),
  tutor(
    15,
    "Pilar",
    "Carrasco Guzmán",
    { email: "pilar.carrasco@example.test" },
    "Av. Apoquindo 4501",
    "Las Condes",
    "7550000",
  ),
];

export type PacienteDemo = {
  key: string;
  tutorKey: string;
  ficha: Omit<PatientContent, "tutorId">;
};
const patient = (
  n: number,
  name: string,
  tutor: number,
  species: Species,
  breed: string,
  sex: Sex,
  reproductiveStatus: ReproductiveStatus,
  birthDate: string | null,
  weightKg: number,
  extra: Omit<Partial<PatientContent>, "tutorId" | "antecedentes"> & {
    antecedentes?: Partial<PatientContent["antecedentes"]>;
  } = {},
): PacienteDemo => {
  const { tutorId: _, ...ficha } = patientContentSchema.parse({
    name,
    species,
    breed,
    sex,
    reproductiveStatus,
    birthDate,
    weightKg,
    tutorId: `T${String(tutor).padStart(2, "0")}`,
    ...extra,
  });
  return {
    key: `P${String(n).padStart(2, "0")}`,
    tutorKey: `T${String(tutor).padStart(2, "0")}`,
    ficha,
  };
};
export const PACIENTES_DEMO: PacienteDemo[] = [
  patient(1, "Cholito", 1, "canino", "Mestizo", "macho", "esterilizado", "2019-03-12", 14.2, {
    origin: "Rescate; adopción",
    adoptionAge: "8 meses",
    adoptionState: "Delgado según relato de la tutora",
    neuterAge: "12 meses",
    firstVisitDate: "2026-10-01",
    referrer: {
      refers: "si",
      name: "Daniela Vera",
      center: "Centro Veterinario Los Aromos",
      phone: "+56 9 5550 0201",
      insurance: null,
      opinion: "Solicita evaluación; no confirma diagnóstico",
    },
    antecedentes: {
      behavioralHistory: [{ text: "Vocalizaciones durante algunas ausencias", negative: false }],
    },
  }),
  patient(2, "Canela", 1, "canino", "Poodle", "hembra", "esterilizado", "2016-08-02", 6.1, {
    antecedentes: {
      preexistingDiseases: [{ text: "Cardiopatía referida en informe previo", negative: false }],
      currentMedications: [
        { text: "Pimobendan referido; pauta pendiente de cotejar con informe", negative: false },
      ],
    },
  }),
  patient(
    3,
    "Gala",
    1,
    "felino",
    "Doméstico de pelo corto",
    "hembra",
    "esterilizado",
    "2021-05-20",
    4,
  ),
  patient(4, "Rucio", 2, "canino", "Mestizo", "macho", "entero", null, 24.5, {
    ageMonths: 57,
    referrer: {
      refers: "no",
      name: null,
      center: null,
      phone: null,
      insurance: null,
      opinion: null,
    },
    antecedentes: {
      behavioralHistory: [{ text: "El tutor niega mordidas previas", negative: true }],
    },
  }),
  patient(
    5,
    "Luna",
    2,
    "felino",
    "Doméstico de pelo corto",
    "hembra",
    "esterilizado",
    "2020-11-03",
    3.8,
  ),
  patient(
    6,
    "Simón",
    3,
    "canino",
    "Labrador Retriever",
    "macho",
    "esterilizado",
    "2017-06-30",
    31,
    {
      antecedentes: {
        knownAllergies: [
          { text: "Reacción alimentaria al pollo referida, sin confirmación", negative: false },
        ],
      },
    },
  ),
  patient(7, "Frida", 3, "canino", "Mestizo", "hembra", "esterilizado", "2023-02-14", 12.8),
  patient(8, "Canelo", 4, "canino", "Golden Retriever", "macho", "entero", "2021-09-09", 32.4),
  patient(
    9,
    "Pelusa",
    4,
    "felino",
    "Doméstico de pelo largo",
    "hembra",
    "esterilizado",
    "2018-04-22",
    4.5,
    {
      antecedentes: {
        preexistingDiseases: [{ text: "Enfermedad renal referida", negative: false }],
      },
    },
  ),
  patient(10, "Mora", 5, "canino", "Mestizo", "hembra", "esterilizado", "2020-02-27", 18.3, {
    origin: "Adopción adulta",
    adoptionAge: "Adulta; edad exacta desconocida",
    neuterAge: null,
  }),
  patient(11, "Rulo", 5, "canino", "Mestizo", "macho", "entero", "2024-03-18", 20.1, {
    antecedentes: {
      behavioralHistory: [
        { text: "Muerde objetos durante el juego según tutora", negative: false },
      ],
    },
  }),
  patient(
    12,
    "Bruno",
    6,
    "canino",
    "Schnauzer Miniatura",
    "macho",
    "esterilizado",
    "2015-12-05",
    8.4,
  ),
  patient(
    13,
    "Porota",
    6,
    "felino",
    "Doméstico de pelo corto",
    "hembra",
    "esterilizado",
    "2022-07-11",
    3.6,
    { origin: "Adopción; procedencia anterior desconocida" },
  ),
  patient(14, "Lola", 7, "canino", "Cocker Spaniel", "hembra", "esterilizado", "2014-10-19", 12.9, {
    antecedentes: { medicalHistory: [{ text: "Otitis recurrente referida", negative: false }] },
  }),
  patient(15, "Negro", 8, "canino", "Mestizo", "macho", "entero", "2023-06-01", 28),
  patient(16, "Mía", 8, "felino", "Doméstico de pelo corto", "hembra", "entero", "2025-01-09", 3.4),
  patient(17, "Coco", 9, "canino", "Chihuahua", "macho", "esterilizado", "2018-08-24", 2.7, {
    antecedentes: {
      behavioralHistory: [
        { text: "Vocalizaciones ante ruidos del pasillo según tutora", negative: false },
      ],
    },
  }),
  patient(18, "Kira", 10, "canino", "Mestizo", "hembra", "entero", "2022-11-30", 23.5),
  patient(
    19,
    "Copito",
    10,
    "felino",
    "Doméstico de pelo corto",
    "macho",
    "esterilizado",
    "2021-03-03",
    4.8,
  ),
  patient(20, "Pepa", 11, "canino", "Mestizo", "hembra", "esterilizado", "2019-05-16", 7.2),
  patient(21, "Chascón", 12, "canino", "Mestizo", "macho", "esterilizado", "2016-01-21", 13.6, {
    antecedentes: {
      medicalHistory: [
        { text: "Prurito estacional referido, sin alergia confirmada", negative: false },
      ],
    },
  }),
  patient(
    22,
    "Chascona",
    12,
    "felino",
    "Doméstico de pelo largo",
    "hembra",
    "esterilizado",
    "2019-12-12",
    4.1,
  ),
  patient(23, "Dante", 13, "canino", "Pug", "macho", "entero", "2024-08-08", 8),
  patient(24, "Tango", 14, "canino", "Mestizo", "macho", "esterilizado", "2012-04-04", 22, {
    antecedentes: {
      medicalHistory: [
        { text: "Dolor osteoarticular referido; chequeo pendiente", negative: false },
      ],
    },
  }),
  patient(
    25,
    "Cleo",
    15,
    "felino",
    "Doméstico de pelo corto",
    "hembra",
    "esterilizado",
    "2017-09-27",
    3.9,
  ),
];
export type ConsultaDemo = {
  key: string;
  paciente: string;
  author: number;
  anamnesis: {
    key: string;
    field: AnamnesisField;
    text: string;
    provenance: Provenance;
    author: number;
  }[];
  diagnosis?: { key: string; text: string; plan?: ConsultationPlanInput };
  epicrisis?: { key: string; status: "approved" | "draft"; author: number };
  correction?: { key: string; author: number; observaciones: string };
  feedback: {
    key: string;
    author: number;
    content: Omit<FeedbackContent, "consultationId">;
    corrects?: string;
  }[];
};
const entries = (
  consulta: string,
  author: number,
  rows: readonly (readonly [AnamnesisField, string, Provenance?, number?])[],
): ConsultaDemo["anamnesis"] =>
  rows.map(([field, text, provenance = "reportada", entryAuthor = author], i) => ({
    key: `${consulta}-A${String(i + 1).padStart(2, "0")}`,
    field,
    text,
    provenance,
    author: entryAuthor,
  }));
const feedback = (
  key: string,
  author: number,
  adherence: FeedbackContent["adherence"],
  evolution: FeedbackContent["evolution"],
  evolutionNote: string,
  extra: Partial<Omit<FeedbackContent, "consultationId">> = {},
): ConsultaDemo["feedback"][number] => ({
  key,
  author,
  content: {
    treatmentApplied: null,
    adherence,
    evolution,
    evolutionNote,
    adverseEvents: [],
    revisedDiagnosis: null,
    treatmentModification: null,
    ...extra,
  },
});
/** Planes y actos de aprobación simulados por cuentas de prueba, sin recomendación clínica real. */
export const CONSULTAS_DEMO: ConsultaDemo[] = [
  {
    key: "C01",
    paciente: "P01",
    author: 0,
    anamnesis: entries("C01", 0, [
      [
        "motivo_consulta",
        "Los días que salgo a trabajar, Cholito a veces aúlla y mueve la puerta de entrada.",
      ],
      [
        "historia_problema",
        "Camila lo nota desde el cambio de horario de hace cuatro meses; no tiene grabaciones de todos los episodios.",
      ],
      ["vivienda_tipo", "Departamento en Ñuñoa; vive con dos adultos, Canela y Gala."],
      [
        "familia_otros_animales",
        "Convive con la perra Canela y la gata Gala; la tutora no relata conflictos entre ellos.",
      ],
      [
        "rutina_paseos",
        "Dos paseos diarios de unos 20 minutos; horarios variables durante la semana.",
      ],
      ["alimentacion_pauta", "Alimento seco repartido en dos comidas; premios durante los paseos."],
      ["eliminacion_calle", "si"],
      ["soledad_tiempo", "Hasta cuatro horas en días laborales; no queda solo todos los días."],
      ["soledad_vocaliza", "a_veces"],
      ["soledad_elimina", "no"],
      ["actividad_juega", "Sigue buscando su pelota y pasea con disposición similar a antes."],
      ["familia_agresion", "no"],
      ["visitas_esconde", "a_veces"],
      ["perros_machos", "La tutora refiere encuentros tranquilos con perros conocidos."],
      [
        "manejo_duerme",
        "Duerme en su cama en el dormitorio; la tutora no refiere despertares habituales.",
      ],
      ["miedo", "si"],
      ["miedo_reaccion", "Se aleja de la aspiradora y busca otra pieza."],
      [
        "tratamientos_anteriores",
        "La tutora probó dejar una radio encendida; no lleva registro para valorar cambios.",
      ],
      [
        "medico_antecedentes",
        "Camila no conoce enfermedades previas; falta revisar antecedentes del rescate.",
      ],
      [
        "texto_libre",
        "Podría existir relación temporal con las ausencias; falta verificar duración y contexto.",
        "inferida",
        1,
      ],
    ]),
    diagnosis: {
      key: "C01-D01",
      text: "Información insuficiente para confirmar diagnóstico; precisar episodios durante ausencias.",
      plan: {
        video: "si",
        videoDetails: "Registro editorial de duración y contexto de los episodios",
        generalGuidelines: "Completar registro de episodios y revisión clínica",
        followUp: "Revisar pendientes y antecedentes del rescate",
      },
    },
    epicrisis: { key: "C01-E01", status: "approved", author: 0 },
    correction: {
      key: "C01-E02",
      author: 0,
      observaciones:
        "Corrección editorial: la ausencia máxima reportada es de cuatro horas; la versión original consignó tres horas. Sin cambio del diagnóstico pendiente.",
    },
    feedback: [
      feedback(
        "F01",
        1,
        "parcial",
        "mejoriaParcial",
        "La tutora refiere menos episodios en días registrados; faltan días de observación.",
        { treatmentApplied: "Registro parcial de episodios" },
      ),
      feedback(
        "F02",
        0,
        "completa",
        "mejoria",
        "Nuevo reporte con mejoría referida; no se establece causalidad del plan.",
        { treatmentApplied: "Registro de episodios y revisión de contexto" },
      ),
    ],
  },
  {
    key: "C02",
    paciente: "P01",
    author: 2,
    anamnesis: entries("C02", 2, [
      [
        "motivo_consulta",
        "Seguimiento simulado posterior a C01 y F01/F02; se consulta por duración de los episodios.",
      ],
      [
        "historia_problema",
        "La tutora refiere menos episodios; persisten días sin observar. No se conocen todas las duraciones.",
      ],
      [
        "texto_libre",
        "Se revisan C01 y F01/F02; siguen pendientes contexto y duración, sin diagnóstico confirmado.",
        "inferida",
      ],
    ]),
    feedback: [],
  },
  {
    key: "C03",
    paciente: "P04",
    author: 1,
    anamnesis: entries("C03", 1, [
      ["motivo_consulta", "Rucio ladra y tira de la correa al acercarse otros perros."],
      [
        "historia_problema",
        "El tutor lo nota en paseos desde hace seis meses; no consta fecha de nacimiento.",
      ],
      [
        "perros_machos",
        "A unos diez metros fija la mirada y tira de la correa; aumenta la distancia y vuelve a caminar.",
      ],
      [
        "familia_otros_animales",
        "Vive con la gata Luna y un adulto en departamento, sin cachorro adicional.",
      ],
      ["familia_agresion", "no"],
      ["texto_libre", "El tutor niega mordidas previas; no referido por otro profesional."],
    ]),
    feedback: [],
  },
  {
    key: "C04",
    paciente: "P07",
    author: 1,
    anamnesis: entries("C04", 1, [
      ["motivo_consulta", "Frida se esconde y tiembla ante ruidos intensos, según su tutora."],
      [
        "historia_problema",
        "Episodios referidos ante fuegos artificiales y truenos desde el verano; frecuencia incompleta.",
      ],
      ["vivienda_tipo", "Casa en Las Condes; dos adultos y adolescente de 15 años."],
      ["familia_otros_animales", "Convive con Simón; no se relatan conflictos entre ambos perros."],
      ["miedo", "si"],
      ["miedo_reaccion", "Se esconde en una pieza y tiembla durante ruidos intensos."],
      [
        "manejo_duerme",
        "Cama propia en el dormitorio; se ofrece acceso a la pieza en episodios de ruido.",
      ],
    ]),
    diagnosis: {
      key: "C04-D01",
      text: "Miedo a ruidos referido; información insuficiente para confirmación diagnóstica.",
      plan: {
        generalGuidelines: "Registrar contexto de los episodios y acceso a un lugar de descanso",
        specificGuidelines: "Revisar con tutora el registro de episodios",
        followUp: "Revisar evolución reportada y condiciones del descanso",
      },
    },
    epicrisis: { key: "C04-E01", status: "approved", author: 1 },
    feedback: [
      feedback(
        "F03",
        2,
        "ninguna",
        "sinCambios",
        "La tutora no aplicó las medidas acordadas y refiere episodios similares.",
      ),
      feedback(
        "F04",
        1,
        "parcial",
        "empeoramiento",
        "Nuevo ruido intenso y mayor reacción referida; causalidad de las medidas no establecida.",
        {
          treatmentApplied: "Acceso parcial a pieza de descanso",
          adverseEvents: [
            {
              severity: "leve",
              description: "Roce cutáneo con arnés reportado; relación causal no establecida",
            },
          ],
        },
      ),
    ],
  },
  {
    key: "C05",
    paciente: "P07",
    author: 2,
    anamnesis: entries("C05", 2, [
      [
        "motivo_consulta",
        "Reconsulta simulada por nuevos episodios tras ruido intenso; se revisan C04 y F03/F04.",
      ],
      [
        "historia_problema",
        "Persiste miedo referido; aplicación parcial de medidas y roce cutáneo reportado.",
      ],
      [
        "texto_libre",
        "Falta confirmar diagnóstico y revisar el evento del arnés; borrador de epicrisis no definitivo.",
        "inferida",
      ],
    ]),
    epicrisis: { key: "C05-E01", status: "draft", author: 2 },
    feedback: [],
  },
  {
    key: "C06",
    paciente: "P15",
    author: 0,
    anamnesis: entries("C06", 0, [
      ["motivo_consulta", "Negro gruñe cuando entran visitas a la casa, según el tutor."],
      ["visitas_agresion", "si"],
      [
        "visitas_contextos",
        "Gruñe cuando la visita se aproxima en el recibidor; no ha mordido según tutor.",
      ],
      ["visitas_inicio", "Dos episodios en los últimos tres meses."],
      ["visitas_postura", "Se queda quieto y muestra los dientes según el tutor; no hay video."],
      [
        "familia_otros_animales",
        "Convive con la gata Mía y dos adultos; no se refieren conflictos con ella.",
      ],
    ]),
    feedback: [],
  },
  {
    key: "C07",
    paciente: "P18",
    author: 1,
    anamnesis: entries("C07", 1, [
      ["motivo_consulta", "El tutor refiere que a Kira le cuesta descansar en casa y pide juego."],
      ["rutina_paseos", "Dos paseos diarios de 30 minutos; horarios variables."],
      [
        "actividad_como_juega",
        "Busca pelota y trae juguetes; el tutor no lleva un registro de duración.",
      ],
      [
        "manejo_descansa",
        "El tutor desconoce cuánto duerme durante el día; no hay registro.",
        "desconocida",
      ],
      ["familia_otros_animales", "Convive con Copito y dos adultos en una casa."],
      [
        "texto_libre",
        "Podría influir la distribución de actividad y descanso; faltan observaciones. No se diagnostica hiperactividad.",
        "inferida",
      ],
    ]),
    feedback: [],
  },
  {
    key: "C08",
    paciente: "P24",
    author: 2,
    anamnesis: entries("C08", 2, [
      ["motivo_consulta", "Tango muestra menor disposición al juego según su tutor."],
      [
        "actividad_cambios",
        "Desde hace dos meses juega menos; no se atribuye el cambio solo a la edad.",
      ],
      ["medico_antecedentes", "Dolor osteoarticular referido; falta cotejar evaluación médica."],
      ["medico_chequeos", "Chequeo médico pendiente; no consta fecha del anterior."],
    ]),
    diagnosis: {
      key: "C08-D01",
      text: "Cambio de actividad referido; evaluación médica pendiente, sin diagnóstico conductual confirmado.",
      plan: {
        tests: ["exploracion_fisica"],
        generalGuidelines: "Completar evaluación médica; sin tratamiento conductual indicado",
        followUp: "Revisar chequeo pendiente y reporte de actividad",
      },
    },
    epicrisis: { key: "C08-E01", status: "approved", author: 2 },
    feedback: [
      feedback(
        "F05",
        0,
        "desconocida",
        "desconocida",
        "No se precisa evolución; sin tratamiento conductual indicado.",
      ),
      {
        ...feedback(
          "F06",
          2,
          "desconocida",
          "mejoriaParcial",
          "Corrección al completar reporte: refiere algo más de disposición al juego; se preserva el desconocimiento inicial de F05.",
        ),
        corrects: "F05",
      },
    ],
  },
];
export type DemoDataset = {
  tutores: TutorDemo[];
  pacientes: PacienteDemo[];
  consultas: ConsultaDemo[];
};
