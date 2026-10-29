export function contactPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\s()-]/g, "");
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(cleaned)) return null;
  return cleaned.startsWith("+91") ? cleaned : "+91" + cleaned;
}
