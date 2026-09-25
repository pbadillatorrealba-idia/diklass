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

// El bloque claro es el primer `:root`; el oscuro, el `:root` dentro de la media query.
const [lightBlock = "", darkSection = ""] = CSS.split("@media (prefers-color-scheme: dark)");
const schemes: Record<"light" | "dark", Record<string, Rgb>> = {
  light: tokensOf(lightBlock),
  dark: tokensOf(darkSection),
};

const TOKENS: ThemeToken[] = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
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
  ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["destructive", "background", 4.5],
  ["destructive", "card", 4.5],
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

  test.each(files)("%s no usa hex ni la paleta fija de Tailwind", (path) => {
    const text = readFileSync(path, "utf8");
    expect(text.match(/["'`]#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(
      text.match(
        /\b(?:bg|text|border|ring|outline|placeholder)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/g,
      ) ?? [],
    ).toEqual([]);
  });
});

describe("tipografía Atkinson Hyperlegible Next", () => {
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

  // React Native no hereda la fuente: cada primitivo de texto debe declararla.
  const primitives = sourceFiles(join("src", "components", "ui")).filter((path) =>
    /<(RNText|TextInput)\b/.test(readFileSync(path, "utf8")),
  );

  test("hay primitivos de texto que revisar", () => {
    expect(primitives.length).toBeGreaterThan(0);
  });

  test.each(primitives)("%s aplica font-sans a cada texto", (path) => {
    const text = readFileSync(path, "utf8");
    const elements = text.match(/<(?:RNText|TextInput)\b[\s\S]*?className=\{?[`"][^`"]*/g) ?? [];
    expect(elements.length).toBe((text.match(/<(?:RNText|TextInput)\b/g) ?? []).length);
    for (const element of elements) expect(element).toContain("font-sans");
  });
});
