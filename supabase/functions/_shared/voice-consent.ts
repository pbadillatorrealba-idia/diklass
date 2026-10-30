/**
 * Versión vigente del aviso de voz que el servidor exige aceptado (`consume_assistant_audio_quota`,
 * migración 029). Debe coincidir con `VOICE_CONSENT_VERSION` del cliente: lo ata
 * `tests/unit/asistente/voice-consent-version.test.ts`. Al subirla, súbela en ambos sitios.
 */
export const VOICE_CONSENT_VERSION = "v1";
