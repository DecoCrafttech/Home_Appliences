export type Locale = "en" | "ta";
export const messages = {
  en: { appName: "Home Services" },
  ta: { appName: "இல்ல சேவைகள்" },
} satisfies Record<Locale, { appName: string }>;
