import { useRef } from "react";
import type { View } from "react-native";
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

/** Desplazamiento de cada tecla dentro del grupo; `Home`/`End` van a los extremos. */
const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Grupo de opciones accesible (radio) para vocabularios cerrados: etiqueta programática,
 * operable por teclado con foco visible (usa `Button`) y estado `checked` expuesto a los
 * lectores de pantalla. La opción elegida usa la variante `primary`
 * y el resto `outline`: los colores salen de la variante y no de clases que compitan entre sí.
 *
 * En web sigue el patrón ARIA radio group (FR-080 · design.md D19): una sola parada de Tab (la
 * opción elegida, o la primera) y flechas, `Home` y `End` para elegir y mover el foco. En nativo,
 * el lector de pantalla recorre el grupo por sí mismo.
 */
export function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
  isDisabled = false,
}: OptionPickerProps<T>) {
  const refs = useRef(new Map<T, View | null>());
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusStop = selectedIndex === -1 ? 0 : selectedIndex;

  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (isDisabled || options.length === 0) return;
    const last = options.length - 1;
    const step = STEPS[event.key];
    let next: number;
    if (step !== undefined) next = (focusStop + step + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current.get(option.value)?.focus();
  };

  return (
    <VStack className="w-full gap-2" testID={testID}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <VStack
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        className="flex-row flex-wrap gap-2"
        // `onKeyDown` solo existe en web (RNW); en nativo no se emite.
        {...({ onKeyDown } as object)}
        role="radiogroup"
      >
        {options.map((option, index) => {
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
              ref={(node: View | null) => {
                refs.current.set(option.value, node);
              }}
              role="radio"
              // Solo web: en RN, `tabIndex` -1 es `focusable=false` y dejaría las opciones
              // inalcanzables con teclado físico en Android (revisión de la PR #38).
              tabIndex={process.env.EXPO_OS === "web" ? (index === focusStop ? 0 : -1) : undefined}
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
