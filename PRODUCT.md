# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Una sola app Expo (Expo Router) para iOS, Android y web. La identidad de marca es común; la
navegación, los controles y las convenciones siguen a cada sistema: `NativeTabs` y cabecera nativa
en iOS/Android, barra lateral fija en web desde 1024 px y barra de pestañas inferior en web angosta.

## Users

**Principal:** médico veterinario de una misma clínica, con acceso autenticado. Puede ser
especialista en etología, tener formación parcial o ser generalista que necesita apoyo
especializado. Atiende consultas de etología canina con el tutor y el perro presentes, y mantiene
siempre la responsabilidad clínica.

**Secundaria (confirmada):** evaluadores y comités de fondos de I+D, innovación o transferencia
tecnológica, que ven el PoC en demostraciones. La app debe verse creíble y madura ante ellos, no
solo funcionar.

**Fuera del PoC:** especialistas supervisores, investigadores, administradores de centros,
docentes y estudiantes.

## Product Purpose

Clinical Decision Support System (CDSS) de etología veterinaria para perros. Asiste al veterinario
durante la consulta: registro longitudinal de pacientes y antecedentes, captura y estructuración de
la anamnesis (texto y voz), conocimiento clínico trazable, detección de información faltante, apoyo
al diagnóstico diferencial, al tratamiento y al plan de seguimiento, epicrisis estructurada y
recuperación del historial.

El éxito del PoC es demostrar el flujo clínico completo y generar evidencia técnica y clínica para
postular a fondos. Prioriza el flujo completo sobre la cobertura exhaustiva de conocimiento.

## Positioning

El valor no está solo en el modelo de IA, sino en la combinación: conocimiento especializado de
etología con cita de fuente, protocolo clínico, historial longitudinal del paciente, asistencia
durante la consulta y validación explícita del profesional. Nada de lo que produce el sistema se
convierte en decisión o registro definitivo sin que el veterinario lo valide.

## Operating Context

Flujo clínico: Paciente → Antecedentes → Anamnesis → Información faltante → Diagnóstico
diferencial → Plan / tratamiento → Validación del veterinario → Epicrisis → Seguimiento
longitudinal.

Uso mixto según el momento: computador (escritorio o notebook en el consultorio) para ficha,
epicrisis y consulta de conocimiento; móvil o tablet para la captura de voz y el seguimiento. La
captura de voz procesa el audio en ventanas de unos 30 segundos, no en tiempo real estricto.

## Capabilities and Constraints

- Especie perro; idioma español; una clínica; cuentas provisionadas.
- Siete funcionalidades (specs 001–007 en `docs/brief-poc-cdss.md`): identidad y acceso, registro
  clínico longitudinal, base de conocimiento trazable, captura de voz hacia anamnesis,
  retroalimentación clínica, asistencia clínica proactiva, apoyo al tratamiento y farmacología.
- Requisitos transversales con impacto en la interfaz:
  - toda afirmación documental muestra fuente y fragmento (FR-007);
  - ninguna salida se vuelve decisión sin validación (FR-010);
  - toda información indica su procedencia: reportada, inferida, recuperada o desconocida (FR-021);
  - el sistema declara cuándo la información es insuficiente y cuándo falta respaldo documental
    (FR-022, FR-023);
  - los registros aprobados son inmutables y las correcciones se agregan (FR-024);
  - toda acción clínica queda atribuida a quien la hizo, con su momento (FR-063).
- Stack fijado por `docs/constitution.md`: Expo SDK 57, Expo Router, NativeWind, gluestack-ui v3,
  Supabase. El cambio `openspec/changes/sistema-visual` especifica el sistema de tokens, la escala de
  severidad clínica de 4 niveles y la navegación adaptable.
- Terminología en uso: consulta, anamnesis, antecedentes, epicrisis, seguimiento, tutor, evento
  adverso, severidad (leve, moderado, grave, crítico).
- La autoridad normativa es `docs/constitution.md`; prevalece sobre este archivo.

## Brand Commitments

- **Nombre:** «Diklass», **provisional**. No construir identidad que dependa del nombre. No hay logo
  ni otros activos de marca.
- **Fuente vigente:** Atkinson Hyperlegible Next (OFL 1.1), elegida por legibilidad
  (`assets/fonts/`, `public/fonts/`).
- **Referencias del usuario** (2026-09-30), para calibrar el registro, no para copiar:
  - IDEXX VetConnect PLUS Decision IQ:
    https://www.idexx.com/en/veterinary/software-services/vetconnect-plus/decision-iq/
  - Vetspire AI Diagnosis Assistant:
    https://manual.vetspire.com/vetspire-user-manual/ok/Commercial/about-ai-diagnosis-assistant
  - Directriz explícita: que no se parezca demasiado a ellas; identidad propia pero profesional.

## Evidence on Hand

- Solo existen veterinarios sintéticos (`bun run provision:veterinarians`) y datos de desarrollo.
  No hay pacientes reales, testimonios, clínicas cliente, métricas de resultado ni validación
  clínica publicada. No inventarlos.
- Las fuentes clínicas de la base de conocimiento dependen de conseguir documentos legalmente
  utilizables (riesgo principal de la spec 003). No mostrar fuentes ficticias como reales.

## Product Principles

1. **El veterinario decide.** El sistema sugiere; toda salida se distingue visiblemente de lo
   validado y requiere confirmación explícita.
2. **Todo tiene procedencia.** Cada dato muestra de dónde viene: reportado, inferido, recuperado
   con cita o desconocido. La falta de respaldo se declara, no se oculta.
3. **La consulta no espera.** La interfaz acompaña una consulta en curso con tutor y perro
   presentes: rápida de leer y sin fricción.
4. **Longitudinal por defecto.** El paciente se entiende en su historia: consultas, tratamientos,
   evolución y respuesta clínica.
5. **Credibilidad demostrable.** Debe sostener una demostración ante evaluadores: madura, coherente
   y honesta sobre lo que es un PoC.

## Accessibility & Inclusion

WCAG 2.2 AA como compuerta de integración (constitución): teclado en todo control, etiquetas
programáticas, foco visible y contraste suficiente, en modo claro y oscuro. Interfaces adaptables
en todo el rango de viewport, sin saltos de maquetación en el primer pintado. Distinciones clínicas
críticas (severidad, sugerido frente a validado) nunca solo por color.
