/**
 * Espejo de los tokens de `src/global.css` para los estilos que no pueden ir por `className`
 * (el reset de `TextInput` en React Native Web gana a las utilidades de color, y
 * `placeholderTextColor` es una prop). `tests/unit/theme/tema.test.ts` falla si se desalinea.
 */
export const palette = {
  light: {
    background: "rgb(245 248 247)",
    foreground: "rgb(4 5 5)",
    card: "rgb(255 255 255)",
    "card-foreground": "rgb(3 14 12)",
    popover: "rgb(239 249 247)",
    "popover-foreground": "rgb(3 14 12)",
    primary: "rgb(24 122 106)",
    "primary-foreground": "rgb(242 252 251)",
    secondary: "rgb(75 120 168)",
    "secondary-foreground": "rgb(253 254 254)",
    muted: "rgb(233 238 236)",
    "muted-foreground": "rgb(67 86 78)",
    accent: "rgb(215 154 61)",
    "accent-foreground": "rgb(79 54 16)",
    destructive: "rgb(224 14 0)",
    "destructive-foreground": "rgb(255 255 255)",
    border: "rgb(233 241 239)",
    input: "rgb(101 151 144)",
    ring: "rgb(97 153 139)",
  },
  dark: {
    background: "rgb(1 4 4)",
    foreground: "rgb(247 253 252)",
    card: "rgb(22 38 35)",
    "card-foreground": "rgb(247 253 252)",
    popover: "rgb(39 46 45)",
    "popover-foreground": "rgb(247 253 252)",
    primary: "rgb(67 218 193)",
    "primary-foreground": "rgb(0 0 0)",
    secondary: "rgb(109 148 188)",
    "secondary-foreground": "rgb(26 41 58)",
    muted: "rgb(31 40 37)",
    "muted-foreground": "rgb(117 148 135)",
    accent: "rgb(213 153 61)",
    "accent-foreground": "rgb(76 52 16)",
    destructive: "rgb(254 67 54)",
    "destructive-foreground": "rgb(0 0 0)",
    border: "rgb(58 68 66)",
    input: "rgb(96 114 111)",
    ring: "rgb(97 113 110)",
  },
} as const;

export type ThemeToken = keyof (typeof palette)["light"];
