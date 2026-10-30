import { describe, expect, test } from "bun:test";
import {
  emptyTutorValues,
  parseTutorValues,
  tutorValuesFromContent,
} from "@/components/registro/tutor-form";

describe("parseTutorValues", () => {
  test("nombre, RUT y un teléfono bastan; el RUT se guarda canónico y lo opcional vacío es null", () => {
    const { value, errors } = parseTutorValues({
      ...emptyTutorValues,
      name: " Marta ",
      rut: "12.345.678-5",
      phone: "+56 9 5550 0101",
    });
    expect(errors).toBeUndefined();
    expect(value).toMatchObject({
      name: "Marta",
      rut: "12345678-5",
      phone: "+56 9 5550 0101",
      email: null,
    });
  });

  test("sin nombre, el error sale en `name`", () => {
    const { errors } = parseTutorValues({ ...emptyTutorValues, rut: "12345678-5", phone: "1" });
    expect(errors?.name).toBeDefined();
  });

  test("sin RUT o con dígito verificador erróneo, el error sale en `rut`", () => {
    const sinRut = parseTutorValues({ ...emptyTutorValues, name: "Marta", phone: "1" });
    expect(sinRut.errors?.rut).toContain("RUT válido");
    const malo = parseTutorValues({
      ...emptyTutorValues,
      name: "Marta",
      rut: "12345678-4",
      phone: "1",
    });
    expect(malo.errors?.rut).toContain("RUT válido");
  });

  test("sin teléfono ni correo, pide un medio de contacto", () => {
    const { value, errors } = parseTutorValues({
      ...emptyTutorValues,
      name: "Marta",
      rut: "12345678-5",
    });
    expect(value).toBeUndefined();
    expect(errors?.form).toContain("medio de contacto");
  });
});

test("tutorValuesFromContent rellena con texto vacío lo que no hay", () => {
  expect(
    tutorValuesFromContent({
      name: "Zoe",
      rut: "12345678-5",
      phone: null,
      email: "z@example.test",
    }),
  ).toEqual({
    ...emptyTutorValues,
    name: "Zoe",
    rut: "12345678-5",
    email: "z@example.test",
  });
});
