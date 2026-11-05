import { useEffect, useState, type ReactNode } from "react";
import "./launch.css";

const logo = new URL(
  "./assets/fixbeez-original-logo-transparent.png",
  import.meta.url,
).href;
/** Keeps the current URL intact, including booking links and authentication callbacks. */
export function LaunchExperience({
  role,
  children,
  ready = true,
}: {
  role: "customer" | "admin" | "technician";
  children: ReactNode;
  ready?: boolean;
}) {
  const launchKey = `fixbeez.${role}.launched.v1`;
  const [phase, setPhase] = useState<"splash" | "app">(() => {
    try {
      return sessionStorage.getItem(launchKey) === "complete"
        ? "app"
        : "splash";
    } catch {
      return "splash";
    }
  });
  const [animationDone, setAnimationDone] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => setAnimationDone(true),
      reduced ? 0 : 1200,
    );
    return () => window.clearTimeout(timer);
  }, [role]);
  useEffect(() => {
    if (animationDone && ready && phase === "splash") setPhase("app");
  }, [animationDone, ready, phase, role]);
  useEffect(() => {
    if (phase === "app") {
      try {
        sessionStorage.setItem(launchKey, "complete");
      } catch {
        /* Storage may be disabled. */
      }
    }
  }, [phase, launchKey]);
  if (phase === "app" && ready)
    return <div className="fb-app-enter">{children}</div>;
  return (
    <main
      className="fb-launch fb-launch--splash"
      aria-label="Welcome to Fixbeez"
    >
      <div className="fb-launch__pattern" aria-hidden="true" />

      <div className="fb-launch__splash" role="status">
        <div className="fb-launch__halo" aria-hidden="true" />
        <img className="fb-launch__logo" src={logo} alt="Fixbeez" />
        <p className="fb-launch__tagline">We fit it. We fix it.</p>
        <p className="fb-launch__role">
          {!ready
            ? "Restoring your session..."
            : role === "customer"
              ? "Home appliance service & installation"
              : role === "admin"
                ? "Operations workspace"
                : "Technician workspace"}
        </p>
        <div className="fb-launch__loader" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </div>
        <span className="fb-launch__sr">Opening Fixbeez</span>
      </div>
    </main>
  );
}
