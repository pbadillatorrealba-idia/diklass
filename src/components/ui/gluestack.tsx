import { config } from "@gluestack-ui/config";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import type { PropsWithChildren } from "react";

export function AppUiProvider({ children }: PropsWithChildren) {
  return <GluestackUIProvider config={config}>{children}</GluestackUIProvider>;
}
