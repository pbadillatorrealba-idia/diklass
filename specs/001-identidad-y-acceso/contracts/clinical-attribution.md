# Contrato de operaciones clínicas y atribución

Este contrato es la frontera que las specs 002–007 deben reutilizar. Los recursos concretos se
definen en esas specs; aquí se fija la seguridad común para que una acción clínica no pueda escapar
de la identidad autenticada en iOS, Android ni web.

## Reglas de request

Una mutación clínica mediante Supabase o una Edge Function acepta los datos propios del recurso y
rechaza con `400 INVALID_INPUT` los campos de control de atribución enviados por el cliente:

```text
actorId, createdBy, createdAt, updatedBy, updatedAt,
approvedBy, approvedAt, clinicId de otra clínica
```

El actor se deriva exclusivamente de `auth.uid()` en la función SQL/servidor y en el trigger de
PostgreSQL. El momento se genera en UTC en la base de datos. RLS valida la sesión activa y la
pertenencia a la clínica antes de ejecutar la mutación.

## Response común de una creación o modificación

```json
{
  "record": {
    "id": "uuid",
    "status": "draft"
  },
  "attribution": {
    "actorId": "uuid-del-usuario-autenticado",
    "occurredAt": "2026-09-09T19:30:00Z",
    "action": "consultation_opened"
  }
}
```

La identidad devuelta debe corresponder a la sesión que ejecutó la operación, no a un campo del
payload. Toda respuesta de una mutación debe permitir verificar la atribución sin consultar un
estado efímero de la UI.

## Lectura compartida

`GET` sobre pacientes y registros clínicos devuelve datos de cualquier veterinario de la clínica
única, siempre que la sesión esté vigente. La respuesta puede mostrar autor y momento, pero no
otorga permiso para modificarlos.

Una llamada Supabase directa sin sesión devuelve:

```http
401 Unauthorized
```

```json
{
  "code": "AUTHENTICATION_REQUIRED",
  "message": "La sesión ya no es válida. Vuelve a autenticarte."
}
```

## Registros aprobados y correcciones

- Un `UPDATE` sobre `createdBy`, `createdAt`, `approvedBy` o `approvedAt` no cambia datos. El rol
  de la Data API (`authenticated`) solo tiene privilegio de columna sobre `content`, así que
  PostgreSQL rechaza esas columnas antes de que corra el trigger: `403` / `42501` /
  `permission denied for table clinical_records`. Si una columna llegara a ejecutar el trigger
  (por ejemplo, una llamada directa con un rol que sí tuviera el privilegio de columna), este
  responde `409 ATTRIBUTION_IMMUTABLE` y tampoco cambia datos.
- Un `UPDATE` de un registro aprobado devuelve `409 APPROVED_RECORD_IMMUTABLE`.
- La corrección usa una operación de creación de un registro adicional, con acción
  `corrective_record_created`, nuevo `actorId` y `supersedesEventId` que apunta al evento original.
- El registro original y su atribución permanecen legibles sin modificación.

## Garantías de base de datos

La UI y cualquier Edge Function no son el único control. RLS exige usuario autenticado, sesión
activa y pertenencia a la clínica; triggers de `INSERT`/`UPDATE` fijan o rechazan los campos de
atribución; la tabla de eventos de atribución no permite `UPDATE` ni `DELETE` a usuarios
autenticados. Estas garantías deben probarse con llamadas directas al cliente Supabase/RPC y con
consultas contra Supabase local.
