import { type Ref, useLayoutEffect, useRef, useState } from "react";
import { TextInput, type TextInputProps, View, type ViewProps } from "react-native";
import { useFormControl } from "@/components/ui/form-control";
import { useThemeColors } from "@/theme/use-theme-colors";
import { CONTINUOUS_CURVE } from "./border-curve";

export type InputProps = ViewProps & { className?: string };

export function Input({ className, style, ...props }: InputProps) {
  const { isInvalid } = useFormControl();
  return (
    <View
      className={`w-full flex-row items-center rounded-sm border bg-card ${
        isInvalid ? "border-destructive" : "border-input"
      } ${className ?? ""}`.trim()}
      style={[CONTINUOUS_CURVE, style]}
      {...props}
    />
  );
}

// `ref` como prop (React 19): el acceso pasa el foco del correo a la contraseña (D16).
type InputFieldHandle = TextInput;
export type InputFieldProps = TextInputProps & { className?: string; ref?: Ref<InputFieldHandle> };

const IS_WEB = process.env.EXPO_OS === "web";
// Relleno vertical de `py-3`: en web `contentSize` ya lo incluye (`scrollHeight`); en nativo no.
const VERTICAL_PADDING = IS_WEB ? 0 : 24;

export function InputField({
  className,
  style,
  onContentSizeChange,
  ref,
  ...props
}: InputFieldProps) {
  const { isInvalid } = useFormControl();
  const colors = useThemeColors();
  // Un campo multilínea crece con su contenido desde su mínimo (`min-h-textarea`), para que el
  // texto no quede oculto tras un desplazamiento interno (revisión final de D20).
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const node = useRef<InputFieldHandle | null>(null);

  // Web: `scrollHeight` no baja de la altura fijada, así que se mide con `height: auto` para que
  // el campo también encoja al borrar (revisión de la PR #41). Al ser un efecto de layout, la
  // primera medida ocurre antes del primer pintado y no produce un salto.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se vuelve a medir con cada valor.
  useLayoutEffect(() => {
    if (!IS_WEB || !props.multiline) return;
    const textarea = node.current as unknown as HTMLTextAreaElement | null;
    if (!textarea) return;
    textarea.style.height = "auto";
    const height = textarea.scrollHeight;
    textarea.style.height = `${height}px`;
    setContentHeight(height);
  }, [props.multiline, props.value]);

  return (
    <TextInput
      aria-invalid={isInvalid}
      // `focus:` keeps a visible focus ring on web (WCAG 2.2 AA 2.4.7), same contract as Button.
      // `min-w-0`: en web el `<input>` tiene ancho intrínseco y no dejaba sitio a un control al lado.
      className={`min-h-touch min-w-0 flex-1 px-4 py-3 font-sans text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        className ?? ""
      }`.trim()}
      placeholderTextColor={colors["muted-foreground"]}
      // Inline on purpose: on web, React Native Web's TextInput reset outranks a
      // `text-foreground` utility and left typed text at 2.53:1 (axe color-contrast).
      onContentSizeChange={(event) => {
        if (props.multiline) {
          setContentHeight(event.nativeEvent.contentSize.height + VERTICAL_PADDING);
        }
        onContentSizeChange?.(event);
      }}
      style={[
        { color: colors.foreground },
        props.multiline && contentHeight !== null ? { height: contentHeight } : null,
        style,
      ]}
      {...props}
      ref={(instance: InputFieldHandle | null) => {
        node.current = instance;
        if (typeof ref === "function") ref(instance);
        else if (ref) ref.current = instance;
      }}
    />
  );
}
