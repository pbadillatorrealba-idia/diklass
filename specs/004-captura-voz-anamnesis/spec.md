# Feature Specification: Captura de voz hacia anamnesis

**Feature Branch**: `docs/project-constitution` (rama activa; directorio: `specs/004-captura-voz-anamnesis`)

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: modo de escucha clínica del PoC de CDSS de etología veterinaria canina
— captura de audio de la conversación entre veterinario y tutor durante la consulta, transcripción
incremental por tramos, extracción de información clínicamente relevante hacia un borrador
estructurado de anamnesis, y confirmación explícita antecedente por antecedente antes de incorporar
nada a la ficha.

**Contexto de producto**: [Brief del PoC](../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: los `FR-NNN` y `SC-NNN` son únicos a nivel de familia de specs. Un
requisito transversal aparece íntegro en cada spec donde aplica, designando siempre el mismo
requisito.

## User Scenarios & Testing *(mandatory)*

### User Story 6 - Captura de conversación por voz hacia un borrador (Priority: P1)

Durante la consulta el veterinario activa un modo de escucha clínica. El sistema captura el audio de
la conversación con el tutor, lo transcribe por tramos, extrae la información clínicamente relevante
y va actualizando un borrador estructurado de anamnesis que el profesional revisa antes de
incorporar.

**Why this priority**: Es la apuesta de experiencia de uso del PoC (R4, R5, R6) y el tramo central
del escenario demostrador. Es única historia de esta spec porque capturar, transcribir, extraer y
confirmar forman una cadena indivisible: cualquier eslabón faltante deja el resto sin valor
clínico o sin seguridad.

**Independent Test**: Reproducir una conversación simulada, activar el modo escucha y verificar que
el borrador se puebla con los antecedentes esperados y que nada entra a la ficha sin confirmación
explícita.

**Acceptance Scenarios**:

1. **Given** una consulta abierta, **When** el veterinario activa el modo de escucha clínica,
   **Then** el sistema indica de forma visible que está capturando audio.
2. **Given** el modo de escucha activo, **When** transcurre una ventana de captura de
   aproximadamente 30 segundos, **Then** el sistema transcribe ese tramo y actualiza el borrador de
   anamnesis con la información clínica que haya identificado.
3. **Given** un borrador poblado automáticamente, **When** el veterinario revisa lo extraído,
   **Then** puede aceptar, corregir o descartar cada antecedente por separado antes de guardarlo.
4. **Given** información extraída no confirmada, **When** se cierra la consulta, **Then** esa
   información no forma parte de la anamnesis definitiva.
5. **Given** el modo de escucha activo, **When** el veterinario lo detiene, **Then** la captura de
   audio cesa y el sistema lo indica.
6. **Given** un antecedente extraído del audio, **When** el veterinario lo revisa, **Then** puede
   ver el fragmento de la transcripción del cual proviene.
7. **Given** un tramo de audio de calidad insuficiente, **When** el sistema lo procesa, **Then** lo
   señala como no confiable en lugar de derivar antecedentes de él.
8. **Given** un antecedente extraído que contradice información ya registrada en la ficha, **When**
   se presenta el borrador, **Then** el sistema muestra la contradicción en lugar de sobrescribir el
   dato previo.
9. **Given** un antecedente extraído del audio, **When** el veterinario lo revisa antes de
   confirmarlo, **Then** aparece con procedencia inferida, y al confirmarlo su procedencia no cambia.
10. **Given** que el sistema no puede acceder al micrófono, **When** el veterinario intenta activar
    la escucha, **Then** el sistema lo indica y permite registrar la anamnesis manualmente.
11. **Given** una consulta larga con captura activa, **When** el veterinario revisa el borrador al
    final, **Then** conserva los antecedentes extraídos en los primeros tramos.
12. **Given** una captura interrumpida a mitad de un tramo, **When** el sistema se detiene, **Then**
    el borrador queda en un estado definido y ningún tramo permanece a medio procesar.
13. **Given** el modo de escucha activo, **When** transcurre la consulta, **Then** el veterinario
    puede revisar lo transcrito mientras la consulta ocurre, sin esperar a que termine.
14. **Given** que no hay ninguna consulta abierta, **When** el veterinario intenta activar la
    escucha clínica, **Then** el sistema no inicia la captura.
15. **Given** un antecedente extraído del audio, **When** lo confirma un veterinario distinto del
    que abrió la consulta, **Then** queda registrado quién lo confirmó y cuándo.

---

### Edge Cases

- **Audio inaudible o ambiente ruidoso**: cuando la transcripción de un tramo tiene calidad
  insuficiente, el sistema debe señalarlo en lugar de producir antecedentes a partir de texto poco
  confiable.
- **Conversación con información contradictoria**: si el tutor se corrige a sí mismo dentro de la
  consulta, el borrador debe reflejar la contradicción para que el veterinario resuelva, en vez de
  quedarse silenciosamente con una de las dos versiones.
- **Modo escucha activado sin consulta abierta**: la captura no debe iniciarse sin una consulta a la
  cual asociar el borrador.
- **Interrupción de la captura a mitad de un tramo**: el audio parcial ya capturado debe procesarse o
  descartarse de forma explícita, sin dejar el borrador en estado indeterminado.
- **Conversación que menciona a un animal distinto del paciente**: los antecedentes extraídos no
  deben atribuirse al paciente en consulta sin que el veterinario lo confirme.
- **Sesión larga**: la duración de la consulta no debe hacer que se pierdan los tramos iniciales del
  borrador.
- **Permiso de micrófono denegado**: el sistema debe indicarlo con claridad y permitir continuar la
  consulta con registro manual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-014**: El sistema MUST permitir capturar audio de la conversación durante una consulta,
  mediante activación explícita del veterinario, y MUST NOT iniciar la captura sin una consulta
  abierta a la cual asociarla.
- **FR-025**: El sistema MUST indicar de forma visible mientras la captura de audio está activa, y
  MUST permitir detenerla en cualquier momento.
- **FR-015**: El sistema MUST transcribir a texto la conversación capturada de forma incremental
  durante la consulta, de modo que el veterinario pueda revisar lo transcrito mientras la consulta
  transcurre y no solo al terminarla. No se exige transcripción en tiempo real.
- **FR-031**: El sistema MUST señalar los tramos cuya transcripción tenga calidad insuficiente y
  MUST NOT derivar antecedentes clínicos a partir de ellos.
- **FR-016**: El sistema MUST identificar información clínicamente relevante a partir de la
  transcripción y volcarla en un borrador estructurado de anamnesis.
- **FR-017**: La información obtenida automáticamente MUST permanecer como borrador y MUST requerir
  confirmación explícita del veterinario, antecedente por antecedente, antes de incorporarse a la
  ficha clínica.
- **FR-021**: Todo antecedente proveniente del audio MUST registrar su procedencia como inferido y
  MUST ser trazable hasta el fragmento de transcripción que lo originó. La procedencia es
  independiente del estado de confirmación: confirmar un antecedente cambia su estado a confirmado
  y MUST NOT alterar su procedencia, salvo que el veterinario la corrija según FR-021 de la spec
  001.
- **FR-032**: Cuando un antecedente extraído contradiga información ya registrada en la ficha o
  dentro de la misma conversación, el sistema MUST presentar la contradicción al veterinario en
  lugar de resolverla por su cuenta.
- **FR-054**: Si la captura de audio no está disponible, el sistema MUST indicarlo con claridad y
  MUST permitir continuar la consulta con registro manual de la anamnesis.
- **FR-055**: El borrador de anamnesis MUST conservar todos los antecedentes extraídos durante la
  sesión, con independencia de su duración, y una interrupción de la captura MUST dejar el borrador
  en un estado definido, sin tramos a medio procesar.
- **FR-068**: Activar la escucha clínica y confirmar un antecedente extraído MUST requerir una
  sesión de acceso activa, y ambas acciones MUST quedar atribuidas a la identidad autenticada que
  las realizó (FR-063, spec 001), que puede ser distinta de la que abrió la consulta.
- **FR-010**: El sistema MUST NOT incorporar automáticamente ninguna salida propia al historial
  clínico como registro definitivo; toda incorporación MUST requerir validación explícita del
  veterinario.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-014 | US6 / 1, 14 |
| FR-025 | US6 / 1, 5 |
| FR-015 | US6 / 2, 13 |
| FR-031 | US6 / 7 |
| FR-016 | US6 / 2 |
| FR-017 | US6 / 3, 4 |
| FR-021 | US6 / 6, 9 |
| FR-032 | US6 / 8 |
| FR-054 | US6 / 10 |
| FR-055 | US6 / 11, 12 |
| FR-068 | US6 / 15 |
| FR-010 | US6 / 4 |

### Key Entities *(include if feature involves data)*

- **Transcripción**: texto derivado del audio capturado en una consulta, segmentado por tramos, con
  una marca de confiabilidad por tramo.
- **Observación clínica**: definida en la spec 002. Aquí se origina en estado borrador a partir de
  la Transcripción, y lleva la referencia al fragmento que la produjo.
- **Sesión de escucha**: periodo de captura dentro de una consulta, con inicio, término y estado. No
  debe confundirse con la *sesión de acceso* de la spec 001.
- **Anamnesis**: definida en la spec 002. Esta spec la puebla en estado borrador.
- **Consulta**: definida en la spec 002. Contenedor obligatorio de toda sesión de escucha.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-004**: Al menos el 70% de los antecedentes clínicos expresados en la conversación simulada es
  identificado correctamente en el borrador de anamnesis.
- **SC-005**: El 100% de la información extraída automáticamente requiere confirmación explícita
  antes de incorporarse a la ficha; ninguna entra de forma silenciosa.
- **SC-016**: La cantidad de antecedentes incorrectamente extraídos que el veterinario debe corregir
  o descartar no supera el 30% de los antecedentes propuestos en la conversación de referencia.
- **SC-048**: El 100% de las confirmaciones de antecedentes extraídos del audio queda atribuido a la
  identidad autenticada de quien confirmó.
- **SC-027**: El 100% de los antecedentes extraídos del audio es trazable hasta el fragmento de
  transcripción que lo originó.
- **SC-028**: El borrador de anamnesis refleja la información de un tramo de captura antes de que
  concluya el tramo siguiente, de modo que el veterinario puede revisarlo durante la consulta y no
  solo al final.

## Assumptions

- **Ventana de captura**: el brief fija como decisión de producto que el procesamiento puede ser
  incremental en ventanas de aproximadamente 30 segundos, sin transcripción en tiempo real. Es una
  cota de latencia aceptable, no una obligación de implementarlo así: FR-015 exige revisabilidad
  durante la consulta y deja abierto el mecanismo.
- **Consentimiento de grabación**: al usarse conversaciones simuladas, el PoC no implementa un flujo
  formal de consentimiento; se cubre con activación explícita e indicación visible de captura. El
  mecanismo formal es una decisión de discovery previa a cualquier uso con tutores reales.
- **Datos sintéticos**: se ejercita con conversaciones simuladas, no con grabaciones de consultas
  reales.
- **Idioma único**: transcripción y extracción en español.
- **Un solo canal de audio**: no se asume separación de hablantes; distinguir quién dijo qué no es
  requisito del PoC.
- **Sin retención de audio como requisito clínico**: el audio se procesa para producir la
  transcripción; su conservación posterior es una decisión de discovery.

### Dependencias

- **Spec 002 (registro clínico longitudinal)**: se requiere una consulta abierta y una anamnesis
  estructurada donde volcar el borrador.
- **Spec 001 (identidad y acceso)**: la activación de la captura y la confirmación de antecedentes
  son operaciones clínicas que escriben en la ficha; exigen sesión activa y quedan atribuidas.
- **Externa — conversación clínica simulada**: material de audio representativo del ambiente de
  consulta, necesario para medir SC-004 y SC-016.
