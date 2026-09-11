# Modelo de datos

Este modelo contiene la infraestructura de identidad y atribución que habilita las specs clínicas
posteriores. Las entidades clínicas detalladas (Paciente, Tutor, Consulta, Anamnesis, Diagnóstico,
Tratamiento y Epicrisis) se definirán en la spec 002 o en la spec que las introduzca, pero deberán
implementar el contrato común de atribución descrito aquí.

## Entidades

### Clínica

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK, generado por servidor |
| `name` | `text` | Obligatorio; para el PoC se carga una única clínica |
| `created_at` | `timestamptz` | Obligatorio, UTC, generado por servidor |

La fila única de la clínica se crea durante el seed. No se implementan selección de clínica,
multi-tenancy ni transferencia entre clínicas.

### Veterinario

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK y FK a `auth.users.id`; nunca se acepta desde el formulario de clínica |
| `clinic_id` | `uuid` | FK a `clinics.id`; obligatorio |
| `identifier` | `citext` | Correo de login provisionado; único en Supabase Auth |
| `display_name` | `text` | Obligatorio, escapado al renderizar |
| `provisioned_at` | `timestamptz` | Obligatorio, generado por el script de provisioning |
| `created_at` | `timestamptz` | Obligatorio, UTC, generado por servidor |

La contraseña vive únicamente en Supabase Auth. El PoC no expone registro, recuperación,
desactivación, eliminación ni edición de cuentas.

### Sesión de acceso

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK interna |
| `token_hash` | `bytea` | Único; nonce interno aleatorio. El vínculo con Auth es `auth_session_id` |
| `auth_session_id` | `uuid` | `session_id` del JWT de Supabase Auth que inició la sesión; obligatorio y único mientras está activa; solo un JWT de esa sesión de Auth autoriza acceso clínico |
| `veterinarian_id` | `uuid` | FK a `veterinarians.id`; obligatorio |
| `created_at` | `timestamptz` | Generado por servidor |
| `last_activity_at` | `timestamptz` | Se actualiza solo desde una operación protegida válida |
| `expires_at` | `timestamptz` | No puede superar `last_activity_at + 8 hours` |
| `revoked_at` | `timestamptz` | Nulo mientras está activa; se establece en logout o revocación |

#### Transiciones

```text
activa ──logout──> revocada
activa ──inactividad > 8 h──> expirada
activa ──renovación de actividad válida──> activa (last_activity_at actualizado)
```

Una sesión revocada o expirada no autoriza lecturas ni escrituras clínicas. El access token de
Supabase se valida además de esta fila; ninguno de los dos controles se sustituye por una bandera
del cliente.

### Evento de atribución clínica

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK, generado por servidor |
| `entity_type` | `text` | Uno de los tipos clínicos permitidos por el contrato |
| `entity_id` | `uuid` | Identificador del registro afectado |
| `action` | `text` | Acción taxativa de FR-063 o acción técnica de corrección |
| `actor_id` | `uuid` | FK a `veterinarians.id`, derivado de `auth.uid()` |
| `occurred_at` | `timestamptz` | UTC, generado por servidor |
| `supersedes_event_id` | `uuid` | Opcional; referencia el evento corregido, nunca lo reemplaza |
| `metadata` | `jsonb` | Opcional; no contiene secretos ni contraseñas |

`clinical_audit_events` es append-only: no permite `UPDATE` ni `DELETE` a usuarios autenticados.
Una función/triggers de base de datos lo inserta al crear o modificar los registros clínicos. El
actor y el momento no se toman del payload HTTP.

Las acciones permitidas cubren la enumeración de FR-063:

- `patient_created`, `patient_updated`, `tutor_created`, `tutor_updated`;
- `consultation_opened`;
- `anamnesis_recorded`, `anamnesis_corrected`, `audio_fact_confirmed`;
- `missing_information_decided`;
- `hypothesis_accepted`, `hypothesis_discarded`, `hypothesis_added`;
- `diagnosis_recorded`;
- `pharmacological_treatment_adopted`, `non_pharmacological_treatment_adopted`;
- `epicrisis_approved`;
- `clinical_feedback_recorded`;
- `corrective_record_created`.

### Contrato común de los registros clínicos

Cada tabla clínica creada por esta o por una spec posterior debe incluir como mínimo:

| Campo | Tipo | Reglas |
|---|---|---|
| `clinic_id` | `uuid` | FK a `clinics.id`; necesario para RLS de clínica compartida |
| `created_by` | `uuid` | FK a `veterinarians.id`; `NOT NULL`, fijado a `auth.uid()` |
| `created_at` | `timestamptz` | `NOT NULL`, UTC y servidor |
| `updated_by` | `uuid` | FK; nulo si nunca se editó |
| `updated_at` | `timestamptz` | UTC; nulo si nunca se editó |
| `approved_at` | `timestamptz` | Nulo hasta la aprobación |
| `approved_by` | `uuid` | FK; nulo hasta la aprobación y luego inmutable |

Un trigger rechaza cualquier `INSERT` donde `created_by` no coincida con `auth.uid()` y cualquier
`UPDATE` que cambie `created_by`, `created_at`, `approved_by` o `approved_at`. Las modificaciones
permitidas de un registro no aprobado actualizan `updated_by` con `auth.uid()` y generan su evento.
Después de aprobado, el registro queda inmutable; una corrección es un registro adicional con
`supersedes_event_id`.

## Relaciones y reglas de acceso

```text
Clínica 1 ─── N Veterinarios
Clínica 1 ─── N registros clínicos
Veterinario 1 ─── N Sesiones de acceso
Veterinario 1 ─── N Eventos de atribución
Registro clínico 1 ─── N Eventos de atribución
```

- Un veterinario solo puede autenticarse si su identidad de Supabase tiene una fila provisionada en
  la clínica única.
- Cualquier veterinario provisionado de esa clínica puede leer y atender cualquier paciente de la
  clínica; no existe filtro por `created_by` para los datos clínicos.
- Toda política RLS exige `auth.uid() IS NOT NULL` y pertenencia a la misma `clinic_id`.
- La política de escritura no permite enviar un actor arbitrario; el trigger sobrescribe o rechaza
  el valor y genera la atribución con el usuario de la sesión.
- La service-role key puede usarse en provisioning/migraciones desde código servidor aislado, nunca
  desde el navegador ni desde una operación clínica iniciada por el usuario.

## Borrador no persistido en base de datos

El borrador de una consulta es estado local de la app, no una entidad clínica persistida. El
adaptador usa `sessionStorage` en web y almacenamiento seguro nativo para borradores pequeños en
iOS/Android:

```text
draft:<veterinarianId>:<consultationId>
```

Su ciclo es `editing → restored → saved|discarded`. El valor se guarda con debounce, se conserva
cuando Supabase/RLS devuelve `AUTHENTICATION_REQUIRED` y se elimina después de un guardado exitoso o
del cierre explícito de la consulta. Nunca contiene contraseñas, tokens ni la service-role key.

TanStack DB podrá reemplazar este adaptador cuando el producto necesite persistencia local-first,
colecciones reactivas, sincronización offline o reanudación de mutaciones; no forma parte del
modelo inicial.
