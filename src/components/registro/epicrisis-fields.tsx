import { useState } from "react";
import { linesToItems, visibleListText } from "@/components/registro/list-lines";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { EpicrisisContent } from "@/features/registro/schema";

type EpicrisisFieldsProps = {
  content: EpicrisisContent;
  isEditable: boolean;
  /** Requerido en la práctica cuando `isEditable`; solo se invoca en edición. */
  onChange?: (content: EpicrisisContent) => void;
};

type TextFieldName =
  | "motivoConsulta"
  | "antecedentesRelevantes"
  | "hallazgosAnamnesis"
  | "diagnostico"
  | "recomendacionesTutor"
  | "observaciones";

const TEXT_FIELDS: { name: TextFieldName; label: string; testID: string }[] = [
  { name: "motivoConsulta", label: "Motivo de consulta", testID: "epicrisis-motivo-consulta" },
  {
    name: "antecedentesRelevantes",
    label: "Antecedentes relevantes",
    testID: "epicrisis-antecedentes",
  },
  {
    name: "hallazgosAnamnesis",
    label: "Hallazgos de la anamnesis",
    testID: "epicrisis-hallazgos",
  },
  { name: "diagnostico", label: "Diagnóstico registrado", testID: "epicrisis-diagnostico" },
  {
    name: "recomendacionesTutor",
    label: "Recomendaciones al tutor",
    testID: "epicrisis-recomendaciones",
  },
  { name: "observaciones", label: "Observaciones", testID: "epicrisis-observaciones" },
];

type ListFieldName =
  | "examenesSolicitados"
  | "intervencionesPropuestas"
  | "medicamentosAprobados"
  | "pendientes";

const LIST_FIELDS: {
  name: ListFieldName;
  label: string;
  testID: string;
  read: (content: EpicrisisContent) => string[];
  write: (content: EpicrisisContent, lines: string[]) => EpicrisisContent;
}[] = [
  {
    name: "examenesSolicitados",
    label: "Exámenes solicitados (uno por línea)",
    testID: "epicrisis-examenes",
    read: (content) => content.examenesSolicitados,
    write: (content, lines) => ({ ...content, examenesSolicitados: lines }),
  },
  {
    name: "intervencionesPropuestas",
    label: "Intervenciones propuestas (una por línea)",
    testID: "epicrisis-intervenciones",
    read: (content) => content.intervencionesPropuestas,
    write: (content, lines) => ({ ...content, intervencionesPropuestas: lines }),
  },
  {
    name: "medicamentosAprobados",
    label: "Medicamentos aprobados (uno por línea)",
    testID: "epicrisis-medicamentos",
    read: (content) => content.medicamentosAprobados,
    write: (content, lines) => ({ ...content, medicamentosAprobados: lines }),
  },
  {
    name: "pendientes",
    label: "Pendientes del plan de seguimiento (uno por línea)",
    testID: "epicrisis-pendientes",
    read: (content) => content.planSeguimiento.pendientes,
    write: (content, lines) => ({ ...content, planSeguimiento: { pendientes: lines } }),
  },
];

/**
 * Campo de lista (un ítem por línea). Guarda localmente el texto tal como se escribe y
 * entrega al contenido la lista ya limpia: si el campo mostrara la lista recortada, cada
 * pulsación borraría el espacio o el salto de línea recién escrito.
 */
function ListField({
  label,
  testID,
  items,
  isEditable,
  onChangeItems,
}: {
  label: string;
  testID: string;
  items: string[];
  isEditable: boolean;
  onChangeItems: (items: string[]) => void;
}) {
  const [typed, setTyped] = useState(() => items.join("\n"));
  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Input>
        <InputField
          accessibilityLabel={label}
          aria-label={label}
          className="min-h-textarea"
          editable={isEditable}
          multiline
          onChangeText={(text) => {
            setTyped(text);
            onChangeItems(linesToItems(text));
          }}
          testID={testID}
          textAlignVertical="top"
          value={visibleListText(typed, items)}
        />
      </Input>
    </FormControl>
  );
}

/**
 * Los 12 campos editables de FR-011 (las hipótesis con su estado cuentan cada uno):
 * motivo de consulta, antecedentes relevantes, hallazgos de la anamnesis, hipótesis
 * consideradas, estado de cada hipótesis, diagnóstico registrado, exámenes solicitados,
 * intervenciones propuestas, medicamentos aprobados, recomendaciones al tutor, plan de
 * seguimiento y observaciones. El duodécimo campo del contenido (`consultationId`) es la
 * asociación a la consulta y no se edita aquí.
 */
export function EpicrisisFields({ content, isEditable, onChange }: EpicrisisFieldsProps) {
  return (
    <VStack className="w-full gap-4" testID="epicrisis-fields">
      {TEXT_FIELDS.map(({ name, label, testID }) => (
        <FormControl key={name}>
          <FormControlLabel>
            <FormControlLabelText>{label}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField
              accessibilityLabel={label}
              aria-label={label}
              className="min-h-textarea"
              editable={isEditable}
              multiline
              onChangeText={(text) => onChange?.({ ...content, [name]: text })}
              testID={testID}
              textAlignVertical="top"
              value={content[name]}
            />
          </Input>
        </FormControl>
      ))}
      <VStack className="w-full gap-2">
        <Text variant="strong">Hipótesis consideradas con su estado</Text>
        {content.hipotesis.length === 0 ? (
          <Text testID="epicrisis-hipotesis-empty">
            Sin hipótesis consideradas: ese campo lo aporta otra funcionalidad.
          </Text>
        ) : (
          content.hipotesis.map((hipotesis, index) => (
            <Card
              className="gap-2"
              // biome-ignore lint/suspicious/noArrayIndexKey: filas controladas por el contenido, sin estado interno; dos hipótesis pueden repetir texto y estado.
              key={`hipotesis-${index}`}
              testID="epicrisis-hipotesis"
            >
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Hipótesis considerada</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    accessibilityLabel="Hipótesis considerada"
                    aria-label="Hipótesis considerada"
                    editable={isEditable}
                    onChangeText={(texto) =>
                      onChange?.({
                        ...content,
                        hipotesis: content.hipotesis.map((item, position) =>
                          position === index ? { ...item, texto } : item,
                        ),
                      })
                    }
                    testID="epicrisis-hipotesis-texto"
                    value={hipotesis.texto}
                  />
                </Input>
              </FormControl>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Estado de la hipótesis</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    accessibilityLabel="Estado de la hipótesis"
                    aria-label="Estado de la hipótesis"
                    editable={isEditable}
                    onChangeText={(estado) =>
                      onChange?.({
                        ...content,
                        hipotesis: content.hipotesis.map((item, position) =>
                          position === index ? { ...item, estado } : item,
                        ),
                      })
                    }
                    testID="epicrisis-hipotesis-estado"
                    value={hipotesis.estado}
                  />
                </Input>
              </FormControl>
              {isEditable ? (
                <Button
                  accessibilityLabel="Quitar hipótesis"
                  onPress={() =>
                    onChange?.({
                      ...content,
                      hipotesis: content.hipotesis.filter((_item, position) => position !== index),
                    })
                  }
                  testID="epicrisis-hipotesis-remove"
                >
                  <ButtonText>Quitar hipótesis</ButtonText>
                </Button>
              ) : null}
            </Card>
          ))
        )}
        {isEditable ? (
          <Button
            accessibilityLabel="Añadir hipótesis"
            onPress={() =>
              onChange?.({
                ...content,
                hipotesis: [...content.hipotesis, { texto: "", estado: "" }],
              })
            }
            testID="epicrisis-hipotesis-add"
          >
            <ButtonText>Añadir hipótesis</ButtonText>
          </Button>
        ) : null}
      </VStack>
      {LIST_FIELDS.map(({ name, label, testID, read, write }) => (
        <ListField
          isEditable={isEditable}
          items={read(content)}
          key={name}
          label={label}
          onChangeItems={(lines) => onChange?.(write(content, lines))}
          testID={testID}
        />
      ))}
    </VStack>
  );
}
