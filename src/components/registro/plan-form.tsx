import { OptionPicker } from "@/components/registro/option-picker";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DIAGNOSTIC_TEST_LABELS } from "@/features/registro/anamnesis-catalog";
import { DIAGNOSTIC_TESTS, type DiagnosisContent } from "@/features/registro/schema";

/**
 * Plan de la consulta de la hoja etológica (FR-112): protocolo diagnóstico, diferenciales,
 * tratamiento y seguimiento. Lo escribe el veterinario; el formulario no propone ni completa nada.
 */

type DiagnosticTest = (typeof DIAGNOSTIC_TESTS)[number];
type YesNo = "" | "si" | "no";

export type PlanFormValues = {
  tests: DiagnosticTest[];
  otherTests: string;
  video: YesNo;
  videoDetails: string;
  differentials: [string, string, string];
  generalGuidelines: string;
  specificGuidelines: string;
  complementaryGuidelines: string;
  neuterSurgical: YesNo;
  neuterMedical: YesNo;
  medication: [
    { activeIngredient: string; guideline: string },
    { activeIngredient: string; guideline: string },
  ];
  followUp: string;
};

export const emptyPlanFormValues: PlanFormValues = {
  tests: [],
  otherTests: "",
  video: "",
  videoDetails: "",
  differentials: ["", "", ""],
  generalGuidelines: "",
  specificGuidelines: "",
  complementaryGuidelines: "",
  neuterSurgical: "",
  neuterMedical: "",
  medication: [
    { activeIngredient: "", guideline: "" },
    { activeIngredient: "", guideline: "" },
  ],
  followUp: "",
};

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());
const yesNo = (value: YesNo) => (value === "" ? null : value);

/**
 * Valores del formulario → plan del diagnóstico. Sin ningún dato, `plan` es `null` (sin dato, no
 * un plan vacío). Un principio activo sin pauta, o al revés, es un error del formulario.
 */
export function buildPlan(values: PlanFormValues): {
  plan: DiagnosisContent["plan"];
  error: string | null;
} {
  const incompleto = values.medication.some(
    (m) => (m.activeIngredient.trim() === "") !== (m.guideline.trim() === ""),
  );
  if (incompleto) {
    return { plan: null, error: "Completa el principio activo y su pauta, o deja ambos vacíos." };
  }
  const medication = values.medication
    .filter((m) => m.activeIngredient.trim() !== "")
    .map((m) => ({ activeIngredient: m.activeIngredient.trim(), guideline: m.guideline.trim() }));
  const differentials = values.differentials.map((d) => d.trim()).filter((d) => d !== "");
  const plan = {
    tests: values.tests,
    otherTests: orNull(values.otherTests),
    video: yesNo(values.video),
    videoDetails: orNull(values.videoDetails),
    differentials,
    generalGuidelines: orNull(values.generalGuidelines),
    specificGuidelines: orNull(values.specificGuidelines),
    complementaryGuidelines: orNull(values.complementaryGuidelines),
    neuterSurgical: yesNo(values.neuterSurgical),
    neuterMedical: yesNo(values.neuterMedical),
    medication,
    followUp: orNull(values.followUp),
  };
  const vacio =
    plan.tests.length === 0 &&
    differentials.length === 0 &&
    medication.length === 0 &&
    [
      plan.otherTests,
      plan.video,
      plan.videoDetails,
      plan.generalGuidelines,
      plan.specificGuidelines,
      plan.complementaryGuidelines,
      plan.neuterSurgical,
      plan.neuterMedical,
      plan.followUp,
    ].every((value) => value === null);
  return { plan: vacio ? null : plan, error: null };
}

const YES_NO_OPTIONS = [
  { value: "", label: "Sin dato" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
] as const;

type PlanFormProps = {
  values: PlanFormValues;
  error: string | null;
  isDisabled: boolean;
  onChange: (values: PlanFormValues) => void;
};

function TextRow({
  label,
  value,
  onChange,
  isDisabled,
  testID,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  isDisabled: boolean;
  testID: string;
  multiline?: boolean;
}) {
  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Input>
        <InputField
          accessibilityLabel={label}
          aria-label={label}
          className={multiline ? "min-h-textarea" : undefined}
          editable={!isDisabled}
          multiline={multiline}
          onChangeText={onChange}
          testID={testID}
          textAlignVertical={multiline ? "top" : undefined}
          value={value}
        />
      </Input>
    </FormControl>
  );
}

/** Formulario del plan: lo que el veterinario decide pedir, pautar y medicar (FR-112). */
export function PlanForm({ values, error, isDisabled, onChange }: PlanFormProps) {
  const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const toggleTest = (test: DiagnosticTest) =>
    set(
      "tests",
      values.tests.includes(test)
        ? values.tests.filter((t) => t !== test)
        : [...values.tests, test],
    );

  return (
    <VStack className="w-full gap-4" testID="plan-form">
      <Text variant="strong">Plan de la consulta (opcional)</Text>
      <VStack className="gap-2">
        <Text>Protocolo diagnóstico: pruebas requeridas</Text>
        <VStack className="flex-row flex-wrap gap-2">
          {DIAGNOSTIC_TESTS.map((test) => {
            const checked = values.tests.includes(test);
            return (
              <Button
                accessibilityLabel={DIAGNOSTIC_TEST_LABELS[test]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled: isDisabled }}
                aria-checked={checked}
                isDisabled={isDisabled}
                key={test}
                onPress={() => toggleTest(test)}
                role="checkbox"
                testID={`plan-test-${test.replace(/_/g, "-")}`}
                variant={checked ? "primary" : "outline"}
              >
                <ButtonText>{DIAGNOSTIC_TEST_LABELS[test]}</ButtonText>
              </Button>
            );
          })}
        </VStack>
      </VStack>
      <TextRow
        isDisabled={isDisabled}
        label="Otras pruebas"
        onChange={(text) => set("otherTests", text)}
        testID="plan-other-tests"
        value={values.otherTests}
      />
      <OptionPicker
        isDisabled={isDisabled}
        label="Grabación en vídeo"
        onChange={(value) => set("video", value)}
        options={[...YES_NO_OPTIONS]}
        testID="plan-video"
        value={values.video}
      />
      <TextRow
        isDisabled={isDisabled}
        label="Detalles del vídeo"
        onChange={(text) => set("videoDetails", text)}
        testID="plan-video-details"
        value={values.videoDetails}
      />
      {values.differentials.map((value, index) => (
        <TextRow
          isDisabled={isDisabled}
          // biome-ignore lint/suspicious/noArrayIndexKey: tres renglones fijos de la hoja.
          key={index}
          label={`Diagnóstico diferencial de conducta ${index + 1}`}
          onChange={(text) => {
            const next = [...values.differentials] as PlanFormValues["differentials"];
            next[index] = text;
            set("differentials", next);
          }}
          testID={`plan-differential-${index + 1}`}
          value={value}
        />
      ))}
      <TextRow
        isDisabled={isDisabled}
        label="Pautas generales"
        multiline
        onChange={(text) => set("generalGuidelines", text)}
        testID="plan-general"
        value={values.generalGuidelines}
      />
      <TextRow
        isDisabled={isDisabled}
        label="Pautas específicas"
        multiline
        onChange={(text) => set("specificGuidelines", text)}
        testID="plan-specific"
        value={values.specificGuidelines}
      />
      <TextRow
        isDisabled={isDisabled}
        label="Pautas complementarias"
        multiline
        onChange={(text) => set("complementaryGuidelines", text)}
        testID="plan-complementary"
        value={values.complementaryGuidelines}
      />
      <OptionPicker
        isDisabled={isDisabled}
        label="Castración quirúrgica"
        onChange={(value) => set("neuterSurgical", value)}
        options={[...YES_NO_OPTIONS]}
        testID="plan-neuter-surgical"
        value={values.neuterSurgical}
      />
      <OptionPicker
        isDisabled={isDisabled}
        label="Castración médica"
        onChange={(value) => set("neuterMedical", value)}
        options={[...YES_NO_OPTIONS]}
        testID="plan-neuter-medical"
        value={values.neuterMedical}
      />
      {values.medication.map((med, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: dos renglones fijos de la hoja.
        <VStack className="gap-2" key={index}>
          <TextRow
            isDisabled={isDisabled}
            label={`Principio activo ${index + 1}`}
            onChange={(text) => {
              const next = [...values.medication] as PlanFormValues["medication"];
              next[index] = { ...med, activeIngredient: text };
              set("medication", next);
            }}
            testID={`plan-med-${index + 1}-ingredient`}
            value={med.activeIngredient}
          />
          <TextRow
            isDisabled={isDisabled}
            label={`Pauta del principio activo ${index + 1}`}
            onChange={(text) => {
              const next = [...values.medication] as PlanFormValues["medication"];
              next[index] = { ...med, guideline: text };
              set("medication", next);
            }}
            testID={`plan-med-${index + 1}-guideline`}
            value={med.guideline}
          />
        </VStack>
      ))}
      <TextRow
        isDisabled={isDisabled}
        label="Seguimiento"
        multiline
        onChange={(text) => set("followUp", text)}
        testID="plan-follow-up"
        value={values.followUp}
      />
      {error ? (
        <FormControl isInvalid>
          <FormControlError>
            <FormControlErrorText>{error}</FormControlErrorText>
          </FormControlError>
        </FormControl>
      ) : null}
    </VStack>
  );
}

/** Lectura del plan registrado: solo lo que el veterinario completó. */
export function PlanSummary({ plan }: { plan: NonNullable<DiagnosisContent["plan"]> }) {
  const yn = { si: "Sí", no: "No" } as const;
  const rows: [string, string | null][] = [
    [
      "Pruebas requeridas",
      plan.tests && plan.tests.length
        ? plan.tests.map((t) => DIAGNOSTIC_TEST_LABELS[t]).join(", ")
        : null,
    ],
    ["Otras pruebas", plan.otherTests],
    ["Grabación en vídeo", plan.video ? yn[plan.video] : null],
    ["Detalles del vídeo", plan.videoDetails],
    [
      "Diagnósticos diferenciales",
      plan.differentials?.length ? plan.differentials.join("; ") : null,
    ],
    ["Pautas generales", plan.generalGuidelines],
    ["Pautas específicas", plan.specificGuidelines],
    ["Pautas complementarias", plan.complementaryGuidelines],
    ["Castración quirúrgica", plan.neuterSurgical ? yn[plan.neuterSurgical] : null],
    ["Castración médica", plan.neuterMedical ? yn[plan.neuterMedical] : null],
    [
      "Medicación",
      plan.medication?.length
        ? plan.medication.map((m) => `${m.activeIngredient} — ${m.guideline}`).join("; ")
        : null,
    ],
    ["Seguimiento", plan.followUp],
  ];
  return (
    <VStack className="w-full" testID="plan-summary">
      {rows
        .filter((row): row is [string, string] => row[1] !== null)
        .map(([label, value]) => (
          <Field key={label} label={label}>
            {value}
          </Field>
        ))}
    </VStack>
  );
}
