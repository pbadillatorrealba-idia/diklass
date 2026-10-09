import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { palette, type ThemeToken } from "@/theme/colors";

const CSS = readFileSync("src/global.css", "utf8");

type Rgb = [number, number, number];

function tokensOf(block: string): Record<string, Rgb> {
  const tokens: Record<string, Rgb> = {};
  for (const [, name, r, g, b] of block.matchAll(/--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) {
    if (name) tokens[name] = [Number(r), Number(g), Number(b)];
  }
  return tokens;
}

// El bloque claro es el primer `:root`; el oscuro, el `:root` dentro de la media query (modo
// `system`, y el que usa NativeWind en nativo). `:root.light`/`:root.dark` fuerzan el modo en web
// (FR-091 · design.md D17) y deben repetir exactamente esos valores.
const blockAfter = (marker: string) => {
  const start = CSS.indexOf(marker);
  if (start < 0) return "";
  return CSS.slice(start, CSS.indexOf("}", start));
};
const lightBlock = blockAfter(":root {");
const darkSection = blockAfter("@media (prefers-color-scheme: dark)");
const schemes: Record<"light" | "dark", Record<string, Rgb>> = {
  light: tokensOf(lightBlock),
  dark: tokensOf(darkSection),
};

describe("modo forzado en web (FR-091)", () => {
  test.each([
    [":root.light {", "light"],
    [":root.dark {", "dark"],
  ] as const)("%s repite los tokens del esquema %s", (marker, scheme) => {
    expect(tokensOf(blockAfter(marker))).toEqual(schemes[scheme]);
  });
});

const TOKENS: ThemeToken[] = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "primary-surface",
  "secondary",
  "secondary-foreground",
  "secondary-surface",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "destructive-surface",
  "warning",
  "warning-foreground",
  "warning-surface",
  "success",
  "success-foreground",
  "success-surface",
  "info",
  "info-foreground",
  "info-surface",
  "suggested",
  "suggested-surface",
  "correction",
  "correction-surface",
  "stamp",
  "scrim",
  "border",
  "input",
  "ring",
];

function luminance([r, g, b]: Rgb) {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// WCAG 2.2 AA: 4.5:1 para texto (1.4.3) y 3:1 para bordes de campo y foco (1.4.11).
const PAIRS: [ThemeToken, ThemeToken, number][] = [
  ["foreground", "background", 4.5],
  ["foreground", "card", 4.5],
  ["foreground", "muted", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary", "background", 4.5],
  ["primary", "card", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5],
  // Superficies tintadas opacas (D4): evidencia y fragmento citado sobre `primary-surface`,
  // ficha sobre `secondary-surface`. Cualquier superficie que admite `tone="muted"` va aquí.
  ...(["primary-surface", "secondary-surface"] as const).flatMap(
    (surface): [ThemeToken, ThemeToken, number][] => [
      ["foreground", surface, 4.5],
      ["muted-foreground", surface, 4.5],
    ],
  ),
  ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["destructive", "background", 4.5],
  ["destructive", "card", 4.5],
  // Estados (FR-075 · design.md D4): `{estado}` sirve de texto, icono y borde sobre card/fondo;
  // `{estado}-foreground` va sobre el relleno sólido; `foreground` sobre `{estado}-surface`.
  ...(["warning", "success", "info"] as const).flatMap(
    (state): [ThemeToken, ThemeToken, number][] => [
      [state, "background", 4.5],
      [state, "card", 4.5],
      [`${state}-foreground`, state, 4.5],
      ["foreground", `${state}-surface`, 4.5],
      [state, `${state}-surface`, 3],
    ],
  ),
  ["foreground", "destructive-surface", 4.5],
  ["destructive", "destructive-surface", 3],
  // Formulario en copias (D20). Lo sugerido es un pliego canario (`suggested-surface`) con
  // contorno de 1 px `suggested` (3:1, no textual); la corrección, un pliego rosa con la marca
  // `correction`, que también es texto; el timbre de firma (`stamp`) es texto sobre la hoja.
  ["suggested", "background", 3],
  ["suggested", "card", 3],
  ["suggested", "suggested-surface", 3],
  ["correction", "card", 4.5],
  ["correction", "background", 4.5],
  ["correction", "correction-surface", 3],
  ["stamp", "card", 4.5],
  ["stamp", "background", 4.5],
  ...(["suggested-surface", "correction-surface"] as const).flatMap(
    (surface): [ThemeToken, ThemeToken, number][] => [
      ["foreground", surface, 4.5],
      ["muted-foreground", surface, 4.5],
    ],
  ),
  // Banda preimpresa de `FormSection`: número y título en `primary` sobre `primary-surface`.
  ["primary", "primary-surface", 4.5],
  // Separación card/fondo (D4): borde decorativo, sin umbral WCAG; mínimo acordado 1.4:1.
  ["border", "card", 1.4],
  ["input", "background", 3],
  ["input", "card", 3],
  ["ring", "background", 3],
  ["ring", "card", 3],
];

describe.each(Object.entries(schemes))("tema %s", (scheme, tokens) => {
  test("define todos los tokens", () => {
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
  });

  test("el espejo en TypeScript coincide con global.css", () => {
    const mirror = palette[scheme as keyof typeof palette];
    for (const token of TOKENS) {
      expect(`${token}: ${mirror[token]}`).toBe(`${token}: rgb(${tokens[token]?.join(" ")})`);
    }
  });

  test.each(PAIRS)("%s sobre %s alcanza %d:1", (fg, bg, min) => {
    const [a, b] = [tokens[fg], tokens[bg]];
    if (!a || !b) throw new Error(`falta ${fg} o ${bg}`);
    expect(contrast(a, b)).toBeGreaterThanOrEqual(min);
  });
});

// ΔE*ab (CIE76) entre dos colores sRGB, vía CIELAB con iluminante D65.
function deltaE(a: Rgb, b: Rgb) {
  const lab = (rgb: Rgb) => {
    const linear = rgb.map((value) => {
      const v = value / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    const [r = 0, g = 0, bl = 0] = linear;
    const xyz = [
      (0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047,
      0.2126 * r + 0.7152 * g + 0.0722 * bl,
      (0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883,
    ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116));
    const [x = 0, y = 0, z = 0] = xyz;
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(...p.map((value, index) => value - (q[index] ?? 0)));
}

// Entre dos pasteles el contraste de luminancia no sirve (D20): la corrección y el error se
// separan en tono, sobre los valores finales de cada bloque.
describe("corrección frente a error (D20)", () => {
  test.each([
    [":root {", lightBlock],
    ["@media (prefers-color-scheme: dark)", darkSection],
    [":root.light {", blockAfter(":root.light {")],
    [":root.dark {", blockAfter(":root.dark {")],
  ])("%s separa correction-surface de destructive-surface (ΔE*ab ≥ 10)", (_, block) => {
    const tokens = tokensOf(block);
    const [a, b] = [tokens["correction-surface"], tokens["destructive-surface"]];
    if (!a || !b) throw new Error("falta correction-surface o destructive-surface");
    expect(deltaE(a, b)).toBeGreaterThanOrEqual(10);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("colores fuera del tema", () => {
  // Solo el tema fija valores de color; el resto consume tokens para seguir el modo oscuro.
  const files = sourceFiles("src").filter(
    (path) => !path.startsWith(join("src", "theme")) && !path.endsWith("database.types.ts"),
  );

  test("hay archivos que revisar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const LITERALS = [
    /["'`]#[0-9a-fA-F]{3,8}\b/g,
    /\brgba?\([^)]*\)/g,
    /\b(?:bg|text|border|ring|outline|placeholder)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/g,
    // Escalas numeradas (p. ej. `text-warning-700` de gluestack): no existen en el tema y se
    // renderizan sin color.
    /\b(?:bg|text|border|ring|outline|placeholder)-[a-z]+-\d{2,3}\b/g,
    // Deriva ya migrada (sistema-visual, design.md D5–D6): tono y tamaños con nombre, dimensiones
    // del tema y radios de la regla control/superficie.
    /\btext-foreground\/\d+\b/g,
    /\btext-xs\b/g,
    /\b(?:max-w|min-h|max-h|min-w|w|h)-\[[^\]]+\]/g,
    /\brounded-2xl\b/g,
    // Forma de D20: `rounded-sm` (2 px) en controles y superficies, `rounded-full` solo en el
    // avatar, y ningún borde lateral grueso (lo sugerido se marca con pliego y contorno de 1 px).
    /\brounded-(?:lg|xl)\b/g,
    /\bborder-l-[2-8]\b/g,
    /\bgap(?:-[xy])?-\d+\.\d+\b/g,
    // Tintes translúcidos (D4): se componen al pintar y el contraste de este archivo no los mide.
    // Solo `scrim` se usa con opacidad; el resto de superficies son tokens opacos (`*-surface`).
    /\b(?:bg|border|text|ring|outline)-(?!scrim\/)[a-z]+(?:-[a-z]+)*\/\d+\b/g,
    // Estilo de código de D15: `process.env.EXPO_OS` (el bundle elimina las ramas de otras
    // plataformas) y `React.use` de React 19.
    /\bPlatform\.OS\b/g,
    /\buseContext\(/g,
  ];

  // FR-081 · SC-051: cada hallazgo se reporta como `archivo:línea literal`.
  test.each(files)("%s no usa colores literales ni valores fuera del sistema visual", (path) => {
    const found = readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        LITERALS.flatMap((pattern) => line.match(pattern) ?? []).map(
          (literal) => `${path}:${index + 1} ${literal}`,
        ),
      );
    expect(found).toEqual([]);
  });
});

describe("tipografía Atkinson Hyperlegible Next y Mono", () => {
  const FAMILY = "Atkinson Hyperlegible Next";
  const WEIGHTS = { 400: "400Regular", 500: "500Medium", 600: "600SemiBold", 700: "700Bold" };
  const app = JSON.parse(readFileSync("app.json", "utf8"));
  const fontPlugin = app.expo.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-font",
  );

  test.each(Object.entries(WEIGHTS))(
    "peso %s: TTF nativo, WOFF2 web y @font-face",
    (weight, file) => {
      const ttf = `./assets/fonts/AtkinsonHyperlegibleNext_${file}.ttf`;
      expect(statSync(ttf).size).toBeGreaterThan(0);
      expect(statSync(`public/fonts/AtkinsonHyperlegibleNext_${file}.woff2`).size).toBeGreaterThan(
        0,
      );

      // Android agrupa los pesos en una familia XML; iOS la lee del propio archivo.
      const [android] = fontPlugin[1].android.fonts;
      expect(android.fontFamily).toBe(FAMILY);
      expect(android.fontDefinitions).toContainEqual({ path: ttf, weight: Number(weight) });
      expect(fontPlugin[1].ios.fonts).toContain(ttf);

      const face = CSS.split("@font-face").find((block) =>
        block.includes(`AtkinsonHyperlegibleNext_${file}.woff2`),
      );
      expect(face).toContain(`font-family: "${FAMILY}"`);
      expect(face).toContain(`font-weight: ${weight}`);
    },
  );

  // Atkinson Hyperlegible Mono (D20): solo para datos, en 400 y 600. En web se sirve el
  // subconjunto latino y no se precarga (no aparece en el primer pintado de `/login`); el
  // `@font-face` de respaldo con métricas de reemplazo evita el salto al cambiar de fuente.
  const MONO = "Atkinson Hyperlegible Mono";
  test.each([
    [400, "400Regular"],
    [600, "600SemiBold"],
  ])("mono %d: TTF nativo, WOFF2 web y @font-face con swap", (weight, file) => {
    const ttf = `./assets/fonts/AtkinsonHyperlegibleMono_${file}.ttf`;
    expect(statSync(ttf).size).toBeGreaterThan(0);
    expect(statSync(`public/fonts/AtkinsonHyperlegibleMono_${file}.woff2`).size).toBeGreaterThan(0);
    const android = fontPlugin[1].android.fonts.find(
      (font: { fontFamily: string }) => font.fontFamily === MONO,
    );
    expect(android?.fontDefinitions).toContainEqual({ path: ttf, weight });
    expect(fontPlugin[1].ios.fonts).toContain(ttf);

    const face = CSS.split("@font-face").find((block) =>
      block.includes(`AtkinsonHyperlegibleMono_${file}.woff2`),
    );
    expect(face).toContain(`font-family: "${MONO}"`);
    expect(face).toContain(`font-weight: ${weight}`);
    expect(face).toContain("font-display: swap");
  });

  test("la mono tiene respaldo con métricas de reemplazo y no se precarga", () => {
    const fallback = CSS.split("@font-face").find((block) =>
      block.includes(`font-family: "${MONO} Fallback"`),
    );
    expect(fallback).toContain("size-adjust:");
    expect(fallback).toContain("ascent-override:");
    expect(readFileSync("src/app/+html.tsx", "utf8")).not.toContain("AtkinsonHyperlegibleMono");
    const tailwind = readFileSync("tailwind.config.js", "utf8");
    expect(tailwind).toContain(`mono: ["${MONO}", "${MONO} Fallback"`);
  });

  // Presupuesto de fuentes de texto en web (design.md, Performance budgets): ≤ 140 KB.
  test("las fuentes de texto web caben en 140 KB", () => {
    const total = readdirSync("public/fonts")
      .filter((name) => name.endsWith(".woff2"))
      .reduce((sum, name) => sum + statSync(join("public/fonts", name)).size, 0);
    expect(total).toBeLessThanOrEqual(140 * 1024);
  });

  // React Native no hereda la fuente: cada primitivo de texto debe declararla.
  const primitives = sourceFiles(join("src", "components", "ui")).filter((path) =>
    /<(RNText|TextInput)\b/.test(readFileSync(path, "utf8")),
  );

  test("hay primitivos de texto que revisar", () => {
    expect(primitives.length).toBeGreaterThan(0);
  });

  // `Text` toma la familia de su variante (`font-sans` o, para datos, `font-mono`; D20): entonces
  // cada entrada de su mapa `VARIANTS` debe declararla.
  test.each(primitives)("%s aplica font-sans o font-mono a cada texto", (path) => {
    const text = readFileSync(path, "utf8");
    const elements = text.match(/<(?:RNText|TextInput)\b[\s\S]*?className=\{?[`"][^`"]*/g) ?? [];
    expect(elements.length).toBe((text.match(/<(?:RNText|TextInput)\b/g) ?? []).length);
    const variants = text.match(/const VARIANTS = \{([\s\S]*?)\} as const/)?.[1];
    for (const element of elements) {
      if (element.includes("font-sans")) continue;
      expect(element).toContain("VARIANTS[variant]");
      const values = variants?.match(/"[^"]*"/g) ?? [];
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) expect(value).toMatch(/\bfont-(?:sans|mono)\b/);
    }
  });
});
