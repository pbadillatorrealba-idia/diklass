import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
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
import { splitIntoFragments } from "@/features/conocimiento/answer";
import { type FuenteInput, fuenteContentSchema } from "@/features/conocimiento/schema";

export type FuenteFormValues = {
  titulo: string;
  autores: string;
  anio: string;
  revista: string;
  editorial: string;
  edicion: string;
  doi: string;
  url: string;
  licenciaTipo: string;
  licenciaNota: string;
  texto: string;
};

export const emptyFuenteFormValues: FuenteFormValues = {
  titulo: "",
  autores: "",
  anio: "",
  revista: "",
  editorial: "",
  edicion: "",
  doi: "",
  url: "",
  licenciaTipo: "CC BY 4.0 (ficticia)",
  licenciaNota: "",
  texto: "",
};

const CAMPOS: { field: keyof FuenteFormValues; label: string; testID: string }[] = [
  { field: "titulo", label: "Título de la fuente", testID: "fuente-titulo" },
  { field: "autores", label: "Autores (separados por coma)", testID: "fuente-autores" },
  { field: "anio", label: "Año de publicación", testID: "fuente-anio" },
  { field: "revista", label: "Revista", testID: "fuente-revista" },
  { field: "editorial", label: "Editorial", testID: "fuente-editorial" },
  { field: "edicion", label: "Edición", testID: "fuente-edicion" },
  { field: "doi", label: "DOI", testID: "fuente-doi" },
  { field: "url", label: "URL", testID: "fuente-url" },
  { field: "licenciaTipo", label: "Licencia del documento", testID: "fuente-licencia-tipo" },
  { field: "licenciaNota", label: "Nota de licencia", testID: "fuente-licencia-nota" },
];

function parsearEntero(valor: string): number | null {
  const recortado = valor.trim();
  if (recortado === "") return null;
  const numero = Number.parseInt(recortado, 10);
  return Number.isFinite(numero) && numero > 0 && String(numero) === recortado ? numero : null;
}

const ERROR_ANIO = "Año de publicación inválido.";

/**
 * Formulario de ingesta de una fuente clínica (FR-028 · FR-030 · US5-AC6/AC9): bibliografía
 * disponible, metadatos de licencia y el texto del documento cortado en fragmentos citables
 * (D2/D9), con vista previa del corte antes de incorporar.
 */
export function FormularioFuente({
  values,
  onChange,
  onSubmit,
  isSaving,
  status,
  errors,
}: {
  values: FuenteFormValues;
  onChange: (values: FuenteFormValues) => void;
  onSubmit: (fuente: FuenteInput) => void;
  isSaving: boolean;
  status: string | null;
  errors: Record<string, string>;
}) {
  const fragmentos = splitIntoFragments(values.texto);
  const anio = parsearEntero(values.anio);
  const errorAnio = values.anio.trim() !== "" && anio === null ? ERROR_ANIO : null;

  return (
    <VStack className="gap-4">
      {CAMPOS.map(({ field, label, testID }) => {
        const mensaje = field === "anio" ? (errors[field] ?? errorAnio) : errors[field];
        return (
          <FormControl isInvalid={Boolean(mensaje)} key={field}>
            <FormControlLabel>
              <FormControlLabelText>{label}</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                accessibilityLabel={label}
                onChangeText={(texto) => onChange({ ...values, [field]: texto })}
                testID={testID}
                value={values[field]}
              />
            </Input>
            {mensaje ? (
              <FormControlError>
                <FormControlErrorText>{mensaje}</FormControlErrorText>
              </FormControlError>
            ) : null}
          </FormControl>
        );
      })}

      <FormControl isInvalid={Boolean(errors.texto)}>
        <FormControlLabel>
          <FormControlLabelText>
            Texto del documento (párrafos separados por líneas en blanco; «#» marca sección)
          </FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField
            accessibilityLabel="Texto del documento"
            multiline
            onChangeText={(texto) => onChange({ ...values, texto })}
            testID="fuente-texto"
            value={values.texto}
          />
        </Input>
        {errors.texto ? (
          <FormControlError>
            <FormControlErrorText>{errors.texto}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <Box className="rounded-lg bg-muted p-3" testID="fuente-vista-previa-fragmentos">
        <Text bold className="text-foreground text-sm">
          Vista previa del corte en fragmentos citables: {fragmentos.length}
        </Text>
        {fragmentos.map((fragmento) => (
          <Text className="text-foreground/70 text-xs" key={fragmento.ordinal}>
            {fragmento.ordinal}. {fragmento.seccion ? `[${fragmento.seccion}] ` : ""}
            {fragmento.texto}
          </Text>
        ))}
      </Box>

      <Button
        isDisabled={isSaving || errorAnio !== null}
        onPress={() => {
          const candidato = {
            bibliografia: {
              titulo: values.titulo,
              autores: values.autores
                .split(",")
                .map((autor) => autor.trim())
                .filter((autor) => autor !== ""),
              anio,
              revista: values.revista,
              editorial: values.editorial,
              edicion: values.edicion,
              doi: values.doi,
              url: values.url,
            },
            licencia: { tipo: values.licenciaTipo, nota: values.licenciaNota },
            fragmentos,
          };
          const legible = fuenteContentSchema.safeParse(candidato);
          if (!legible.success) {
            onSubmit(candidato as FuenteInput);
            return;
          }
          onSubmit(legible.data);
        }}
        testID="fuente-submit"
      >
        <ButtonText>Incorporar fuente a la colección</ButtonText>
      </Button>

      {status !== null ? (
        <Text className="text-foreground text-sm" testID="fuente-status">
          {status}
        </Text>
      ) : null}
    </VStack>
  );
}
