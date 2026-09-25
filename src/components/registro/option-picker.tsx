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

/**
 * Grupo de opciones accesible (radio) para vocabularios cerrados: etiqueta programática,
 * operable por teclado con foco visible (usa `Button`) y estado `checked` expuesto a los
 * lectores de pantalla. La opción elegida usa la variante `primary`
 * y el resto `outline`: los colores salen de la variante y no de clases que compitan entre sí.
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
    <VStack className="w-full gap-2" testID={testID}>
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
              aria-checked={isSelected}
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              isDisabled={isDisabled}
              key={option.value}
              onPress={() => onChange(option.value)}
              role="radio"
              testID={`${testID}-${option.value.replace(/_/g, "-")}`}
              variant={isSelected ? "primary" : "outline"}
            >
              <ButtonText>{option.label}</ButtonText>
            </Button>
          );
        })}
      </VStack>
    </VStack>
  );
}
