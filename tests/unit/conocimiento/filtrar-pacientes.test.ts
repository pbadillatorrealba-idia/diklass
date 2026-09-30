import { describe, expect, test } from "bun:test";
import {
  contarCoincidencias,
  filtrarPacientes,
  MAX_COINCIDENCIAS,
} from "@/features/conocimiento/filtrar-pacientes";
import type { PatientEntry } from "@/features/registro/ficha-service";

const paciente = (id: string, name: string, breed = "Mestizo", species = "perro") =>
  ({ record: { id }, content: { name, breed, species } }) as unknown as PatientEntry;

const ids = (lista: PatientEntry[]) => lista.map((entry) => entry.record.id);

const muchos = Array.from({ length: 30 }, (_, i) => paciente(`p${i}`, `Paciente ${i}`));

// sistema-visual FR-095 · US14-AC6 (design.md D19).
describe("filtrarPacientes", () => {
  test("sin búsqueda devuelve las primeras 8 fichas", () => {
    expect(MAX_COINCIDENCIAS).toBe(8);
    expect(ids(filtrarPacientes(muchos, "", null))).toEqual(ids(muchos.slice(0, 8)));
  });

  test("ignora mayúsculas y tildes en el nombre", () => {
    const lista = [paciente("a", "Ñandú Pérez"), paciente("b", "Luna")];
    expect(ids(filtrarPacientes(lista, "nandu perez", null))).toEqual(["a"]);
    expect(ids(filtrarPacientes(lista, "LUNA", null))).toEqual(["b"]);
  });

  test("busca también por raza y especie", () => {
    const lista = [paciente("a", "Toby", "Labrador"), paciente("b", "Mora", "Común", "gato")];
    expect(ids(filtrarPacientes(lista, "labra", null))).toEqual(["a"]);
    expect(ids(filtrarPacientes(lista, "gato", null))).toEqual(["b"]);
  });

  test("limita a 8 coincidencias", () => {
    expect(filtrarPacientes(muchos, "paciente", null)).toHaveLength(8);
  });

  test("el paciente elegido siempre está, primero si no coincide", () => {
    const resultado = ids(filtrarPacientes(muchos, "Paciente 1", "p25"));
    expect(resultado[0]).toBe("p25");
    expect(resultado).toContain("p1");
    expect(ids(filtrarPacientes(muchos, "Paciente 25", "p25"))).toEqual(["p25"]);
  });

  test("sin coincidencias devuelve solo el elegido, si lo hay", () => {
    expect(filtrarPacientes(muchos, "zzz", null)).toEqual([]);
    expect(ids(filtrarPacientes(muchos, "zzz", "p3"))).toEqual(["p3"]);
  });

  test("el recuento es el total real, sin tope y sin contar al elegido que no coincide", () => {
    expect(contarCoincidencias(muchos, "paciente")).toBe(30);
    expect(contarCoincidencias(muchos, "Paciente 25")).toBe(1);
    expect(contarCoincidencias(muchos, "zzz")).toBe(0);
  });
});
