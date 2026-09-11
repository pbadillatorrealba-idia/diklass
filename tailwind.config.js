/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Clinical palette. Kept as CSS-variable-free literals so the same tokens
        // resolve identically on iOS, Android and web without a runtime theme pass.
        background: "#f8fafc",
        foreground: "#0f172a",
        primary: "#0369a1",
        "primary-foreground": "#f8fafc",
        destructive: "#b91c1c",
        muted: "#e2e8f0",
        border: "#cbd5e1",
      },
    },
  },
  plugins: [],
};
