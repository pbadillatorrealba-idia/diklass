import { expect, test } from "bun:test";
import { patientContent, patientFixture, randomRut } from "../../support/rut";

test("el contenido clínico reutiliza los datos coherentes de Cholito", () => {
  const patient = patientContent("Cholito");
  expect(patient.name).toBe("Cholito");
  expect(patient.sex).toBe("macho");
  expect(patient.reproductiveStatus).toBe("esterilizado");
  expect(patientContent("Kira").sex).toBe("hembra");
});

test("rechaza nombres técnicos fuera del dataset y permite selección por clave estable", () => {
  expect(() => patientFixture("Toby concurrencia")).toThrow("plantilla");
  expect(patientFixture("P01").ficha.name).toBe("Cholito");
});

test("reservar RUT no depende de que el generador aleatorio no colisione", () => {
  const original = Math.random;
  Math.random = () => 0.25;
  try {
    expect(new Set(Array.from({ length: 10 }, () => randomRut())).size).toBe(10);
  } finally {
    Math.random = original;
  }
});
