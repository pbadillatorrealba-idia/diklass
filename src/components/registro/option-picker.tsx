import { Button, ButtonText } from "@/components/ui/button";
import { FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { VStack } from "@/components/ui/vstack";

export type OptionPickerProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID: string;
  isDisabled?: boolean;
};

const SELECTED_BACKGROUND = "#0369a1";
const SELECTED_TEXT = "#f8fafc";
const IDLE_BACKGROUND = "#ffffff";
const IDLE_TEXT = "#0f172a";

/**
 * Grupo de opciones accesible (radio) para vocabularios cerrados: etiqueta programática,
 * operable por teclado con foco visible (usa `Button`) y estado `checked` expuesto a los
 * lectores de pantalla. Los colores van inline a propósito — mismo motivo que `InputField`:
 * las utilidades de color de `Button`/`ButtonText` ganarían por orden de hoja de estilos y
 * dejarían el texto sin contraste suficiente.
 */
export function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
  isDisabled = false,
}: OptionPickerProps<T>) {
  return (
    <VStack className="w-full gap-1.5" testID={testID}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <VStack
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        className="flex-row flex-wrap gap-2"
        role="radiogroup"
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Button
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              isDisabled={isDisabled}
              key={option.value}
              onPress={() => onChange(option.value)}
              role="radio"
              style={{ backgroundColor: isSelected ? SELECTED_BACKGROUND : IDLE_BACKGROUND }}
              testID={`${testID}-${option.value.replace(/_/g, "-")}`}
            >
              <ButtonText style={{ color: isSelected ? SELECTED_TEXT : IDLE_TEXT }}>
                {option.label}
              </ButtonText>
            </Button>
          );
        })}
      </VStack>
    </VStack>
  );
}
