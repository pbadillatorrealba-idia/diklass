import type { IconName } from "@/components/ui/icon";

/**
 * Secciones principales de la app (FR-082 · design.md D12). `name` es el grupo de rutas de
 * `src/app/(protected)/`; `icon` es el icono de `Icon` en web, y `sf`/`md` los de la barra de
 * pestañas nativa (SF Symbols en iOS, Material Symbols en Android).
 */
export const SECTIONS = [
  { name: "(home)", href: "/home", label: "Inicio", icon: "home-outline", sf: "house", md: "home" },
  {
    name: "(patients)",
    href: "/patients",
    label: "Pacientes",
    icon: "paw",
    sf: "pawprint",
    md: "pets",
  },
  {
    name: "(follow-up)",
    href: "/follow-up",
    label: "Seguimiento",
    icon: "clipboard-pulse-outline",
    sf: "waveform.path.ecg",
    md: "monitor_heart",
  },
  {
    name: "(knowledge)",
    href: "/knowledge",
    label: "Conocimiento",
    icon: "book-open-variant",
    sf: "book",
    md: "menu_book",
  },
  {
    name: "(settings)",
    href: "/settings",
    label: "Configuración",
    icon: "cog-outline",
    sf: "gearshape",
    md: "settings",
  },
] as const satisfies ReadonlyArray<{
  name: string;
  href: string;
  label: string;
  icon: IconName;
  sf: string;
  md: string;
}>;

export type Section = (typeof SECTIONS)[number];

/**
 * Barra inferior web: a 320 px solo caben 4 secciones con el nombre visible (D17). Configuración
 * se alcanza desde el avatar de la barra superior compacta.
 */
export const TABBAR_SECTIONS = SECTIONS.filter((section) => section.name !== "(settings)");
