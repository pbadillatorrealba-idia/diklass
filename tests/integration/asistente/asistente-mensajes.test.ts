import { beforeAll, describe, expect, test } from "bun:test";
import {
  deleteConversation,
  insertMessage,
  listMessages,
} from "@/features/asistente/message-service";
import {
  ANA,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";
import { nuevaConsultaVoz } from "../voz/consulta-voz";

/**
 * Conversación persistida del chat (asistente-conversacional «Conversación continua y privada» y
 * «Persistencia de mensajes terminales» · design.md D3 · tarea 3.1). Suite viva: necesita
 * `supabase start`, la migración 022 y las veterinarias sintéticas.
 */
describe.skipIf(!isLiveSupabase)("assistant_messages (RLS)", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;
  let pacienteId: string;
  let consultaId: string;

  const texto = (text: string) => [{ type: "text", text }];
  const mensaje = (vet: LiveVeterinarian, over: Record<string, unknown> = {}) => ({
    clinic_id: vet.clinicId,
    author_id: vet.userId,
    role: "user",
    status: "done",
    parts: texto("hola"),
    ...over,
  });

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);
    consultaId = await nuevaConsultaVoz(ana);
    const { data } = await ana.client
      .from("clinical_records")
      .select("content")
      .eq("id", consultaId)
      .single();
    pacienteId = (data?.content as { patientId: string } | undefined)?.patientId ?? "";
    await deleteConversation(ana.client);
    await deleteConversation(bruno.client);
  });

  test("el autor inserta y lee sus mensajes", async () => {
    const { error } = await ana.client.from("assistant_messages").insert(mensaje(ana));
    expect(error).toBeNull();
    const { data } = await ana.client.from("assistant_messages").select("id, status");
    expect(data?.length).toBeGreaterThan(0);
  });

  test("otro veterinario de la clínica no los ve", async () => {
    await ana.client.from("assistant_messages").insert(mensaje(ana, { parts: texto("privado") }));
    const { data } = await bruno.client.from("assistant_messages").select("id, parts");
    expect(JSON.stringify(data ?? [])).not.toContain("privado");
  });

  test("no se puede insertar a nombre de otro autor", async () => {
    const { error } = await ana.client.from("assistant_messages").insert(mensaje(bruno));
    expect(error).not.toBeNull();
  });

  test.each(["sending", "thinking"])(
    "solo se persisten mensajes terminales: «%s» se rechaza",
    async (status) => {
      const { error } = await ana.client
        .from("assistant_messages")
        .insert(mensaje(ana, { status }));
      expect(error).not.toBeNull();
    },
  );

  test("un mensaje en error sí se persiste", async () => {
    const { error } = await ana.client
      .from("assistant_messages")
      .insert(mensaje(ana, { role: "assistant", status: "error" }));
    expect(error).toBeNull();
  });

  test("el cliente no edita un mensaje persistido", async () => {
    const { data } = await ana.client
      .from("assistant_messages")
      .insert(mensaje(ana, { parts: texto("original") }))
      .select("id")
      .single();
    const { error } = await ana.client
      .from("assistant_messages")
      .update({ parts: texto("editado") })
      .eq("id", data?.id ?? "");
    expect(error).not.toBeNull();
    const { data: leido } = await ana.client
      .from("assistant_messages")
      .select("parts")
      .eq("id", data?.id ?? "")
      .single();
    expect(JSON.stringify(leido?.parts)).toContain("original");
  });

  test("el cliente no borra mensajes sueltos: solo la RPC borra, y solo los suyos", async () => {
    const { data } = await ana.client
      .from("assistant_messages")
      .insert(mensaje(ana, { parts: texto("a borrar") }))
      .select("id")
      .single();
    const directo = await ana.client
      .from("assistant_messages")
      .delete()
      .eq("id", data?.id ?? "");
    expect(directo.error).not.toBeNull();
    await deleteConversation(bruno.client);
    const { data: sigue } = await ana.client
      .from("assistant_messages")
      .select("id")
      .eq("id", data?.id ?? "");
    expect(sigue).toHaveLength(1);
    await deleteConversation(ana.client);
    const { data: borrado } = await ana.client
      .from("assistant_messages")
      .select("id")
      .eq("id", data?.id ?? "");
    expect(borrado).toHaveLength(0);
  });

  describe("paciente de contexto", () => {
    test("un paciente de la clínica se acepta", async () => {
      const { error } = await ana.client
        .from("assistant_messages")
        .insert(mensaje(ana, { patient_id: pacienteId }));
      expect(error).toBeNull();
    });

    test("un id inexistente se rechaza", async () => {
      const { error } = await ana.client
        .from("assistant_messages")
        .insert(mensaje(ana, { patient_id: "00000000-0000-4000-8000-000000000000" }));
      expect(error).not.toBeNull();
    });

    test("un registro que no es paciente (una consulta) se rechaza", async () => {
      const { error } = await ana.client
        .from("assistant_messages")
        .insert(mensaje(ana, { patient_id: consultaId }));
      expect(error).not.toBeNull();
    });

    // Un paciente de OTRA clínica no se puede sembrar por la API (la guarda de atribución lo impide
    // incluso con service role). Usa el mismo predicado `clinic_id = new.clinic_id` que los dos casos
    // de arriba, que sí se prueban.
  });

  // Paginación (3.2): los últimos 50 y «Cargar anteriores» sin saltarse ni repetir mensajes.
  describe("paginación con 120 mensajes", () => {
    const ids: string[] = [];

    beforeAll(async () => {
      await deleteConversation(ana.client);
      for (let i = 1; i <= 120; i++) {
        const id = crypto.randomUUID();
        ids.push(id);
        await insertMessage(ana.client, {
          clinicId: ana.clinicId,
          message: {
            id,
            role: i % 2 ? "user" : "assistant",
            createdAt: "",
            status: "done",
            patientId: null,
            parts: [{ type: "text", text: `mensaje ${i}` }],
          },
        });
      }
    }, 120_000);

    test("la primera página trae los 50 más recientes, en orden cronológico", async () => {
      const pagina = await listMessages(ana.client);
      expect(pagina.messages).toHaveLength(50);
      expect(pagina.messages.at(-1)?.id).toBe(ids[119]);
      expect(pagina.messages[0]?.id).toBe(ids[70]);
      expect(pagina.next).not.toBeNull();
    });

    test("recorrer los cursores trae los 120, una vez cada uno y sin huecos", async () => {
      const vistos: string[] = [];
      let cursor: Awaited<ReturnType<typeof listMessages>>["next"] = null;
      let paginas = 0;
      do {
        const pagina = await listMessages(ana.client, cursor ?? undefined);
        vistos.unshift(...pagina.messages.map((m) => m.id));
        cursor = pagina.next;
        paginas++;
      } while (cursor);
      expect(paginas).toBe(3);
      expect(vistos).toEqual(ids);
    });

    test("otro veterinario no ve esa conversación", async () => {
      expect((await listMessages(bruno.client)).messages.map((m) => m.id)).not.toContain(ids[0]);
    });
  });

  // «Borrar la conversación» (3.3): no quedan mensajes suyos y la auditoría de conocimiento sigue.
  describe("borrar la conversación", () => {
    test("borra los mensajes del autor y deja intactos los de otros y knowledge_queries", async () => {
      await ana.client.from("assistant_messages").insert(mensaje(ana, { parts: texto("de Ana") }));
      await bruno.client
        .from("assistant_messages")
        .insert(mensaje(bruno, { parts: texto("de Bruno") }));
      const consulta = await ana.client
        .from("knowledge_queries")
        .insert({
          clinic_id: ana.clinicId,
          question: "¿prueba de borrado del asistente?",
          answer: { pregunta: "p", segmentos: [], cobertura: {}, avisos: [] },
        })
        .select("id")
        .single();
      expect(consulta.error).toBeNull();

      await deleteConversation(ana.client);

      const { data: deAna } = await ana.client.from("assistant_messages").select("id");
      expect(deAna).toEqual([]);
      const { data: deBruno } = await bruno.client.from("assistant_messages").select("id");
      expect(deBruno?.length).toBeGreaterThan(0);
      const { data: auditoria } = await ana.client
        .from("knowledge_queries")
        .select("id")
        .eq("id", consulta.data?.id ?? "");
      expect(auditoria).toHaveLength(1);
    });
  });

  test("sin sesión de acceso activa no se lee ni se inserta", async () => {
    const vet = await signedInVeterinarian(ANA);
    await vet.client.rpc("revoke_access_session", { p_session_id: vet.accessSessionId });
    const { error } = await vet.client.from("assistant_messages").insert(mensaje(vet));
    expect(error).not.toBeNull();
  });
});

test.skipIf(!isLiveSupabase)(
  "trazabilidadRPC: recuerda mensajes antes del borrado del producto",
  async () => {
    const { readFileSync } = await import("node:fs");
    const vet = await signedInVeterinarian(ANA);
    const id = crypto.randomUUID();
    await insertMessage(vet.client, {
      clinicId: vet.clinicId,
      message: {
        id,
        role: "user",
        createdAt: "",
        status: "done",
        patientId: null,
        parts: [{ type: "text", text: "Mensaje de trazabilidad" }],
      },
    });
    await deleteConversation(vet.client);
    const state = JSON.parse(readFileSync(process.env.TEST_SCOPE_FILE as string, "utf8"));
    expect(state.remembered?.assistant_messages ?? []).toContainEqual({ id });
    expect((await vet.client.from("assistant_messages").select("id").eq("id", id)).data).toEqual(
      [],
    );
  },
);
