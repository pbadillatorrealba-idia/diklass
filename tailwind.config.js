/** @type {import('tailwindcss').Config} */

// Los valores viven en `src/global.css` como canales RGB, con variante clara y oscura.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // En nativo NativeWind usa solo la primera familia (no hay fuentes de respaldo); el resto
      // cubre la web mientras carga la fuente.
      fontFamily: {
        sans: ["Atkinson Hyperlegible Next", "system-ui", "sans-serif"],
      },
      // Dimensiones del sistema visual (design.md D6).
      maxWidth: {
        content: "720px", // una columna de lectura
        wide: "1200px", // consulta a dos columnas en escritorio
        dialog: "440px",
        form: "480px", // formularios centrados (login)
      },
      minHeight: {
        touch: "44px", // área táctil mínima (WCAG 2.5.8 / HIG)
        textarea: "120px",
      },
      // `foreground` va antes que el resto de colores de texto: los componentes base ponen
      // `text-foreground` por defecto y en web gana la utilidad que se genera después.
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
          surface: token("destructive-surface"),
        },
        // Estados (FR-075): `{estado}` texto/icono/borde, `-foreground` sobre el relleno sólido,
        // `-surface` fondo tintado con `foreground` encima.
        warning: {
          DEFAULT: token("warning"),
          foreground: token("warning-foreground"),
          surface: token("warning-surface"),
        },
        success: {
          DEFAULT: token("success"),
          foreground: token("success-foreground"),
          surface: token("success-surface"),
        },
        info: {
          DEFAULT: token("info"),
          foreground: token("info-foreground"),
          surface: token("info-surface"),
        },
        // Borde de lo generado por el sistema y aún no validado (FR-076).
        suggested: token("suggested"),
        // Capa bajo los diálogos; siempre con opacidad (`bg-scrim/55`).
        scrim: token("scrim"),
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
      },
    },
  },
  plugins: [],
};
