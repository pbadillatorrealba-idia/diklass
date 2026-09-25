import { useState } from "react";
import { OptionPicker } from "@/components/registro/option-picker";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { contarCoincidencias, filtrarPacientes } from "@/features/conocimiento/filtrar-pacientes";
import type { PatientEntry } from "@/features/registro/ficha-service";

const SIN_PACIENTE = "general";

function recuento(total: number) {
  return total === 1 ? "1 paciente coincide" : `${total} pacientes coinciden`;
}

/**
 * Contexto de paciente de la conversación (FR-026 · FR-051 · US5-AC4/AC10): el paciente
 * elegido se conserva durante la sesión y sin selección la conversación queda explícitamente
 * en modo conocimiento general. Con cientos de fichas se elige buscando (FR-095 · design.md D19):
 * las opciones se limitan a las coincidencias y al paciente ya elegido.
 */
export function SelectorPacienteContexto({
  pacientes,
  patientId,
  onChange,
  isDisabled = false,
}: {
  pacientes: PatientEntry[];
  patientId: string | null;
  onChange: (patientId: string | null) => void;
  isDisabled?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const visibles = filtrarPacientes(pacientes, busqueda, patientId);

  const options = [
    { value: SIN_PACIENTE, label: "Conocimiento general (sin paciente)" },
    ...visibles.map((paciente) => ({
      value: paciente.record.id,
      label: `${paciente.content.name} (${paciente.content.breed})`,
    })),
  ];

  return (
    <VStack className="w-full gap-3">
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText>Buscar paciente</FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField
            accessibilityLabel="Buscar paciente"
            aria-label="Buscar paciente"
            autoCapitalize="none"
            editable={!isDisabled}
            onChangeText={setBusqueda}
            placeholder="Nombre, raza o especie"
            testID="selector-paciente-contexto-busqueda"
            value={busqueda}
          />
        </Input>
      </FormControl>
      {busqueda.trim() === "" ? null : (
        <Text
          accessibilityLiveRegion="polite"
          aria-live="polite"
          testID="selector-paciente-contexto-recuento"
          tone="muted"
          variant="caption"
        >
          {recuento(contarCoincidencias(pacientes, busqueda))}
        </Text>
      )}
      <OptionPicker
        isDisabled={isDisabled}
        label="Contexto de paciente"
        onChange={(value) => onChange(value === SIN_PACIENTE ? null : value)}
        options={options}
        testID="selector-paciente-contexto"
        value={patientId ?? SIN_PACIENTE}
      />
    </VStack>
  );
}
