# Contrato de autenticación y sesión

La app Expo invoca Supabase Auth mediante `@supabase/supabase-js`. Las pantallas y layouts de Expo
Router solo controlan navegación; las funciones SQL y RLS son la frontera de seguridad común para
iOS, Android y web.

## Login

La pantalla envía a Supabase Auth un identificador de correo y contraseña de una cuenta previamente
provisionada:

```ts
supabase.auth.signInWithPassword({
  email: identifier,
  password,
})
```

Tras éxito, la app invoca `start_access_session()`, una función SQL que deriva el veterinario de
`auth.uid()`, registra la sesión y devuelve solo su expiración. No existe `signUp` en la app.

### Fallo de autenticación

Una cuenta inexistente, una contraseña incorrecta o un usuario no provisionado deben producir el
mismo mensaje de UI y el mismo código normalizado:

```json
{
  "code": "AUTHENTICATION_FAILED",
  "message": "Identificador o contraseña incorrectos."
}
```

La app no realiza una consulta previa para descubrir si el identificador existe. La contraseña y
los tokens nunca se registran.

## Logout

La app llama a `revoke_access_sessions()` y después a `supabase.auth.signOut()`. Ambas operaciones
son idempotentes. Tras logout, RLS debe rechazar cualquier lectura o escritura clínica con la sesión
anterior.

## Actividad y expiración

La app llama a `touch_access_session()` al detectar interacción real del usuario, con debounce. La
función actualiza `last_activity_at` solo para `auth.uid()` y nunca acepta timestamps del cliente.

La función `is_active_access(auth.uid())`, usada por las policies RLS, devuelve falso cuando no existe
una sesión no revocada cuya actividad tenga menos de ocho horas. Por tanto, una llamada directa que
evite Expo Router sigue siendo denegada.

La respuesta normalizada para sesión ausente, revocada o expirada es:

```json
{
  "code": "AUTHENTICATION_REQUIRED",
  "message": "La sesión ya no es válida. Vuelve a autenticarte."
}
```

Al recibirla, la app bloquea el guardado, conserva el borrador local y conduce al login. Tras
reautenticación, el borrador se restaura en la misma plataforma.

## Almacenamiento de sesión

- iOS/Android: adaptador de Supabase basado en `expo-secure-store`.
- Web: adaptador de almacenamiento apropiado al target web, aislado por usuario y sin exponer
  service-role keys.
- Zustand no almacena tokens ni sustituye al estado de sesión de Supabase.

## Operaciones clínicas

Las lecturas y mutaciones usan el cliente Supabase con el contexto del usuario autenticado. No se
usa una service-role key para una operación iniciada por el veterinario. Cualquier endpoint o Edge
Function que se agregue para una operación compleja debe volver a validar Auth, sesión activa y
payload con Zod antes de tocar datos.
