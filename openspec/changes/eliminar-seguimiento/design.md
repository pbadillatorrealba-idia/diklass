# Design

## Context

Ver proposal.md (Why). La retroalimentación clínica vive como filas `clinical_feedback` dentro de
`clinical_records` (migración 012: validación de forma cerrada, inmutabilidad ante UPDATE y evento de
auditoría `clinical_feedback_recorded`; ampliada en 014, 025 y 028). La interfaz es la sección
`(follow-up)`, `src/components/retroalimentacion/` y `src/features/retroalimentacion/`. Lo consumen
también `scripts/demo/` (carga de 6 entradas) y los e2e de caso sintético.

## Goals / Non-Goals

**Goals:** quitar el módulo de la app, la navegación, el agente, el demo, los tests y la documentación,
sin tocar la BD.

**Non-Goals:** migrar o borrar datos; retirar `plan.followUp` y `FollowUpSummaryPanel` (son del
registro clínico, no del módulo, aunque compartan nombre); rediseñar la navegación restante.

## Decisions

1. **La BD queda intacta.** `clinical_feedback` es registro clínico auditado e inmutable; borrarlo
   destruiría evidencia y exigiría una migración irreversible. Alternativa descartada: migración 030
   que retire el tipo, el trigger y la acción de auditoría. Consecuencia: queda un tipo de registro sin
   interfaz, cubierto por `supabase/tests/012_retroalimentacion_clinica.sql`, que se conserva.
   `db:types` no debe cambiar; si cambia, es un hallazgo a investigar.
2. **Se retira `SeverityBadge` y FR-077.** Solo lo usaban los eventos adversos (verificado por grep).
   Alternativa descartada: conservarlo como componente huérfano «por si acaso» (código muerto con tests).
3. **Datos demo sin retroalimentación.** Se elimina `feedback` de `datos-demo.ts` y los pasos de
   `cargar-demo.ts`/`validar-demo.ts`/`metadata-demo.ts`, y se regeneran las huellas de
   `contratos-demo.json` con `bun scripts/demo/contratos-demo.ts`. Alternativa descartada: dejar filas
   demo con un insert mínimo (datos invisibles que habría que mantener).
4. **e2e.** Se borra `retroalimentacion.spec.ts`, el insert REST de `clinical_feedback` y los testIDs
   `feedback-*` del caso sintético; la navegación, accesibilidad y estados dejan de recorrer `/follow-up`.
5. **Agente.** Se retira `/follow-up` de `_shared/routes.ts` y del prompt de `agent.ts`; la función
   debe desplegarse de nuevo.
6. **Una ruta `/follow-up` eliminada devuelve el 404 normal de la app**, sin redirección: no hay
   enlaces externos que conservar en un PoC.

## Risks / Trade-offs

- [Specs en vuelo en conflicto] `marca-movil-sin-barra` modifica FR-082 (barra inferior sin
  Seguimiento) y este cambio lo vuelve a modificar → archivar `marca-movil-sin-barra` antes del sync de
  este. `dataset-clinico-trazable` (aún sin spec principal) exige 6 retroalimentaciones demo →
  reconciliarlo con `openspec-update-change` antes de aplicar la tarea 4; `agente-conversacional`
  habla de «seguimientos y recordatorios» como propuestas de agenda, que **no** son este módulo: sin
  cambio.
- [Cobertura de `clinical_feedback` solo en pgTap] → aceptado; ninguna UI lo ejercita.
- [Referencias residuales en narrativa de specs] las historias de `sistema-visual` (US13, US14) y el
  texto de `retroalimentacion-clinica` mencionan el módulo fuera de los bloques de requisitos, que el
  sync no toca → se registra como tarea de revisión; `openspec/specs/` no se edita a mano.
- [Dato clínico invisible] las filas existentes siguen en BD sin forma de verlas → deuda consciente,
  decidida en la planificación.

## Restos de narrativa que el sync no cubre

El sync solo toca los bloques de requisitos; tras el archivo quedan, para una revisión editorial
posterior, estas menciones en `openspec/specs/sistema-visual/spec.md`: US13 (severidad de eventos,
escenario 3), US14 (Why, Independent Test y escenarios 1–3 con «Seguimiento») y los apuntes de
severidad `critico` de Assumptions y trazabilidad (FR-077). En `retroalimentacion-clinica` queda la
narrativa de US10, que describe una capacidad ya sin requisitos.

## Migration Plan

Sin migración de BD. Desplegar la app y reenviar la función `agent`. Reversión: revertir la PR; no hay
datos que restaurar.
