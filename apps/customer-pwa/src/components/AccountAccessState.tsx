import { AppButton } from "@home/ui";
import { Link, useLocation } from "react-router-dom";
import { EmptyState } from "./ui";
import { useTranslation } from "../lib/language";

export function AccountAccessState({
  label,
  title = "Sign in to continue",
  description = "Sign in to save your request and use your profile details.",
  unauthorized,
  retry,
  pending = false,
}: {
  label: string;
  title?: string;
  description?: string;
  unauthorized: boolean;
  retry: () => unknown;
  pending?: boolean;
}) {
  const location = useLocation();
  const { t } = useTranslation();
  return (
    <section className="section page customer-state-page">
      <h1 className="customer-state-label">{t(label)}</h1>
      <div role={unauthorized ? undefined : "alert"}>
        <EmptyState
          kind={unauthorized ? "auth" : "network"}
          title={unauthorized ? title : "We couldn't connect"}
          description={
            unauthorized
              ? description
              : "Check your connection and try again. Your details are safe."
          }
          primaryAction={
            unauthorized ? (
              <Link
                className="primary"
                to={`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`}
              >
                {t("Sign in")}
              </Link>
            ) : (
              <AppButton
                variant="primary"
                pending={pending}
                pendingLabel="Loading..."
                onClick={retry}
              >
                {t("Try again")}
              </AppButton>
            )
          }
          secondaryAction={
            <Link className="customer-state-secondary" to="/services">
              {t("Browse services")}
            </Link>
          }
        />
      </div>
    </section>
  );
}
