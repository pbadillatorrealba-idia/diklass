import { OptionPicker } from "@/components/registro/option-picker";
import type { PatientEntry } from "@/features/registro/ficha-service";

const SIN_PACIENTE = "general";

/**
 * Contexto de paciente de la conversación (FR-026 · FR-051 · US5-AC4/AC10): el paciente
 * elegido se conserva durante la sesión y sin selección la conversación queda explícitamente
 * en modo conocimiento general.
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
  const options = [
    { value: SIN_PACIENTE, label: "Conocimiento general (sin paciente)" },
    ...pacientes.map((paciente) => ({
      value: paciente.record.id,
      label: `${paciente.content.name} (${paciente.content.breed})`,
    })),
  ];

  return (
    <OptionPicker
      isDisabled={isDisabled}
      label="Contexto de paciente"
      onChange={(value) => onChange(value === SIN_PACIENTE ? null : value)}
      options={options}
      testID="selector-paciente-contexto"
      value={patientId ?? SIN_PACIENTE}
    />
  );
}
