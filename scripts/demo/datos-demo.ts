import type { ReproductiveStatus, Sex, Species } from "@/features/registro/catalogs";
import type { AntecedentGroup, AntecedentItem } from "@/features/registro/schema";
import { rutCheckDigit } from "@/lib/rut";

/**
 * Datos de demostración de una clínica chilena: 15 tutores y 25 pacientes (perros y gatos) con
 * algunas consultas. Todo es sintético y se reconoce como tal:
 *  - nombres y apellidos comunes en Chile combinados al azar (no apuntan a personas reales);
 *  - correos `@example.test` y teléfonos `+56 9 5550 xxxx` (rango ficticio);
 *  - RUT con dígito verificador válido sobre cuerpos `5.000.0NN`.
 * Se carga con `bun run provision:demo` y pasa por los mismos servicios y validaciones que la
 * interfaz.
 */

export type TutorDemo = {
  name: string;
  surname: string;
  rut: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  postalCode: string;
};

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
  name: string;
  /** Posición en `TUTORES_DEMO`. */
  tutor: number;
  species: Species;
  breed: string;
  sex: Sex;
  reproductiveStatus: ReproductiveStatus;
  birthDate: string;
  weightKg: number;
  origin?: string;
  antecedentes?: Partial<Record<AntecedentGroup, string[]>>;
};

const p = (
  tutorIndex: number,
  name: string,
  species: Species,
  breed: string,
  sex: Sex,
  reproductiveStatus: ReproductiveStatus,
  birthDate: string,
  weightKg: number,
  extra: Pick<PacienteDemo, "origin" | "antecedentes"> = {},
): PacienteDemo => ({
  tutor: tutorIndex,
  name,
  species,
  breed,
  sex,
  reproductiveStatus,
  birthDate,
  weightKg,
  ...extra,
});

const DSH = "Doméstico de pelo corto";

export const PACIENTES_DEMO: PacienteDemo[] = [
  p(0, "Toby", "canino", "Mestizo", "macho", "esterilizado", "2019-03-12", 14.2, {
    origin: "Rescate",
    antecedentes: { behavioralHistory: ["Ladra y se destruye objetos al quedarse solo"] },
  }),
  p(0, "Canela", "canino", "Poodle", "hembra", "esterilizado", "2016-08-02", 6.1, {
    antecedentes: {
      preexistingDiseases: ["Cardiopatía degenerativa valvular"],
      currentMedications: ["Pimobendan 1,25 mg cada 12 h"],
    },
  }),
  p(0, "Gala", "felino", DSH, "hembra", "esterilizado", "2021-05-20", 4.0),
  p(1, "Rocky", "canino", "Pastor Alemán", "macho", "entero", "2022-01-15", 34.5, {
    origin: "Criadero",
    antecedentes: { behavioralHistory: ["Reactividad con otros perros en la calle"] },
  }),
  p(1, "Luna", "felino", "Siamés", "hembra", "esterilizado", "2020-11-03", 3.8, {
    antecedentes: { behavioralHistory: ["Orina fuera del arenero desde hace dos meses"] },
  }),
  p(2, "Simón", "canino", "Labrador Retriever", "macho", "esterilizado", "2017-06-30", 31.0, {
    antecedentes: { knownAllergies: ["Alergia alimentaria al pollo"] },
  }),
  p(2, "Frida", "canino", "Bulldog Francés", "hembra", "entero", "2023-02-14", 9.8, {
    origin: "Criadero",
    antecedentes: { behavioralHistory: ["Miedo intenso a fuegos artificiales y tronadas"] },
  }),
  p(3, "Max", "canino", "Golden Retriever", "macho", "entero", "2021-09-09", 32.4),
  p(3, "Pelusa", "felino", "Persa", "hembra", "esterilizado", "2018-04-22", 4.5, {
    antecedentes: { preexistingDiseases: ["Enfermedad renal crónica estadio 2"] },
  }),
  p(4, "Mora", "canino", "Border Collie", "hembra", "esterilizado", "2020-02-27", 18.3),
  p(4, "Thor", "canino", "Husky Siberiano", "macho", "entero", "2024-03-18", 20.1, {
    antecedentes: { behavioralHistory: ["Destruye muebles y puertas cuando se queda solo"] },
  }),
  p(5, "Bruno", "canino", "Schnauzer", "macho", "esterilizado", "2015-12-05", 8.4),
  p(5, "Nala", "felino", DSH, "hembra", "esterilizado", "2022-07-11", 3.6, { origin: "Adopción" }),
  p(6, "Lola", "canino", "Cocker Spaniel", "hembra", "esterilizado", "2014-10-19", 12.9, {
    antecedentes: { preexistingDiseases: ["Otitis externa recurrente"] },
  }),
  p(7, "Zeus", "canino", "Rottweiler", "macho", "entero", "2023-06-01", 38.0, {
    antecedentes: { behavioralHistory: ["Gruñe y muestra los dientes ante visitas en casa"] },
  }),
  p(7, "Mía", "felino", "Bengalí", "hembra", "entero", "2025-01-09", 2.9),
  p(8, "Coco", "canino", "Chihuahua", "macho", "esterilizado", "2018-08-24", 2.7, {
    antecedentes: { behavioralHistory: ["Ladra de forma continua ante ruidos del pasillo"] },
  }),
  p(9, "Kira", "canino", "Pastor Belga Malinois", "hembra", "entero", "2022-11-30", 23.5, {
    antecedentes: { behavioralHistory: ["Hiperactividad: no logra relajarse dentro de casa"] },
  }),
  p(9, "Oliver", "felino", "Maine Coon", "macho", "esterilizado", "2021-03-03", 6.8),
  p(10, "Pepa", "canino", "Jack Russell Terrier", "hembra", "esterilizado", "2019-05-16", 7.2),
  p(11, "Chester", "canino", "Beagle", "macho", "esterilizado", "2016-01-21", 13.6, {
    antecedentes: { knownAllergies: ["Dermatitis atópica estacional"] },
  }),
  p(11, "Sasha", "felino", "Angora", "hembra", "esterilizado", "2019-12-12", 4.1),
  p(12, "Dante", "canino", "Pug", "macho", "entero", "2024-08-08", 8.0),
  p(13, "Tango", "canino", "Mestizo", "macho", "esterilizado", "2012-04-04", 22.0, {
    origin: "Calle",
    antecedentes: {
      preexistingDiseases: ["Artrosis de cadera"],
      currentMedications: ["Meloxicam 1,5 mg/ml, 0,1 mg/kg cada 24 h"],
    },
  }),
  p(14, "Cleo", "felino", "Siamés", "hembra", "esterilizado", "2017-09-27", 3.9),
];

export type ConsultaDemo = {
  /** Nombre del paciente (único en `PACIENTES_DEMO`). */
  paciente: string;
  anamnesis: { field: string; text: string }[];
};

export const CONSULTAS_DEMO: ConsultaDemo[] = [
  {
    paciente: "Toby",
    anamnesis: [
      {
        field: "motivo_consulta",
        text: "Ladra, aúlla y rompe cosas cuando se queda solo en casa.",
      },
      {
        field: "historia_problema",
        text: "Comenzó hace cuatro meses, cuando la tutora volvió a trabajar de forma presencial.",
      },
      { field: "vivienda_tipo", text: "Departamento de dos ambientes, sin patio." },
      { field: "rutina_paseos", text: "Dos paseos al día de 20 minutos." },
    ],
  },
  {
    paciente: "Rocky",
    anamnesis: [
      {
        field: "motivo_consulta",
        text: "Tira de la correa y ladra con intensidad al cruzarse con otros perros.",
      },
      {
        field: "historia_problema",
        text: "Empeoró desde que cumplió un año; antes jugaba con otros perros sin problema.",
      },
      { field: "familia_otros_animales", text: "Vive con una gata, sin conflictos." },
    ],
  },
  {
    paciente: "Frida",
    anamnesis: [
      {
        field: "motivo_consulta",
        text: "Se esconde, jadea y tiembla durante tronadas y fuegos artificiales.",
      },
      { field: "vivienda_tipo", text: "Casa con patio pequeño en Las Condes." },
      { field: "rutina_paseos", text: "Un paseo largo en la mañana y uno corto en la tarde." },
    ],
  },
  {
    paciente: "Thor",
    anamnesis: [
      { field: "motivo_consulta", text: "Destruye puertas y muebles cuando queda solo." },
      {
        field: "historia_problema",
        text: "Desde que llegó a casa a los tres meses; ha ido en aumento.",
      },
      {
        field: "rutina_paseos",
        text: "Un paseo de 30 minutos al día; la familia reconoce que es poco para su raza.",
      },
      { field: "alimentacion_dieta", text: "Alimento seco para razas grandes, dos tomas." },
    ],
  },
  {
    paciente: "Zeus",
    anamnesis: [
      {
        field: "motivo_consulta",
        text: "Gruñe y muestra los dientes cuando llegan visitas a la casa.",
      },
      {
        field: "historia_problema",
        text: "Dos episodios en los últimos tres meses; no ha mordido.",
      },
      { field: "familia_otros_animales", text: "Convive con una gata (Mía) sin problemas." },
    ],
  },
  {
    paciente: "Kira",
    anamnesis: [
      {
        field: "motivo_consulta",
        text: "No se relaja en casa, patrulla y pide juego todo el día.",
      },
      {
        field: "rutina_paseos",
        text: "Dos paseos de 30 minutos; sin juego dirigido ni actividad mental.",
      },
    ],
  },
  {
    paciente: "Luna",
    anamnesis: [
      {
        field: "motivo_consulta",
        text: "Orina fuera del arenero, sobre todo en la cama y el sofá.",
      },
      {
        field: "historia_problema",
        text: "Comenzó hace dos meses tras la llegada de un cachorro a la casa.",
      },
    ],
  },
  {
    paciente: "Coco",
    anamnesis: [
      {
        field: "motivo_consulta",
        text: "Ladra de forma continua ante cualquier ruido del pasillo del edificio.",
      },
      { field: "vivienda_tipo", text: "Departamento en el quinto piso." },
    ],
  },
];

export const antecedentItems = (texts: string[] | undefined): AntecedentItem[] =>
  (texts ?? []).map((text) => ({ text, negative: false }));
