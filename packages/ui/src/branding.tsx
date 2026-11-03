import type { ReactNode } from "react";

export const brandLogoUrl = new URL(
  "./assets/fixbeez-original-logo-transparent.png",
  import.meta.url,
).href;

export function BrandLogo({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <img
      className={`fb-brand-logo ${compact ? "fb-brand-logo--compact" : ""} ${className}`}
      src={brandLogoUrl}
      alt="Fixbeez"
      decoding="async"
    />
  );
}

export function HoneycombAccent() {
  return <span className="fb-honeycomb-corner" aria-hidden="true" />;
}

export function GradientHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header className={`fb-header-gradient ${className}`}>
      <HoneycombAccent />
      {children}
    </header>
  );
}
