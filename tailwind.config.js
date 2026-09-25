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
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
      },
    },
  },
  plugins: [],
};
