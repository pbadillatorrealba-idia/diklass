# Proposal

## Why

El modo de escucha de `captura-voz-anamnesis` ejerce toda la cadena de revisión clínica, pero su
entrada es simulada: `SyntheticCaptureSource` no usa micrófono y `SimulatedTranscriptionAdapter`
devuelve siempre el mismo guion. Para la demo y para medir el riesgo R4 del brief (calidad de la
transcripción) hace falta voz real. Los seams `CaptureSource` y `TranscriptionPort` se dejaron
para esta extensión (D2 · D3 de ese diseño), así que el resto del pipeline no cambia.

## What Changes

- **Captura real de micrófono** detrás de `CaptureSource`: web con `MediaRecorder` y nativo
  (iOS/Android) con `expo-audio`, en ventanas de ~30 s autocontenidas. Permiso denegado o sin
  micrófono se señala por `available()` y conserva el registro manual (FR-054 · US6-AC10).
- **Transcripción real** detrás de `TranscriptionPort`: una Edge Function de Supabase
  (`transcribe-audio`) recibe la ventana, valida sesión y clínica, llama a OpenAI `gpt-transcribe`
  y devuelve texto y calidad. La clave del proveedor vive solo en secretos de la función, nunca
  en el cliente.
- **Audio conservado** en Supabase Storage (bucket privado, acotado por clínica con RLS), enlazado
  a su tramo de transcripción. **BREAKING** respecto del supuesto vigente «Sin retención de
  audio» y del diseño D10 «sin audio».
- **Aviso visible de grabación y de conservación** del audio en la interfaz. Sin política de
  retención: queda documentada como pendiente (PoC con datos sintéticos).
- **Modo simulado conservado** como valor por defecto en pruebas, e2e y CI (sin clave ni
  micrófono); el modo real se elige por configuración de entorno.
- Activar `storage-api` en el stack local y en CI.
- La extracción sigue siendo por reglas (D4); no cambia.

## Capabilities

### New Capabilities

- `asr-real-captura-voz`: captura de audio real, transcripción con proveedor externo y
  conservación del audio por tramo, con su aviso al profesional.

### Modified Capabilities

Ninguna. `captura-voz-anamnesis` aún no está publicada en `openspec/specs/` (su cambio sigue
activo), así que los requisitos que esto enmienda (retención de audio) se registran aquí como
delta propio y se reconcilian al archivar ambos cambios.

## Impact

- **Construcción**: depende de `captura-voz-anamnesis` (archivarlo primero) e
  `identidad-y-acceso`.
- **Código**: `src/features/voz/` (nuevos `microphone-capture-source.*`,
  `remote-transcription-adapter.ts`, selección en `use-listen-mode.ts`), `src/components/voz/`
  (aviso), `supabase/functions/transcribe-audio/`, una migración (columna de audio en
  `transcript_segments` y políticas de Storage), `supabase/config.toml` y `package.json`
  (`db:start` sin `-x storage-api`).
- **Dependencias**: `expo-audio` (solo nativo), justificada en el seguimiento de complejidad del
  diseño. Web y la función usan APIs de plataforma.
- **Operación**: secreto `OPENAI_API_KEY` en la función; coste por uso y envío de audio a un
  tercero, aceptable solo con datos sintéticos.
- **No verificable aquí**: el flujo nativo (permisos y grabación en dispositivo) no puede
  ejercerse en esta máquina; se declara como pendiente de verificación manual.
