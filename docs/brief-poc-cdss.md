# Brief de producto — CDSS de Etología Veterinaria Canina (PoC)

**Creado**: 2026-09-09
**Estado**: Vigente
**Naturaleza**: Documento de contexto de producto. **No es una especificación de funcionalidad** y
no se implementa directamente. Las specs de `specs/` lo referencian en lugar de repetirlo.

## 1. Propósito

Desarrollar un Proof of Concept de un Clinical Decision Support System especializado en etología
veterinaria, orientado inicialmente a la atención clínica de perros.

El sistema asiste al médico veterinario durante la consulta mediante registro estructurado de
pacientes y antecedentes, captura y estructuración de la anamnesis, consulta de conocimiento clínico
especializado, identificación de información faltante, apoyo a la construcción de diagnósticos
diferenciales, apoyo a la formulación de tratamientos y planes de seguimiento, generación de
epicrisis estructurada, recuperación del historial de sesiones anteriores e interacción
conversacional por texto y voz.

El sistema no reemplaza al médico veterinario ni realiza diagnósticos ni prescripciones de forma
autónoma. Toda recomendación clínica es apoyo a la decisión y queda sujeta a validación explícita
del profesional.

El PoC debe validar la factibilidad técnica y clínica del concepto y generar evidencia suficiente
para una posterior postulación a fondos de I+D, innovación o transferencia tecnológica.

## 2. Problema

La información necesaria para apoyar consultas de etología veterinaria está distribuida entre
protocolos clínicos, manuales, literatura científica, libros especializados, vademécums
farmacológicos, regulaciones, bases de datos públicas, experiencia acumulada de especialistas y
antecedentes históricos de cada paciente.

Aunque buena parte de esa información es pública, consultarla durante una atención clínica es lento
y poco práctico. Al mismo tiempo, atender a un paciente exige integrar información longitudinal:
antecedentes generales, consultas anteriores, tratamientos aplicados, evolución, respuesta clínica y
hallazgos nuevos.

Esto dificulta particularmente que veterinarios sin especialización formal en etología incorporen
evidencia y protocolos especializados durante su práctica.

## 3. Hipótesis de producto

Un CDSS que integre información clínica longitudinal del paciente, conocimiento veterinario
especializado y trazable, una interfaz conversacional, captura asistida de la conversación clínica y
razonamiento clínico supervisado por el veterinario puede reducir el esfuerzo de recopilar
información relevante, mejorar la consistencia de la anamnesis y facilitar el acceso oportuno a
conocimiento especializado.

El valor diferencial no está únicamente en el modelo de IA, sino en la combinación de conocimiento
especializado, protocolo clínico, historial longitudinal, interacción durante la consulta,
retroalimentación del profesional y datos clínicos acumulados.

## 4. Usuarios

**Usuario principal**: médico veterinario, que puede ser especialista en etología, tener formación
parcial en el área, o ser generalista requiriendo apoyo especializado. El profesional mantiene
siempre la responsabilidad sobre las decisiones clínicas.

**Usuarios futuros**, fuera del alcance del PoC: especialistas que supervisen casos, investigadores,
administradores de centros veterinarios, docentes y estudiantes de medicina veterinaria.

## 5. Alcance del PoC

Especie perro; usuarios médicos veterinarios de una misma clínica, con acceso autenticado; contexto
consulta clínica de etología; idioma español;
conjunto acotado de fuentes clínicas previamente seleccionadas; registro longitudinal de pacientes;
asistencia por texto, con captura por voz de la conversación clínica; aplicación accesible desde computador y, de ser viable, móvil.

La prioridad es demostrar el flujo clínico completo antes que alcanzar cobertura exhaustiva de
conocimiento veterinario.

**Decisión de producto sobre la captura por voz**: el procesamiento del audio puede ser incremental,
en ventanas de aproximadamente 30 segundos, sin exigir transcripción completamente en tiempo real.
Proviene de la descripción original del producto y acota la expectativa de latencia de la spec 003.

## 6. Flujo clínico principal

```text
Paciente → Antecedentes clínicos → Anamnesis → Identificación de información faltante
        → Apoyo al diagnóstico diferencial → Plan clínico / tratamiento
        → Validación del veterinario → Epicrisis → Seguimiento longitudinal
```

## 7. Mapa de especificaciones

El PoC se especifica en seis funcionalidades. Cada una es independientemente construible y
verificable; ninguna depende de que las posteriores existan.

| Spec | Alcance | Depende de |
|---|---|---|
| [007 — Identidad y acceso](../specs/007-identidad-y-acceso/spec.md) | Cuentas provisionadas, acceso autenticado, atribución verificable de acciones clínicas, clínica compartida | — |
| [001 — Registro clínico longitudinal](../specs/001-registro-clinico-longitudinal/spec.md) | Ficha de paciente y tutor, consulta, anamnesis estructurada, epicrisis validada, seguimiento entre consultas | 007 |
| [002 — Base de conocimiento trazable](../specs/002-base-conocimiento-trazable/spec.md) | Colección documental, recuperación, citación de fuentes, separación dato/inferencia | 001 |
| [003 — Captura de voz hacia anamnesis](../specs/003-captura-voz-anamnesis/spec.md) | Modo de escucha clínica, transcripción incremental, extracción a borrador confirmable | 001 |
| [004 — Asistencia clínica proactiva](../specs/004-asistencia-clinica-proactiva/spec.md) | Identificación de información faltante, apoyo al diagnóstico diferencial | 001, 002, 007 |
| [005 — Apoyo al tratamiento y farmacología](../specs/005-apoyo-tratamiento-farmacologia/spec.md) | Alternativas de manejo, restricciones farmacológicas, dosis para validación | 001, 002, 004, 007 |
| [006 — Retroalimentación clínica](../specs/006-retroalimentacion-clinica/spec.md) | Registro estructurado de evolución, adherencia y eventos adversos | 001, 007 |

**Aristas de dependencia** (origen → destino significa "el destino necesita al origen"):

```text
007 → 001      007 → 004      007 → 005      007 → 006
001 → 002      001 → 003      001 → 004      001 → 005      001 → 006
002 → 004      002 → 005      004 → 005
```

**Orden de construcción**: 007 primero, luego 001. Después 002, 003 y 006 en cualquier orden,
incluso en paralelo. Luego 004, que necesita 002. Por último 005, que necesita 001, 002, 004 y 007.

Los números identifican specs, no ordenan su construcción: la 007 se añadió después de las demás y
se construye antes que todas.

002 y 003 pueden construirse en paralelo tras 001. El riesgo de calendario se concentra en 002: es
el único que depende de conseguir documentos clínicos legalmente utilizables, y de él cuelgan 004 y
005.

### Convención de identificadores

Los identificadores `FR-NNN` y `SC-NNN` son **únicos a nivel de familia de specs**, no locales a
cada archivo: un número designa siempre el mismo requisito, en cualquier spec donde aparezca.

Un requisito transversal aparece en varias specs. En cada una se enuncia **aplicado a esa
funcionalidad**, no copiado palabra por palabra: FR-021 (separación entre dato e inferencia) habla
de la procedencia de los antecedentes escritos a mano en la spec 001 y de los extraídos del audio en
la 003, pero es la misma obligación. El enunciado canónico de cada requisito transversal es el de
esta tabla; las specs lo especializan sin poder contradecirlo.

| Requisito | Enunciado canónico | Specs |
|---|---|---|
| FR-007 | Toda afirmación clínica basada en conocimiento documental muestra el documento fuente y el fragmento utilizado | 002, 004, 005 |
| FR-010 | Ninguna salida del sistema se convierte automáticamente en decisión clínica ni en registro definitivo sin validación del veterinario | 001, 003, 004, 005 |
| FR-020 | Es posible reconstruir qué información del paciente y qué fuentes documentales produjeron una recomendación clínica relevante | 002, 004, 005 |
| FR-021 | Toda información clínica indica su procedencia: reportada, inferida, recuperada de una fuente, o desconocida | 001, 002, 003 |
| FR-022 | El sistema comunica explícitamente cuándo la información disponible es insuficiente | 002, 004 |
| FR-023 | El sistema declara explícitamente la ausencia de respaldo documental y nunca presenta como respaldada una afirmación sin cita | 002, 004, 005 |
| FR-024 | Los registros clínicos aprobados se preservan sin modificación; toda corrección genera un registro adicional | 001, 006 |

Cada spec incluye además una tabla de **trazabilidad de requisitos** que asocia cada `FR` a los
escenarios de aceptación que lo verifican.

## 8. Criterios de éxito del PoC

Transversales a todas las specs. Los criterios propios de cada funcionalidad viven en su spec.

- **SC-001**: Un veterinario completa el escenario demostrador de extremo a extremo sin intervención
  de un desarrollador: acceder con su cuenta, registrar un perro, abrir consulta, activar captura de voz, sostener una
  conversación simulada con el tutor, obtener antecedentes estructurados, identificar información
  faltante, consultar conocimiento especializado, recibir evidencia citada, revisar hipótesis
  clínicas, registrar su decisión, registrar un tratamiento, corregir y aprobar la epicrisis, cerrar
  la consulta, y en una segunda consulta recuperar la epicrisis anterior para apoyar el seguimiento.
- **SC-008**: Una consulta completa del escenario demostrador se realiza en un tiempo comparable al
  de una consulta sin el sistema, con un aumento no superior al 20%.

> **Nota sobre SC-007**: el criterio original de evaluación por especialistas se descompuso en cuatro
> criterios ubicados en la spec que cada uno evalúa: SC-013 (utilidad de la epicrisis, spec 001),
> SC-015 (utilidad de la información recuperada, spec 002), SC-017 (pertinencia de las preguntas
> sugeridas, spec 004) y SC-018 (utilidad de los diagnósticos diferenciales, spec 004). El
> identificador SC-007 queda retirado para evitar ambigüedad.

## 9. Métricas iniciales de validación

**Recuperación de información**: proporción de consultas donde se recupera evidencia relevante;
precisión de las referencias entregadas. Medido por SC-002 y SC-003.

**Extracción desde conversación**: proporción de antecedentes clínicos correctamente identificados;
información incorrectamente incorporada; correcciones realizadas por el veterinario. Medido por
SC-004, SC-005 y SC-016.

**Utilidad clínica**: evaluación por especialistas de la pertinencia de las preguntas sugeridas, la
utilidad de la información recuperada, de los diagnósticos diferenciales y de la epicrisis generada.
Medido por SC-013, SC-015, SC-017 y SC-018.

**Experiencia de uso**: tiempo requerido para completar una consulta, cantidad de interacciones
manuales, percepción de carga cognitiva y satisfacción del veterinario. Medido por SC-008.

## 10. Escenario demostrador

Para mantener acotado el PoC se selecciona uno o pocos casos clínicos representativos. Un buen
candidato es un caso de comportamiento canino con cobertura suficiente en los protocolos
seleccionados.

El escenario contiene paciente ficticio, tutor ficticio, antecedentes previos, conversación
simulada, información inicialmente incompleta, antecedentes que permitan construir varios
diagnósticos diferenciales, tratamiento potencial y seguimiento posterior.

El objetivo no es demostrar cobertura completa de la etología veterinaria, sino que el enfoque
funciona de extremo a extremo.

## 11. Requisitos de seguridad clínica

Estos ocho principios atraviesan todas las specs y están traducidos a requisitos verificables en
cada una de ellas.

1. **Human-in-the-loop**: el veterinario toma siempre la decisión clínica final, y esa decisión
   queda atribuida a su identidad autenticada. → FR-010, FR-063
2. **Trazabilidad**: las recomendaciones relevantes deben poder explicarse y asociarse a evidencia.
   → FR-007, FR-020
3. **Separación entre dato e inferencia**: debe ser evidente qué información entregó el usuario y
   qué infirió el sistema. → FR-021
4. **Incertidumbre explícita**: el sistema comunica cuando no posee información suficiente. → FR-022
5. **No inventar evidencia**: una recomendación sin respaldo documental debe indicarlo. → FR-023
6. **No prescripción autónoma**: ninguna recomendación farmacológica se convierte automáticamente en
   prescripción. → FR-019
7. **Validación de registros**: la información extraída automáticamente no se incorpora
   silenciosamente a la ficha. → FR-017
8. **Persistencia del historial**: una consulta nueva no sobrescribe el registro histórico. → FR-024

## 12. Privacidad y datos

El sistema manejará información potencialmente sensible de profesionales, tutores, animales,
registros clínicos y conversaciones de consulta.

El PoC incorpora **autenticación y autorización** (spec 007): las cuentas se provisionan, el acceso
es autenticado y toda acción clínica queda atribuida a su autor. No incorpora trazabilidad de
accesos —se registra quién escribe, no quién lee— ni aislamiento de información entre profesionales,
por ser una clínica compartida.

Una implementación posterior deberá considerar además cifrado, políticas de retención, eliminación
de datos, consentimiento para grabación, trazabilidad de accesos, respaldo, y anonimización o
seudonimización para investigación.

Durante el PoC se minimiza el uso de datos personales reales y se privilegian casos sintéticos o
debidamente autorizados.

## 13. Fuera del alcance del PoC

Diagnóstico autónomo; prescripción automática; aprendizaje continuo del modelo; entrenamiento de
modelos fundacionales; gatos u otras especies; internacionalización efectiva; integración con bases
del SAG, laboratorios clínicos u otras instituciones; análisis automático de radiografías o imágenes
médicas; interpretación automática de exámenes; OCR clínico avanzado; facturación; pagos; agenda
veterinaria; plataforma educacional; comunidad de especialistas; investigación sobre datos
agregados; aplicación completa de producción; soporte multi-clínica; y multi-tenancy empresarial.

Del sistema de usuarios quedan fuera el autoregistro, la recuperación de contraseña, los roles
diferenciados y la trazabilidad de accesos; el PoC provisiona las cuentas y registra quién escribe,
no quién lee.

También queda fuera del alcance **preguntar al asistente por voz y recibir respuesta hablada**. La
voz entra al PoC únicamente como captura de la conversación entre veterinario y tutor (spec 003);
la interacción con el asistente es por texto (spec 002). El escenario demostrador SC-001 no requiere
la modalidad hablada. Es una reducción deliberada de alcance respecto de la descripción original,
que hablaba de "interacción conversacional mediante texto y voz".

## 14. Evolución esperada

```text
┌─────────────────────────────────────────┐
│        Instituto / formación            │
│ Educación · investigación · evidencia   │
├─────────────────────────────────────────┤
│        Inteligencia agregada            │
│ Resultados · cohortes · investigación   │
├─────────────────────────────────────────┤
│        Clinical Decision Support        │
│ Protocolos · evidencia · seguimiento    │
├─────────────────────────────────────────┤
│        Registro clínico longitudinal    │
│ Pacientes · consultas · tratamientos    │
└─────────────────────────────────────────┘
```

El PoC se concentra en las dos capas inferiores.

**Fase 2 — MVP**: autoregistro y gestión de cuentas, roles diferenciados, trazabilidad de accesos,
gestión robusta de pacientes, base de conocimiento ampliada, integración con fuentes externas,
controles de privacidad, analítica básica y experiencia móvil consolidada.

La autenticación y el soporte de múltiples veterinarios se adelantaron a la Fase 1: sin identidad
verificada, la atribución de responsabilidad clínica que el PoC debe validar no es demostrable.

**Fase 3 — Producto**: multi-clínica, múltiples especies, regulaciones por país, integración con SAG
y otras instituciones, lectura estructurada de exámenes, OCR, análisis multimodal, investigación
sobre datos agregados y herramientas educativas.

## 15. Riesgos a validar

- **R1 — Calidad de la evidencia**: si las fuentes disponibles contienen información suficientemente
  estructurada y actualizada para sustentar el sistema. Afecta spec 002.
- **R2 — Calidad de la recuperación**: si es posible recuperar fragmentos clínicamente relevantes
  con precisión suficiente. Afecta spec 002.
- **R3 — Alucinaciones**: con qué frecuencia el sistema genera información clínica no respaldada.
  Afecta specs 002, 004, 005.
- **R4 — Captura mediante voz**: si la transcripción de conversaciones reales tiene calidad
  suficiente en ambientes clínicos. Afecta spec 003.
- **R5 — Extracción estructurada**: si el sistema distingue correctamente antecedentes expresados,
  inferidos y faltantes. Afecta specs 001, 003.
- **R6 — Experiencia clínica**: si usar el sistema durante una consulta reduce o aumenta la carga
  del veterinario. Afecta a todas.
- **R7 — Responsabilidad clínica**: qué mecanismos son necesarios para que recomendaciones,
  diagnósticos y tratamientos permanezcan bajo responsabilidad profesional. Afecta specs 004, 005.
- **R8 — Propiedad intelectual**: qué componentes del sistema, metodología, proceso clínico o
  arquitectura podrían constituir propiedad intelectual protegible. Transversal.

## 16. Preguntas abiertas de discovery

Estas decisiones se resuelven durante discovery y **no bloquean** la construcción inicial del PoC.

1. ¿Qué protocolos clínicos serán las fuentes oficiales iniciales?
2. ¿Qué versión del Protocolo Barcelona se utilizará?
3. ¿Qué vademécum puede utilizarse legalmente?
4. ¿Qué información del SAG puede obtenerse mediante APIs o datasets?
5. ¿Qué categorías clínicas específicas cubrirá el PoC?
6. ¿Cuál será el caso clínico demostrador definitivo?
7. ¿Qué información será obligatoria en una ficha?
8. ¿Qué información puede capturarse automáticamente desde audio?
9. ¿Cómo se representará formalmente la aprobación del veterinario?
10. ¿Qué información clínica debe versionarse?
11. ¿Qué datos podrán utilizarse posteriormente para investigación?
12. ¿Qué consentimiento será necesario para grabar consultas?
13. ¿Qué componentes del proceso podrían ser objeto de protección intelectual?
14. ¿Cuál será la institución responsable del tratamiento de los datos en fases posteriores?

## 17. Dependencias externas

- **Fuentes clínicas**: conjunto acotado de documentos de etología veterinaria legalmente
  utilizables. Sin ellos, las specs 002, 004 y 005 no son evaluables aunque estén construidas.
- **Participación de especialistas**: necesaria para los criterios de utilidad clínica.
- **Conversación clínica simulada**: material de audio representativo del ambiente de consulta,
  necesario para la spec 003.

## 18. Principio rector

> **La IA organiza, recupera, contrasta y propone. El médico veterinario observa, evalúa y decide.**

El objetivo del sistema no es automatizar al profesional, sino aumentar su capacidad de acceder y
utilizar información clínica especializada durante el proceso de atención.
