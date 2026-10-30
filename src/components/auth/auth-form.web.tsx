import { useEffect, useRef } from "react";
import type { AuthFormProps } from "./auth-form";

/**
 * `<form>` real para que los gestores de contraseñas asocien, guarden y rellenen las credenciales
 * (FR-089 · design.md D16). Es el único DOM intrínseco de la app. `action` apunta a la propia ruta:
 * sin JS, el `post` no llega a ningún servidor que acepte credenciales (falla cerrado).
 */
export function AuthForm({ children, onSubmit }: AuthFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // RNW no reenvía `name` en `TextInput`: cada campo con `id` recibe `name` = `id` al montar.
  useEffect(() => {
    for (const input of formRef.current?.querySelectorAll<HTMLInputElement>("input[id]") ?? []) {
      if (!input.name) input.name = input.id;
    }
  }, []);
  return (
    <form
      action="/login"
      method="post"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      ref={formRef}
      style={{ alignItems: "center", display: "flex", flexDirection: "column", width: "100%" }}
    >
      {children}
    </form>
  );
}
