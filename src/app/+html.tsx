import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const FIRST_PAINT_FONTS = ["400Regular", "500Medium", "600SemiBold", "700Bold"];

// Web-only root document for static rendering; runs in Node.js, with no DOM access.
// `lang="es"` matches the Spanish UI (WCAG 3.1.1); screens refine the title per page.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta content="IE=edge" httpEquiv="X-UA-Compatible" />
        <meta content="width=device-width, initial-scale=1, shrink-to-fit=no" name="viewport" />
        <title>Diklass</title>
        {/* Pesos del primer pintado (cuerpo, etiquetas, botones y títulos): evitan el salto de fuente. */}
        {FIRST_PAINT_FONTS.map((file) => (
          <link
            as="font"
            crossOrigin="anonymous"
            href={`/fonts/AtkinsonHyperlegibleNext_${file}.woff2`}
            key={file}
            rel="preload"
            type="font/woff2"
          />
        ))}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
