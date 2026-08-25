import { felipeSeed } from "./seed";

/** @deprecated Use the typed ambassador repository in `lib/ambassadors.ts`. */
export const siteConfig = {
  brand: { name: "Simpliza", primaryColor: "#004568", actionColor: "#16A74A", accentColor: "#51C1E1", bodyFont: "Work Sans", headingFont: "Roboto Slab" },
  ambassador: felipeSeed,
} as const;
