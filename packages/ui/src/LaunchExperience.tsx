import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FaArrowRight,
  FaCalendarDays,
  FaScrewdriverWrench,
  FaClipboardCheck,
} from "react-icons/fa6";
import "./launch.css";

const logo = new URL(
  "./assets/fixbeez-original-logo-transparent.png",
  import.meta.url,
).href;
const onboardingKey = "fixbeez.customer.onboarding.v1";
const steps = [
  {
    icon: FaScrewdriverWrench,
    label: "CARE FOR YOUR HOME",
    title: "A little help. A happier home.",
    description:
      "Request appliance service, repair or installation in a few simple steps.",
    detail: "Choose your appliance and tell us what needs attention.",
  },
  {
    icon: FaCalendarDays,
    label: "PLAN YOUR VISIT",
    title: "Make room for what matters.",
    description:
      "Share your address and choose a preferred date and time for your service visit.",
    detail: "Our executive will contact you to coordinate your request.",
  },
  {
    icon: FaClipboardCheck,
    label: "STAY IN THE LOOP",
    title: "Your requests, all together.",
    description:
      "Follow your service requests and see their latest status in My Requests.",
    detail: "View request details and share feedback after completion.",
  },
];

function needsOnboarding(role: string) {
  if (role !== "customer") return false;
  try {
    return localStorage.getItem(onboardingKey) !== "complete";
  } catch {
    return true;
  }
}

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
  const [phase, setPhase] = useState<"splash" | "onboarding" | "app">(() => {
    try {
      return sessionStorage.getItem(launchKey) === "complete" &&
        !needsOnboarding(role)
        ? "app"
        : "splash";
    } catch {
      return "splash";
    }
  });
  const [step, setStep] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
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
    if (animationDone && ready && phase === "splash")
      setPhase(needsOnboarding(role) ? "onboarding" : "app");
  }, [animationDone, ready, phase, role]);
  useEffect(() => {
    if (phase === "onboarding") heading.current?.focus();
    if (phase === "app") {
      try {
        sessionStorage.setItem(launchKey, "complete");
      } catch {
        /* Storage may be disabled. */
      }
    }
  }, [phase, step, launchKey]);
  function finish() {
    try {
      localStorage.setItem(onboardingKey, "complete");
    } catch {
      /* Storage may be disabled. */
    }
    setPhase("app");
  }
  if (phase === "app" && ready)
    return <div className="fb-app-enter">{children}</div>;
  const current = steps[step] ?? steps[0]!;
  const Icon = current.icon;
  return (
    <main
      className={`fb-launch fb-launch--${phase === "app" ? "splash" : phase}`}
      aria-label={phase === "splash" ? "Welcome to Fixbeez" : "Welcome guide"}
    >
      <div className="fb-launch__pattern" aria-hidden="true" />
      {phase !== "onboarding" ? (
        <div className="fb-launch__splash" role="status">
          <div className="fb-launch__halo" aria-hidden="true" />
          <img className="fb-launch__logo" src={logo} alt="Fixbeez" />
          <p className="fb-launch__tagline">We fit it. We fix it.</p>
          <p className="fb-launch__role">
            {!ready
              ? "Restoring your session…"
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
      ) : (
        <div className="fb-launch__guide">
          <header className="fb-launch__header">
            <img src={logo} alt="Fixbeez" />
            <button type="button" onClick={finish}>
              Skip intro
            </button>
          </header>
          <div className="fb-launch__art" aria-hidden="true">
            <div className="fb-launch__hex">
              <Icon />
            </div>
            <span className="fb-launch__smallhex fb-launch__smallhex--one" />
            <span className="fb-launch__smallhex fb-launch__smallhex--two" />
          </div>
          <section className="fb-launch__copy" key={step}>
            <p className="fb-launch__eyebrow">{current.label}</p>
            <h1 ref={heading} tabIndex={-1}>
              {current.title}
            </h1>
            <p className="fb-launch__description">{current.description}</p>
            <p className="fb-launch__detail">{current.detail}</p>
          </section>
          <footer className="fb-launch__footer">
            <nav className="fb-launch__dots" aria-label="Introduction steps">
              {steps.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={`Step ${i + 1}: ${item.label.toLowerCase()}`}
                  aria-current={step === i ? "step" : undefined}
                  onClick={() => setStep(i)}
                >
                  <span />
                </button>
              ))}
            </nav>
            <p className="fb-launch__count">
              {step + 1} of {steps.length}
            </p>
            <button
              type="button"
              className="fb-launch__next"
              onClick={() =>
                step === steps.length - 1 ? finish() : setStep(step + 1)
              }
            >
              {step === steps.length - 1 ? "Get started" : "Continue"}
              <FaArrowRight aria-hidden="true" />
            </button>
            {step > 0 && (
              <button
                type="button"
                className="fb-launch__back"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
          </footer>
        </div>
      )}
    </main>
  );
}
