import { beforeAll, describe, expect, test } from "bun:test";
import { deleteConversation } from "@/features/asistente/message-service";
import {
  ANA,
  adminClient,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

/**
 * Audio de los mensajes del chat (asistente-conversacional «Conservación del audio por 90 días» y
 * «Acceso y purga del audio» · design.md D5 · D6 · tarea 7.2). Suite viva: necesita `supabase start`,
 * las migraciones 022 y 023 y las veterinarias sintéticas. Las pruebas de Storage necesitan además el
 * servicio de Storage sano.
 */
const BUCKET = "assistant-audio";
const audio = () => new Blob([new Uint8Array(2048)], { type: "audio/webm" });

describe.skipIf(!isLiveSupabase)("audio del chat (migración 023)", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;

  const ruta = (vet: LiveVeterinarian, id: string, ext = "webm") =>
    `${vet.clinicId}/${vet.userId}/${id}.${ext}`;
  const mensajeConAudio = (vet: LiveVeterinarian, id: string, audioPath: string | null) => ({
    id,
    clinic_id: vet.clinicId,
    author_id: vet.userId,
    role: "user",
    status: "done",
    audio_path: audioPath,
    parts: [
      {
        type: "audio",
        durationMs: 5000,
        transcript: "lo que dije",
        audioPath,
        audioState: "ready",
      },
    ],
  });

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);
    await deleteConversation(ana.client);
    await deleteConversation(bruno.client);
  });

  describe("el mensaje con audio (base de datos)", () => {
    test("con la ruta canónica se acepta y el servidor fija el vencimiento a 90 días", async () => {
      const id = crypto.randomUUID();
      const { error } = await ana.client
        .from("assistant_messages")
        .insert(mensajeConAudio(ana, id, ruta(ana, id)));
      expect(error).toBeNull();
      const { data } = await ana.client
        .from("assistant_messages")
        .select("created_at, audio_expires_at")
        .eq("id", id)
        .single();
      const dias =
        (new Date(data?.audio_expires_at ?? 0).getTime() -
          new Date(data?.created_at ?? 0).getTime()) /
        86_400_000;
      expect(Math.round(dias)).toBe(90);
    });

    test.each([
      [
        "otra ruta de la misma persona",
        (id: string, v: LiveVeterinarian) => ruta(v, crypto.randomUUID()),
      ],
      ["la ruta de otro autor", (id: string, _v: LiveVeterinarian) => ruta(bruno, id)],
      ["una extensión no permitida", (id: string, v: LiveVeterinarian) => ruta(v, id, "mp3")],
      [
        "una ruta con salto de carpeta",
        (id: string, v: LiveVeterinarian) => `${v.clinicId}/../${id}.webm`,
      ],
    ])("una ruta que no es la canónica (%s) se rechaza", async (_nombre, hacer) => {
      const id = crypto.randomUUID();
      const { error } = await ana.client
        .from("assistant_messages")
        .insert(mensajeConAudio(ana, id, hacer(id, ana)));
      expect(error).not.toBeNull();
    });
  });

  describe("«Eliminar audio» (remove_assistant_audio)", () => {
    test("devuelve la ruta, quita el audio y conserva la transcripción", async () => {
      const id = crypto.randomUUID();
      const path = ruta(ana, id);
      await ana.client.from("assistant_messages").insert(mensajeConAudio(ana, id, path));

      const { data: devuelta, error } = await ana.client.rpc("remove_assistant_audio", {
        p_message_id: id,
      });
      expect(error).toBeNull();
      expect(devuelta).toBe(path);

      const { data } = await ana.client
        .from("assistant_messages")
        .select("audio_path, audio_expires_at, parts")
        .eq("id", id)
        .single();
      expect(data?.audio_path).toBeNull();
      expect(data?.audio_expires_at).toBeNull();
      expect(data?.parts).toEqual([
        {
          type: "audio",
          durationMs: 5000,
          transcript: "lo que dije",
          audioPath: null,
          audioState: "deleted",
        },
      ]);
    });

    test("una segunda vez no devuelve nada", async () => {
      const id = crypto.randomUUID();
      await ana.client.from("assistant_messages").insert(mensajeConAudio(ana, id, ruta(ana, id)));
      await ana.client.rpc("remove_assistant_audio", { p_message_id: id });
      const { data } = await ana.client.rpc("remove_assistant_audio", { p_message_id: id });
      expect(data).toBeNull();
    });

    test("otro veterinario no puede quitar el audio de un mensaje ajeno", async () => {
      const id = crypto.randomUUID();
      const path = ruta(ana, id);
      await ana.client.from("assistant_messages").insert(mensajeConAudio(ana, id, path));
      const { data } = await bruno.client.rpc("remove_assistant_audio", { p_message_id: id });
      expect(data).toBeNull();
      const { data: sigue } = await ana.client
        .from("assistant_messages")
        .select("audio_path")
        .eq("id", id)
        .single();
      expect(sigue?.audio_path).toBe(path);
    });

    test("un mensaje sin audio no devuelve nada", async () => {
      const id = crypto.randomUUID();
      await ana.client.from("assistant_messages").insert({
        id,
        clinic_id: ana.clinicId,
        author_id: ana.userId,
        role: "user",
        status: "done",
        parts: [{ type: "text", text: "solo texto" }],
      });
      const { data } = await ana.client.rpc("remove_assistant_audio", { p_message_id: id });
      expect(data).toBeNull();
    });
  });

  // Estas necesitan el servicio de Storage sano (la API de objetos).
  describe("Storage", () => {
    test("el autor sube bajo su prefijo y no bajo el de otro", async () => {
      const id = crypto.randomUUID();
      const propio = await ana.client.storage.from(BUCKET).upload(ruta(ana, id), audio());
      expect(propio.error).toBeNull();
      const ajeno = await ana.client.storage
        .from(BUCKET)
        .upload(ruta(bruno, crypto.randomUUID()), audio());
      expect(ajeno.error).not.toBeNull();
      const otraClinica = await ana.client.storage
        .from(BUCKET)
        .upload(`${crypto.randomUUID()}/${ana.userId}/${id}.webm`, audio());
      expect(otraClinica.error).not.toBeNull();
      await ana.client.storage.from(BUCKET).remove([ruta(ana, id)]);
    });

    test("solo el autor firma una URL de su audio vigente", async () => {
      const id = crypto.randomUUID();
      const path = ruta(ana, id);
      await ana.client.storage.from(BUCKET).upload(path, audio());
      await ana.client.from("assistant_messages").insert(mensajeConAudio(ana, id, path));

      const propia = await ana.client.storage.from(BUCKET).createSignedUrl(path, 60);
      expect(propia.error).toBeNull();
      expect(propia.data?.signedUrl).toBeTruthy();

      const ajena = await bruno.client.storage.from(BUCKET).createSignedUrl(path, 60);
      expect(ajena.data?.signedUrl ?? null).toBeNull();
    });

    test("pasado el vencimiento no se firma URL, aunque el archivo siga ahí", async () => {
      const id = crypto.randomUUID();
      const path = ruta(ana, id);
      await ana.client.storage.from(BUCKET).upload(path, audio());
      await ana.client.from("assistant_messages").insert(mensajeConAudio(ana, id, path));
      // Control positivo: antes del vencimiento sí se firma (si no, el rechazo de abajo no probaría nada).
      const vigente = await ana.client.storage.from(BUCKET).createSignedUrl(path, 60);
      expect(vigente.data?.signedUrl).toBeTruthy();
      // Solo el servicio puede envejecer el reloj: el cliente no tiene UPDATE.
      const { error } = await adminClient()
        .from("assistant_messages")
        .update({ audio_expires_at: new Date(Date.now() - 86_400_000).toISOString() })
        .eq("id", id);
      expect(error).toBeNull();

      const vencida = await ana.client.storage.from(BUCKET).createSignedUrl(path, 60);
      expect(vencida.data?.signedUrl ?? null).toBeNull();
    });

    // Un envío fallido o «No se entendió» deja un objeto SIN mensaje: su autor debe poder borrarlo.
    test("el autor borra un objeto huérfano (sin mensaje) y otro veterinario no lo ve", async () => {
      const id = crypto.randomUUID();
      const path = ruta(ana, id);
      expect((await ana.client.storage.from(BUCKET).upload(path, audio())).error).toBeNull();
      const ajena = await bruno.client.storage.from(BUCKET).createSignedUrl(path, 60);
      expect(ajena.data?.signedUrl ?? null).toBeNull();
      const borrado = await ana.client.storage.from(BUCKET).remove([path]);
      expect(borrado.error).toBeNull();
      expect(borrado.data ?? []).toHaveLength(1);
    });

    test("el autor borra su objeto y otro veterinario no puede borrarlo", async () => {
      const id = crypto.randomUUID();
      const path = ruta(ana, id);
      await ana.client.storage.from(BUCKET).upload(path, audio());

      const ajeno = await bruno.client.storage.from(BUCKET).remove([path]);
      // La API devuelve la lista de objetos borrados: ninguno si la política lo impide.
      expect(ajeno.data ?? []).toHaveLength(0);

      const propio = await ana.client.storage.from(BUCKET).remove([path]);
      expect(propio.error).toBeNull();
      expect(propio.data ?? []).toHaveLength(1);
    });

    // Sin tope, un usuario podría llenar el bucket con archivos de 5 MiB hasta la purga.
    test("un autor no puede tener más de 100 objetos de audio a la vez", async () => {
      const admin = adminClient();
      const rutas = Array.from({ length: 100 }, () => ruta(bruno, crypto.randomUUID()));
      try {
        await Promise.all(
          rutas.map((r) =>
            admin.storage.from(BUCKET).upload(r, new Uint8Array(8), { contentType: "audio/webm" }),
          ),
        );
        const sobra = await bruno.client.storage
          .from(BUCKET)
          .upload(ruta(bruno, crypto.randomUUID()), audio());
        expect(sobra.error).not.toBeNull();
        // Control positivo: otro autor sí puede subir.
        const otra = await ana.client.storage
          .from(BUCKET)
          .upload(ruta(ana, crypto.randomUUID()), audio());
        expect(otra.error).toBeNull();
      } finally {
        await admin.storage.from(BUCKET).remove(rutas);
      }
    }, 60_000);

    test("un archivo que no es audio o es demasiado grande se rechaza", async () => {
      const id = crypto.randomUUID();
      // Control positivo: un audio válido y pequeño sí se sube.
      const valido = await ana.client.storage
        .from(BUCKET)
        .upload(ruta(ana, crypto.randomUUID()), audio());
      expect(valido.error).toBeNull();
      const texto = await ana.client.storage
        .from(BUCKET)
        .upload(ruta(ana, id), new Blob(["hola"], { type: "text/plain" }));
      expect(texto.error).not.toBeNull();
      const grande = await ana.client.storage
        .from(BUCKET)
        .upload(
          ruta(ana, crypto.randomUUID()),
          new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "audio/webm" }),
        );
      expect(grande.error).not.toBeNull();
    });
  });

  // Consentimiento de la primera grabación (el audio va a un proveedor externo).
  describe("consentimiento de voz", () => {
    beforeAll(async () => {
      await adminClient().from("assistant_voice_consent").delete().eq("author_id", bruno.userId);
    });

    test("sin aceptar no hay consentimiento", async () => {
      const { data } = await bruno.client.from("assistant_voice_consent").select("version");
      expect(data).toEqual([]);
    });

    test("el autor acepta una versión y el servidor fija el autor y el momento", async () => {
      const { error } = await bruno.client
        .from("assistant_voice_consent")
        .insert({ version: "v1" });
      expect(error).toBeNull();
      const { data } = await bruno.client
        .from("assistant_voice_consent")
        .select("author_id, version, accepted_at")
        .single();
      expect(data?.author_id).toBe(bruno.userId);
      expect(data?.version).toBe("v1");
      expect(Math.abs(Date.now() - new Date(data?.accepted_at ?? 0).getTime())).toBeLessThan(
        60_000,
      );
    });

    test("no se puede aceptar a nombre de otro ni fijar el momento", async () => {
      const aNombreDeOtro = await ana.client
        .from("assistant_voice_consent")
        .insert({ version: "v1", author_id: bruno.userId } as never);
      expect(aNombreDeOtro.error).not.toBeNull();
      const conFecha = await ana.client
        .from("assistant_voice_consent")
        .insert({ version: "v1", accepted_at: "2020-01-01T00:00:00Z" } as never);
      expect(conFecha.error).not.toBeNull();
    });

    test("otro veterinario no ve el consentimiento ajeno", async () => {
      const { data } = await ana.client
        .from("assistant_voice_consent")
        .select("author_id")
        .eq("author_id", bruno.userId);
      expect(data).toEqual([]);
    });

    test("el consentimiento no se edita ni se borra desde el cliente", async () => {
      const edita = await bruno.client
        .from("assistant_voice_consent")
        .update({ version: "v2" })
        .eq("author_id", bruno.userId);
      expect(edita.error).not.toBeNull();
      const borra = await bruno.client
        .from("assistant_voice_consent")
        .delete()
        .eq("author_id", bruno.userId);
      expect(borra.error).not.toBeNull();
    });
  });

  // Cuota de transcripciones: un usuario activo no debe poder gastar la cuota del proveedor.
  describe("cuota de transcripciones", () => {
    test("permite 20 y la 21 se rechaza", async () => {
      const veterinaria = await signedInVeterinarian(ANA);
      const resultados: boolean[] = [];
      for (let i = 0; i < 21; i++) {
        const { data } = await veterinaria.client.rpc("consume_assistant_audio_quota");
        resultados.push(data === true);
      }
      expect(resultados.filter(Boolean)).toHaveLength(20);
      expect(resultados[20]).toBe(false);
      // Limpieza: la cuota es del servicio, el cliente no tiene acceso a la tabla.
      await adminClient()
        .from("assistant_audio_usage")
        .delete()
        .eq("author_id", veterinaria.userId);
    });

    test("sin sesión de acceso activa no hay cuota", async () => {
      const sinSesion = await signedInVeterinarian(BRUNO);
      await sinSesion.client.rpc("revoke_access_session", {
        p_session_id: sinSesion.accessSessionId,
      });
      const { data } = await sinSesion.client.rpc("consume_assistant_audio_quota");
      expect(data).toBe(false);
    });
  });
});
