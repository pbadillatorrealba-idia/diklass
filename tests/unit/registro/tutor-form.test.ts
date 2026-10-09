import { describe, expect, test } from "bun:test";
import {
  emptyTutorValues,
  parseTutorValues,
  tutorValuesFromContent,
} from "@/components/registro/tutor-form";

describe("parseTutorValues", () => {
  test("nombre y un teléfono bastan; lo opcional vacío queda null", () => {
    const { value, errors } = parseTutorValues({
      ...emptyTutorValues,
      name: " Marta ",
      phone: "+56 9 5550 0101",
    });
    expect(errors).toBeUndefined();
    expect(value).toMatchObject({ name: "Marta", phone: "+56 9 5550 0101", email: null });
  });

  test("sin nombre, el error sale en `name`", () => {
    const { errors } = parseTutorValues({ ...emptyTutorValues, phone: "1" });
    expect(errors?.name).toBeDefined();
  });

  test("sin teléfono ni correo, pide un medio de contacto", () => {
    const { value, errors } = parseTutorValues({ ...emptyTutorValues, name: "Marta" });
    expect(value).toBeUndefined();
    expect(errors?.form).toContain("medio de contacto");
  });
});

test("tutorValuesFromContent rellena con texto vacío lo que no hay", () => {
  expect(tutorValuesFromContent({ name: "Zoe", phone: null, email: "z@example.test" })).toEqual({
    ...emptyTutorValues,
    name: "Zoe",
    email: "z@example.test",
  });
});
