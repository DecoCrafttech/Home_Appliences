export type Locale = "en" | "ta";
export const messages = {
  en: { appName: "Fixbeez" },
  ta: { appName: "இல்ல சேவைகள்" },
} satisfies Record<Locale, { appName: string }>;
