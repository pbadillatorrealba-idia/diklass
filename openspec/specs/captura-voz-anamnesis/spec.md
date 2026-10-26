# captura-voz-anamnesis Specification

## Purpose
modo de escucha clínica del PoC de CDSS de etología veterinaria canina — captura de audio de la conversación entre veterinario y tutor durante la consulta, transcripción incremental por tramos, extracción de información clínicamente relevante hacia un borrador estructurado de anamnesis, y confirmación explícita antecedente por antecedente antes de incorporar nada a la ficha.

**Created**: 2026-09-09

**Status**: Draft — pendiente de aceptación

**Contexto de producto**: [Brief del PoC](../../../../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: FR/SC conservan su identidad global. Los requisitos transversales comparten ID y pueden especializarse por dominio sin contradecir la obligación canónica del brief.

## Requirements

### Requirement: FR-014

El sistema MUST permitir capturar audio de la conversación durante una consulta,
  mediante activación explícita del veterinario, y MUST NOT iniciar la captura sin una consulta
  abierta a la cual asociarla.

#### Scenario: US6-AC1

- **GIVEN** una consulta abierta
- **WHEN** el veterinario activa el modo de escucha clínica
- **THEN** el sistema indica de forma visible que está capturando audio.

#### Scenario: US6-AC14

- **GIVEN** que no hay ninguna consulta abierta
- **WHEN** el veterinario intenta activar la escucha clínica
- **THEN** el sistema no inicia la captura.

### Requirement: FR-025

El sistema MUST indicar de forma visible mientras la captura de audio está activa, y
  MUST permitir detenerla en cualquier momento.

#### Scenario: US6-AC1

- **GIVEN** una consulta abierta
- **WHEN** el veterinario activa el modo de escucha clínica
- **THEN** el sistema indica de forma visible que está capturando audio.

#### Scenario: US6-AC5

- **GIVEN** el modo de escucha activo
- **WHEN** el veterinario lo detiene
- **THEN** la captura de audio cesa y el sistema lo indica.

### Requirement: FR-015

El sistema MUST transcribir a texto la conversación capturada de forma incremental
  durante la consulta, de modo que el veterinario pueda revisar lo transcrito mientras la consulta
  transcurre y no solo al terminarla. No se exige transcripción en tiempo real.

#### Scenario: US6-AC2

- **GIVEN** el modo de escucha activo
- **WHEN** transcurre una ventana de captura de aproximadamente 30 segundos
- **THEN** el sistema transcribe ese tramo y actualiza el borrador de anamnesis con la información clínica que haya identificado.

#### Scenario: US6-AC13

- **GIVEN** el modo de escucha activo
- **WHEN** transcurre la consulta
- **THEN** el veterinario puede revisar lo transcrito mientras la consulta ocurre, sin esperar a que termine.

### Requirement: FR-031

El sistema MUST señalar los tramos cuya transcripción tenga calidad insuficiente y
  MUST NOT derivar antecedentes clínicos a partir de ellos.

#### Scenario: US6-AC7

- **GIVEN** un tramo de audio de calidad insuficiente
- **WHEN** el sistema lo procesa
- **THEN** lo señala como no confiable en lugar de derivar antecedentes de él.

### Requirement: FR-016

El sistema MUST identificar información clínicamente relevante a partir de la
  transcripción y volcarla en un borrador estructurado de anamnesis.

#### Scenario: US6-AC2

- **GIVEN** el modo de escucha activo
- **WHEN** transcurre una ventana de captura de aproximadamente 30 segundos
- **THEN** el sistema transcribe ese tramo y actualiza el borrador de anamnesis con la información clínica que haya identificado.

### Requirement: FR-017

La información obtenida automáticamente MUST permanecer como borrador y MUST requerir
  confirmación explícita del veterinario, antecedente por antecedente, antes de incorporarse a la
  ficha clínica.

#### Scenario: US6-AC3

- **GIVEN** un borrador poblado automáticamente
- **WHEN** el veterinario revisa lo extraído
- **THEN** puede aceptar, corregir o descartar cada antecedente por separado antes de guardarlo.

#### Scenario: US6-AC4

- **GIVEN** información extraída no confirmada
- **WHEN** se cierra la consulta
- **THEN** esa información no forma parte de la anamnesis definitiva.

### Requirement: FR-021

Todo antecedente proveniente del audio MUST registrar su procedencia como inferido y
  MUST ser trazable hasta el fragmento de transcripción que lo originó. La procedencia es
  independiente del estado de confirmación: confirmar un antecedente cambia su estado a confirmado
  y MUST NOT alterar su procedencia, salvo que el veterinario la corrija según FR-021 de la spec
  002 (registro clínico longitudinal).

#### Scenario: US6-AC6

- **GIVEN** un antecedente extraído del audio
- **WHEN** el veterinario lo revisa
- **THEN** puede ver el fragmento de la transcripción del cual proviene.

#### Scenario: US6-AC9

- **GIVEN** un antecedente extraído del audio
- **WHEN** el veterinario lo revisa antes de confirmarlo
- **THEN** aparece con procedencia inferida, y al confirmarlo su procedencia no cambia.

### Requirement: FR-032

Cuando un antecedente extraído contradiga información ya registrada en la ficha o
  dentro de la misma conversación, el sistema MUST presentar la contradicción al veterinario en
  lugar de resolverla por su cuenta.

#### Scenario: US6-AC8

- **GIVEN** un antecedente extraído que contradice información ya registrada en la ficha
- **WHEN** se presenta el borrador
- **THEN** el sistema muestra la contradicción en lugar de sobrescribir el dato previo.

### Requirement: FR-054

Si la captura de audio no está disponible, el sistema MUST indicarlo con claridad y
  MUST permitir continuar la consulta con registro manual de la anamnesis.

#### Scenario: US6-AC10

- **GIVEN** que el sistema no puede acceder al micrófono
- **WHEN** el veterinario intenta activar la escucha
- **THEN** el sistema lo indica y permite registrar la anamnesis manualmente.

### Requirement: FR-055

El borrador de anamnesis MUST conservar todos los antecedentes extraídos durante la
  sesión, con independencia de su duración, y una interrupción de la captura MUST dejar el borrador
  en un estado definido, sin tramos a medio procesar.

#### Scenario: US6-AC11

- **GIVEN** una consulta larga con captura activa
- **WHEN** el veterinario revisa el borrador al final
- **THEN** conserva los antecedentes extraídos en los primeros tramos.

#### Scenario: US6-AC12

- **GIVEN** una captura interrumpida a mitad de un tramo
- **WHEN** el sistema se detiene
- **THEN** el borrador queda en un estado definido y ningún tramo permanece a medio procesar.

### Requirement: FR-068

Activar la escucha clínica y confirmar un antecedente extraído MUST requerir una
  sesión de acceso activa, y ambas acciones MUST quedar atribuidas a la identidad autenticada que
  las realizó (FR-063, spec 001), que puede ser distinta de la que abrió la consulta.

#### Scenario: US6-AC15

- **GIVEN** un antecedente extraído del audio
- **WHEN** lo confirma un veterinario distinto del que abrió la consulta
- **THEN** queda registrado quién lo confirmó y cuándo.

### Requirement: FR-010

El sistema MUST NOT incorporar automáticamente ninguna salida propia al historial
  clínico como registro definitivo; toda incorporación MUST requerir validación explícita del
  veterinario.

#### Scenario: US6-AC4

- **GIVEN** información extraída no confirmada
- **WHEN** se cierra la consulta
- **THEN** esa información no forma parte de la anamnesis definitiva.
