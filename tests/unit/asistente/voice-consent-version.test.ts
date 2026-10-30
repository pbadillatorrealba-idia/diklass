import { expect, test } from "bun:test";
import { VOICE_CONSENT_VERSION as DEL_CLIENTE } from "@/features/asistente/voice-consent";
import { VOICE_CONSENT_VERSION as DEL_SERVIDOR } from "../../../supabase/functions/_shared/voice-consent";

// El servidor exige la versión vigente del aviso (migración 029): si las constantes derivan, los
// usuarios que aceptaron el aviso actual quedarían bloqueados, o uno anterior seguiría valiendo.
test("la versión del aviso de voz del servidor coincide con la del cliente", () => {
  expect(DEL_SERVIDOR).toBe(DEL_CLIENTE);
});
