import { useState } from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { HipotesisSoportada } from "@/features/asistencia/schema";
import {
  composeHipotesisConsideradas,
  type Suficiencia,
} from "@/features/asistencia/soporte-diferencial";
import { TarjetaHipotesis } from "./tarjeta-hipotesis";

/**
 * Panel de apoyo al diagnóstico diferencial (FR-009 · FR-010 · FR-022 · FR-029 · FR-049 · US8):
 * se activa bajo petición del veterinario, declara la insuficiencia de información nombrando lo
 * faltante, presenta hipótesis con su descargo, registra aceptar/descartar/agregar y cierra con
 * el resumen de hipótesis consideradas para la epicrisis.
 */
export function PanelSoporteDiferencial({
  hipotesis,
  suficiencia,
  generando,
  onGenerar,
  onDecidir,
  onAgregar,
}: {
  hipotesis: HipotesisSoportada[];
  suficiencia: Suficiencia | null;
  generando: boolean;
  onGenerar: () => void;
  onDecidir: (hipotesis: HipotesisSoportada, decision: "accepted" | "discarded") => void;
  onAgregar: (texto: string) => void;
}) {
  const [propia, setPropia] = useState("");
  const consideradas = composeHipotesisConsideradas(
    hipotesis.map((item) => ({
      consultationId: "",
      texto: item.texto,
      decision: item.decision,
      origen: item.origen,
      reglaId: item.reglaId,
      insumos: item.insumos,
      respaldo: item.respaldo,
    })),
  );

  return (
    <VStack className="gap-3" testID="panel-soporte-diferencial">
      <Heading size="md">Apoyo al diagnóstico diferencial</Heading>
      <Text className="text-foreground/70 text-sm">
        Candidaturas con antecedentes a favor, en contra, información faltante y evidencia citada.
        Toda salida es apoyo a la decisión y requiere tu validación: el sistema no emite
        diagnósticos.
      </Text>
      <Button
        className="self-start"
        isDisabled={generando}
        onPress={onGenerar}
        testID="solicitar-apoyo"
      >
        <ButtonText>{generando ? "Evaluando…" : "Solicitar apoyo diagnóstico"}</ButtonText>
      </Button>

      {suficiencia?.estado === "insuficiente" ? (
        <Box
          accessibilityLabel="Información insuficiente para proponer hipótesis fundadas"
          className="rounded-lg border border-destructive bg-white p-3"
          testID="aviso-insuficiencia"
        >
          <VStack className="gap-1">
            <Text bold className="text-destructive">
              La información disponible es insuficiente para proponer hipótesis fundadas.
            </Text>
            <Text className="text-foreground/70 text-sm">
              Registra al menos los antecedentes que discriminarían el cuadro. Faltan, entre otros:{" "}
              {suficiencia.faltantes.join(", ")}.
            </Text>
          </VStack>
        </Box>
      ) : null}

      {hipotesis.map((item) => (
        <TarjetaHipotesis
          hipotesis={item}
          key={item.key}
          onDecidir={(decision) => onDecidir(item, decision)}
        />
      ))}

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText>Agregar tu propia hipótesis</FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField
            accessibilityLabel="Texto de tu hipótesis clínica"
            onChangeText={setPropia}
            placeholder="Hipótesis clínica que quieres dejar registrada"
            testID="hipotesis-propia-texto"
            value={propia}
          />
        </Input>
      </FormControl>
      <Button
        className="self-start"
        isDisabled={propia.trim() === ""}
        onPress={() => {
          onAgregar(propia.trim());
          setPropia("");
        }}
        testID="agregar-hipotesis"
      >
        <ButtonText>Agregar hipótesis</ButtonText>
      </Button>

      <VStack className="gap-2" testID="hipotesis-consideradas">
        <Heading size="sm">Hipótesis consideradas (para la epicrisis)</Heading>
        {consideradas.length === 0 ? (
          <Text className="text-foreground/70 text-sm">Todavía no hay hipótesis consideradas.</Text>
        ) : (
          consideradas.map((considerada) => (
            <Text className="text-foreground/70 text-sm" key={considerada.texto}>
              {considerada.texto} — {considerada.estado}
            </Text>
          ))
        )}
      </VStack>
    </VStack>
  );
}
