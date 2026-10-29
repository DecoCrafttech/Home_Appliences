import { AppCheckbox, AppInput, AppSelect, AppTextarea } from "@home/ui";
import { ConfirmActionDialog, AppButton as SafeAsyncButton } from "@home/ui";
import { customerKeys } from "./lib/queryKeys";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
  useBlocker,
  useBeforeUnload,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  indicativePrice,
  selectedOptionIds,
  bookingFormSchema,
  validateServiceAnswers,
  type BookingFormValues,
} from "@home/shared";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./lib/api";
import type {
  Address,
  CatalogueItem,
  Customer,
  RequestRecord,
} from "./lib/types";
import { useTranslation } from "./lib/language";
import { clearDraft, readDraft, saveDraft } from "./lib/drafts";
import { LoadingSkeleton } from "./components/ui";

const emptyValues: BookingFormValues = {
  applianceCategoryId: "",
  serviceId: "",
  details: { description: "" },
  address: {
    name: "",
    phone: "",
    line1: "",
    area: "",
    city: "",
    state: "",
    pinCode: "",
  },
  preferredDate: "",
  preferredTimeWindow: "",
};
const businessDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function BookingWizard({ type }: { type: "service" | "installation" }) {
  const profile = useQuery({
    queryKey: customerKeys.profile,
    queryFn: async () =>
      (await api.get<{ data: Customer }>("/profile")).data.data,
    retry: false,
  });
  const { t } = useTranslation();
  if (profile.isPending)
    return (
      <div className="section page">
        <LoadingSkeleton variant="detail" />
      </div>
    );
  if (profile.isError) {
    const unauthorized =
      axios.isAxiosError(profile.error) &&
      profile.error.response?.status === 401;
    return (
      <section className="section page">
        <h1>
          {t(type === "service" ? "Service request" : "Installation request")}
        </h1>
        <p role={unauthorized ? undefined : "alert"}>
          {unauthorized
            ? "Sign in to save your request and use your profile details."
            : "Unable to load your account. Please try again."}
        </p>
        {unauthorized ? (
          <Link
            className="primary"
            to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
          >
            {t("Sign in")}
          </Link>
        ) : (
          <SafeAsyncButton
            variant="primary"
            pending={profile.isFetching}
            pendingLabel="Loading..."
            onClick={() => profile.refetch({ cancelRefetch: false })}
          >
            {t("Try again")}
          </SafeAsyncButton>
        )}
      </section>
    );
  }
  return (
    <Wizard
      key={`${profile.data.id}-${type}`}
      profile={profile.data}
      type={type}
    />
  );
}
function Wizard({
  profile,
  type,
}: {
  profile: Customer;
  type: "service" | "installation";
}) {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const catalogueSelection =
    !!params.get("serviceId") && !!params.get("applianceCategoryId");
  const [initialDraft] = useState(() =>
    params.get("repeat") ? null : readDraft(profile.id, type),
  );
  const [step, setStep] = useState(initialDraft?.step || 0);
  const [detailsServiceId, setDetailsServiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState(!!initialDraft);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveContact, setSaveContact] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const keyRef = useRef(initialDraft?.idempotencyKey || crypto.randomUUID());
  const submittingRef = useRef(false);
  const initialized = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: initialDraft
      ? {
          ...initialDraft.values,
          address: {
            ...initialDraft.values.address,
            name: profile.full_name || "",
            phone: profile.phone_e164?.replace(/^\+91/, "") || "",
          },
        }
      : {
          ...emptyValues,
          applianceCategoryId: params.get("applianceCategoryId") || "",
          serviceId: params.get("serviceId") || "",
          details: {
            description: "",
            ...(params.get("optionIds")
              ? {
                  optionIds: JSON.stringify(
                    params.get("optionIds")!.split(","),
                  ),
                }
              : {}),
            ...(params.get("optionId")
              ? { optionId: params.get("optionId")! }
              : {}),
          },
          address: {
            ...emptyValues.address,
            name: profile.full_name || "",
            phone: profile.phone_e164?.replace(/^\+91/, "") || "",
          },
        },
  });
  const {
    register,
    watch,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { errors },
  } = form;
  const values = watch();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      form.formState.isDirty &&
      !submittingRef.current &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  );
  useBeforeUnload((event) => {
    if (form.formState.isDirty && !submittingRef.current) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  const categories = useQuery({
    queryKey: customerKeys.appliances,
    queryFn: async () =>
      (await api.get<{ data: CatalogueItem[] }>("/appliances")).data.data,
  });
  const services = useQuery({
    queryKey: customerKeys.catalogue(type, values.applianceCategoryId),
    queryFn: async () =>
      (
        await api.get<{ data: CatalogueItem[] }>(
          type === "service" ? "/services" : "/installations",
          { params: { applianceCategoryId: values.applianceCategoryId } },
        )
      ).data.data,
    enabled: !!values.applianceCategoryId,
  });
  const addresses = useQuery({
    queryKey: customerKeys.addresses,
    queryFn: async () =>
      (await api.get<{ data: Address[] }>("/addresses")).data.data,
  });
  const repeat = useQuery({
    queryKey: customerKeys.request(params.get("repeat")),
    queryFn: async () =>
      (
        await api.get<{ data: RequestRecord }>(
          `/requests/${params.get("repeat")}`,
        )
      ).data.data,
    enabled: !!params.get("repeat"),
    retry: false,
  });
  const windows = useQuery({
    queryKey: customerKeys.appointmentWindows,
    queryFn: async () =>
      (
        await api.get<{ data: { id: string; label: string }[] }>(
          "/appointment-windows",
        )
      ).data.data,
  });
  const selected = services.data?.find(
    (service) => service.id === values.serviceId,
  );
  const selectAddress = (a: Address, dirty = true) => {
    setValue(
      "address",
      {
        name: a.recipient_name,
        phone: a.phone.replace(/^\+91/, ""),
        line1: a.line1,
        area: a.area,
        city: a.city,
        state: a.state,
        pinCode: a.pin_code,
      },
      { shouldDirty: dirty },
    );
  };
  useEffect(() => {
    if (initialized.current || initialDraft) return;
    if (params.get("repeat")) {
      if (!repeat.data) return;
      const old = repeat.data;
      const details = Object.fromEntries(
        Object.entries(old.details).filter(
          ([, value]) => typeof value === "string",
        ),
      ) as BookingFormValues["details"];
      reset({
        ...emptyValues,
        applianceCategoryId: old.appliance_category_id,
        serviceId: old.service_catalogue_id,
        details: { ...details, description: details.description || "" },
        address: {
          ...old.address_snapshot,
          phone: old.address_snapshot.phone.replace(/^\+91/, ""),
        },
      });
      initialized.current = true;
    } else if (addresses.isSuccess) {
      const address = addresses.data.find((a) => a.is_default);
      if (address && !form.formState.dirtyFields.address)
        selectAddress(address, false);
      initialized.current = true;
    }
  });
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step]);
  useEffect(() => {
    if (busy) return;
    const timeout = setTimeout(() => {
      if (form.formState.isDirty) {
        setSaved(
          saveDraft(profile.id, type, getValues(), step, keyRef.current),
        );
      }
    }, 750);
    return () => clearTimeout(timeout);
  }, [values, step, form.formState.isDirty, getValues, profile.id, type, busy]);
  async function continueStep() {
    const valid = await trigger(
      step === 0
        ? ["applianceCategoryId", "serviceId", "details"]
        : step === 1
          ? ["address"]
          : ["preferredDate", "preferredTimeWindow"],
      { shouldFocus: true },
    );
    if (!valid) {
      toast.error(
        locale === "ta"
          ? "குறிக்கப்பட்ட விவரங்களைச் சரிபார்க்கவும்"
          : "Please check the highlighted fields.",
      );
      return;
    }
    if (step === 0) {
      if (!selected) {
        toast.error("Choose an available service.");
        return;
      }
      if (
        selected.booking_options?.some((o) => o.active) &&
        (!selectedOptionIds(getValues("details")).length ||
          selectedOptionIds(getValues("details")).some(
            (id) =>
              !selected.booking_options!.some((o) => o.active && o.id === id),
          ))
      ) {
        toast.error("Choose a problem or installation option.");
        return;
      }
      const error = validateServiceAnswers(
        selected.form_fields || [],
        getValues("details"),
      );
      if (error) {
        toast.error(error);
        return;
      }
    }
    if (step === 2 && getValues("preferredDate") < businessDate()) {
      form.setError("preferredDate", {
        message: "Choose today or a future date",
      });
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }
  async function useLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not supported. Enter your address manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await api.post<{
            data: {
              area: string;
              city: string;
              state: string;
              pinCode: string;
            };
          }>("/locations/reverse-geocode", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          for (const field of ["area", "city", "state", "pinCode"] as const)
            setValue(`address.${field}`, result.data.data[field], {
              shouldDirty: true,
            });
          toast.success(
            "Location detected. Please confirm your house number and address.",
          );
        } catch (error) {
          toast.error(
            axios.isAxiosError(error)
              ? error.response?.data?.error?.message ||
                  "Unable to resolve this location. Enter the address manually."
              : "Enter your address manually.",
          );
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === 1
            ? "Location access was denied. You can enter your address manually."
            : "Unable to detect your location. Try again or enter it manually.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }
  async function submit(data: BookingFormValues) {
    if (step !== 3 || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      if (!selected) {
        setStep(0);
        throw new Error("Select an available service before submitting.");
      }
      const r = await api.post<{ data: RequestRecord }>(`/requests/${type}`, {
        ...data,
        idempotencyKey: keyRef.current,
      });
      clearDraft(profile.id, type);
      if (saveContact) {
        try {
          await api.patch("/profile", {
            fullName: profile.full_name || data.address.name,
            email: profile.email || "",
            phone: data.address.phone,
          });
          await qc.invalidateQueries({ queryKey: customerKeys.profile });
        } catch {
          toast.error(
            "Request saved, but the contact number could not be saved to your profile.",
          );
        }
      }
      if (saveAddress) {
        try {
          await api.post("/addresses", {
            label: "Service address",
            recipientName: data.address.name,
            ...data.address,
            pinCode: data.address.pinCode,
            isDefault: !addresses.data?.length,
          });
          await qc.invalidateQueries({ queryKey: customerKeys.addresses });
        } catch {
          toast.error(
            "Request saved, but the address could not be added to your saved addresses.",
          );
        }
      }
      await qc.invalidateQueries({ queryKey: customerKeys.requests });
      navigate("/bookings", {
        state: { submitted: r.data.data },
        replace: true,
      });
    } catch (error) {
      if (axios.isAxiosError(error))
        toast.error(
          error.response?.data?.error?.message ||
            "Unable to submit your request. Please try again.",
        );
      else
        toast.error(
          error instanceof Error ? error.message : "Unable to submit request.",
        );
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }
  const dates = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(`${businessDate()}T12:00:00+05:30`);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      value: businessDate(d),
      day: new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }).format(d),
      date: d.getUTCDate(),
      month: new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", {
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(d),
      label: new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", {
        dateStyle: "full",
        timeZone: "Asia/Kolkata",
      }).format(d),
    };
  });
  return (
    <section className="section page booking-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t(type === "service" ? "Service request" : "Installation request")}
          </span>
          <h1 tabIndex={-1} ref={heading}>
            {t(
              [
                "Appliance & requirement",
                "Location & contact",
                "Preferred visit",
                "Review & submit",
              ][step]!,
            )}
          </h1>
        </div>
        <span className="step-count">{step + 1} / 4</span>
      </div>
      <ol className="step-progress" aria-label="Booking progress">
        {[
          "Appliance & requirement",
          "Location & contact",
          "Preferred visit",
          "Review & submit",
        ].map((title, index) => (
          <li
            key={title}
            className={index <= step ? "selected" : ""}
            aria-current={index === step ? "step" : undefined}
          >
            <span>{index + 1}</span>
            <small>{t(title)}</small>
          </li>
        ))}
      </ol>
      {initialDraft && <p className="inline-note">{t("Draft restored")}</p>}
      {repeat.isError && (
        <p role="alert">
          Unable to repeat that request. Select an appliance to start a new
          request.
        </p>
      )}
      <form
        onSubmit={(event) => {
          if (step !== 3) {
            event.preventDefault();
            void continueStep();
          } else void form.handleSubmit(submit)(event);
        }}
        className="wizard-form"
        noValidate
      >
        {step === 0 && (
          <>
            {catalogueSelection && (
              <div className="selected-catalogue-service">
                <h2>
                  {
                    categories.data?.find(
                      (c) => c.id === values.applianceCategoryId,
                    )?.name
                  }
                </h2>
                <p>{selected?.name || "Loading selected service..."}</p>
                <Link to={`/services/appliances/${values.applianceCategoryId}`}>
                  Change service
                </Link>
              </div>
            )}
            {!catalogueSelection && (
              <>
                <h2>{t("Choose your appliance")}</h2>
                {categories.isPending ? (
                  <LoadingSkeleton variant="appliances" count={6} />
                ) : categories.isError ? (
                  <p role="alert">
                    Unable to load appliances.{" "}
                    <button type="button" onClick={() => categories.refetch()}>
                      {t("Try again")}
                    </button>
                  </p>
                ) : (
                  <div className="choice-grid">
                    {categories.data.map((appliance) => (
                      <button
                        type="button"
                        key={appliance.id}
                        className={`choice-card ${values.applianceCategoryId === appliance.id ? "selected" : ""}`}
                        aria-pressed={
                          values.applianceCategoryId === appliance.id
                        }
                        onClick={() => {
                          setValue("applianceCategoryId", appliance.id, {
                            shouldDirty: true,
                          });
                          setValue("serviceId", "");
                          setValue("details", {
                            description: values.details.description,
                          });
                          setDetailsServiceId(null);
                        }}
                      >
                        <span className="appliance-glyph">
                          {appliance.slug === "air-conditioner"
                            ? "❄"
                            : appliance.slug === "television"
                              ? "▣"
                              : "◉"}
                        </span>
                        {t(appliance.name)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {errors.applianceCategoryId && (
              <p className="field-error" role="alert">
                Choose an appliance.
              </p>
            )}
            {values.applianceCategoryId && !catalogueSelection && (
              <>
                <h2>
                  {t(
                    type === "service"
                      ? "Choose a service"
                      : "Choose installation type",
                  )}
                </h2>
                {services.isPending ? (
                  <LoadingSkeleton count={2} />
                ) : services.isError ? (
                  <p role="alert">
                    Unable to load options.{" "}
                    <button type="button" onClick={() => services.refetch()}>
                      {t("Try again")}
                    </button>
                  </p>
                ) : !services.data.length ? (
                  <p role="status">
                    No options are available for this appliance yet.{" "}
                    <Link to="/support">Contact support</Link>.
                  </p>
                ) : (
                  <div className="booking-service-grid">
                    {services.data.map((service) => {
                      const expanded = detailsServiceId === service.id;
                      const activeOptions =
                        service.booking_options?.filter(
                          (option) => option.active,
                        ) || [];
                      return (
                        <article
                          className={`booking-service-card ${values.serviceId === service.id ? "is-selected" : ""}`}
                          key={service.id}
                        >
                          <h3>{t(service.name)}</h3>
                          {service.base_price != null && (
                            <p className="booking-service-price">
                              From &#8377;
                              {Number(service.base_price).toLocaleString(
                                "en-IN",
                              )}
                            </p>
                          )}
                          <div className="booking-service-actions">
                            <button
                              type="button"
                              className="secondary"
                              aria-expanded={expanded}
                              aria-controls={`booking-service-details-${service.id}`}
                              onClick={() =>
                                setDetailsServiceId(
                                  expanded ? null : service.id,
                                )
                              }
                            >
                              {t(
                                expanded
                                  ? "Hide service details"
                                  : "View service details",
                              )}
                            </button>
                            <button
                              type="button"
                              className="primary"
                              aria-pressed={values.serviceId === service.id}
                              onClick={() => {
                                setValue("serviceId", service.id, {
                                  shouldDirty: true,
                                });
                                setValue(
                                  "details",
                                  { description: values.details.description },
                                  { shouldDirty: true },
                                );
                                setDetailsServiceId(null);
                              }}
                            >
                              {values.serviceId === service.id
                                ? t("Selected")
                                : t("Book now")}
                            </button>
                          </div>
                          <div
                            id={`booking-service-details-${service.id}`}
                            className="booking-service-details"
                            hidden={!expanded}
                          >
                            {service.description && (
                              <p>{service.description}</p>
                            )}
                            {!!activeOptions.length && (
                              <>
                                <h4>{t("Available options")}</h4>
                                <ul>
                                  {activeOptions.map((option) => (
                                    <li key={option.id}>
                                      <strong>{option.name}</strong>
                                      {option.description && (
                                        <span>{option.description}</span>
                                      )}
                                      <span>{indicativePrice(option)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                            {!service.description && !activeOptions.length && (
                              <p>
                                {t("Service details are not available yet.")}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {errors.serviceId && (
              <p className="field-error" role="alert">
                Choose a service.
              </p>
            )}
            {!!selected?.booking_options?.some((o) => o.active) && (
              <fieldset className="booking-options">
                <legend>
                  {type === "service"
                    ? "What needs attention?"
                    : "Installation requirement"}
                </legend>
                {selected.booking_options
                  .filter((o) => o.active)
                  .map((o) => (
                    <label
                      key={o.id}
                      className={`booking-option ${selectedOptionIds(values.details).includes(o.id) ? "selected" : ""}`}
                    >
                      <AppCheckbox
                        checked={selectedOptionIds(values.details).includes(
                          o.id,
                        )}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...selectedOptionIds(values.details), o.id]
                            : selectedOptionIds(values.details).filter(
                                (id) => id !== o.id,
                              );
                          setValue("details.optionIds", JSON.stringify(ids), {
                            shouldDirty: true,
                          });
                          setValue("details.optionId", ids[0] || "", {
                            shouldDirty: true,
                          });
                        }}
                      />
                      <span>
                        <strong>{o.name}</strong>
                        <small>{o.description}</small>
                        <span>{indicativePrice(o)}</span>
                      </span>
                    </label>
                  ))}
              </fieldset>
            )}
            {selected?.form_fields?.map((field) => (
              <label className="form-field" key={field.key}>
                {t(field.label)}
                {field.required ? " *" : ""}
                {field.type === "select" ? (
                  <AppSelect {...register(`details.${field.key}`)}>
                    <option value="">{t("Select an option")}</option>
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </AppSelect>
                ) : field.type === "textarea" ? (
                  <AppTextarea
                    {...register(`details.${field.key}`)}
                    maxLength={2000}
                  />
                ) : (
                  <AppInput
                    {...register(`details.${field.key}`)}
                    type={field.type === "number" ? "number" : "text"}
                    step="any"
                    maxLength={2000}
                  />
                )}
              </label>
            ))}
            <label className="form-field">
              {t("Short description")} <small>{t("Optional")}</small>
              <AppTextarea
                {...register("details.description")}
                maxLength={2000}
                rows={3}
                placeholder={t("Enter your brand and short details")}
              />
              <small>
                {t(
                  "For example: LG washing machine, not draining since yesterday.",
                )}
              </small>
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <div className="section-actions">
              <h2>{t("Saved address")}</h2>
              <button
                type="button"
                className="secondary"
                disabled={locating}
                onClick={useLocation}
              >
                {locating ? t("Loading…") : t("Use My Current Location")}
              </button>
            </div>
            <div className="address-options">
              {addresses.data?.map((address) => (
                <button
                  type="button"
                  className="address-option"
                  key={address.id}
                  onClick={() => selectAddress(address)}
                >
                  <strong>
                    {address.label}
                    {address.is_default ? " · Default" : ""}
                  </strong>
                  <span>
                    {address.line1}, {address.city} {address.pin_code}
                  </span>
                </button>
              ))}
            </div>
            <p className="helper">
              Confirm your exact house/door number. You can correct every
              address field below.
            </p>
            <label className="check-label">
              <AppCheckbox
                checked={saveContact}
                onChange={(e) => setSaveContact(e.target.checked)}
              />
              Save this contact number to my profile
            </label>
            <div className="form-grid">
              {(
                [
                  ["name", "Contact name"],
                  ["phone", "Mobile number"],
                  ["line1", "House / street"],
                  ["area", "Area"],
                  ["city", "City"],
                  ["state", "State"],
                  ["pinCode", "PIN code"],
                ] as const
              ).map(([field, label]) => (
                <label className={`form-field field-${field}`} key={field}>
                  {t(label)}
                  <AppInput
                    {...register(`address.${field}`)}
                    aria-label={t(label)}
                    aria-invalid={!!errors.address?.[field]}
                    aria-describedby={
                      errors.address?.[field]
                        ? `address-error-${field}`
                        : undefined
                    }
                    autoComplete={
                      field === "name"
                        ? "name"
                        : field === "phone"
                          ? "tel-national"
                          : field === "line1"
                            ? "street-address"
                            : field === "pinCode"
                              ? "postal-code"
                              : undefined
                    }
                    inputMode={
                      field === "phone" || field === "pinCode"
                        ? "numeric"
                        : "text"
                    }
                    maxLength={
                      field === "phone" ? 10 : field === "pinCode" ? 6 : 150
                    }
                  />
                  {errors.address?.[field] && (
                    <span
                      id={`address-error-${field}`}
                      className="field-error"
                      role="alert"
                    >
                      {locale === "ta"
                        ? "சரியான விவரத்தை உள்ளிடவும்"
                        : "Please enter a valid value."}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <label className="check-label">
              <AppCheckbox
                checked={saveAddress}
                onChange={(event) => setSaveAddress(event.target.checked)}
              />
              {t("Save address")}
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <h2>{t("Preferred date")}</h2>
            <div className="date-selector">
              {dates.map((date) => (
                <button
                  type="button"
                  key={date.value}
                  className={
                    values.preferredDate === date.value ? "selected" : ""
                  }
                  aria-pressed={values.preferredDate === date.value}
                  aria-label={date.label}
                  onClick={() =>
                    setValue("preferredDate", date.value, { shouldDirty: true })
                  }
                >
                  <span>{date.day}</span>
                  <strong>{date.date}</strong>
                  <small>
                    {date.value === businessDate() ? t("Today") : date.month}
                  </small>
                </button>
              ))}
            </div>
            <label className="form-field">
              {t("Later date")}
              <AppInput
                type="date"
                {...register("preferredDate")}
                min={businessDate()}
              />
              {errors.preferredDate && (
                <span className="field-error" role="alert">
                  Choose a valid date today or later.
                </span>
              )}
            </label>
            <h2>{t("Preferred visit window")}</h2>
            <p>{t("Our executive will confirm availability.")}</p>
            {windows.isPending ? (
              <LoadingSkeleton variant="slots" count={3} />
            ) : windows.isError ? (
              <p role="alert">
                Unable to load visit windows.{" "}
                <button type="button" onClick={() => windows.refetch()}>
                  {t("Try again")}
                </button>
              </p>
            ) : (
              <div className="time-selector">
                {windows.data.map((window) => (
                  <button
                    type="button"
                    key={window.id}
                    className={
                      values.preferredTimeWindow === window.id ? "selected" : ""
                    }
                    aria-pressed={values.preferredTimeWindow === window.id}
                    onClick={() =>
                      setValue("preferredTimeWindow", window.id, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {t(window.label)}
                  </button>
                ))}
              </div>
            )}
            {errors.preferredTimeWindow && (
              <p className="field-error" role="alert">
                Choose a preferred visit window.
              </p>
            )}
          </>
        )}
        {step === 3 && (
          <div className="review-summary">
            {[
              [
                "Appliance & requirement",
                <>
                  <strong>
                    {t(
                      categories.data?.find(
                        (c) => c.id === values.applianceCategoryId,
                      )?.name || "",
                    )}
                  </strong>
                  <p>
                    {selected?.name || "This service is no longer available"}
                  </p>
                  {selected?.booking_options
                    ?.filter((o) =>
                      selectedOptionIds(values.details).includes(o.id),
                    )
                    .map((o) => (
                      <p key={o.id}>
                        {o.name} ? {indicativePrice(o)}
                      </p>
                    ))}
                  {Object.entries(values.details)
                    .filter(
                      ([key, value]) =>
                        value && !["optionId", "optionIds"].includes(key),
                    )
                    .map(([key, value]) => (
                      <p key={key}>
                        {selected?.form_fields?.find((f) => f.key === key)
                          ?.label || t("Additional details")}
                        : {value}
                      </p>
                    ))}
                </>,
              ],
              [
                "Location & contact",
                <>
                  <strong>
                    {values.address.name} · {values.address.phone}
                  </strong>
                  <p>
                    {values.address.line1}, {values.address.area}
                    <br />
                    {values.address.city}, {values.address.state}{" "}
                    {values.address.pinCode}
                  </p>
                </>,
              ],
              [
                "Preferred visit",
                <>
                  <strong>{values.preferredDate}</strong>
                  <p>
                    {windows.data?.find(
                      (w) => w.id === values.preferredTimeWindow,
                    )?.label || values.preferredTimeWindow}
                  </p>
                  <small>{t("Our executive will confirm availability.")}</small>
                </>,
              ],
            ].map(([title, content], index) => (
              <article key={String(title)}>
                <div className="section-actions">
                  <h2>{t(String(title))}</h2>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep(index)}
                  >
                    {t("Edit")}
                  </button>
                </div>
                {content}
              </article>
            ))}
          </div>
        )}
        <div className="wizard-actions">
          {step > 0 && (
            <SafeAsyncButton
              variant="outline"
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setStep((current) => current - 1)}
              pending={busy}
              pendingLabel="Saving..."
            >
              {t("Back")}
            </SafeAsyncButton>
          )}
          <SafeAsyncButton
            variant="primary"
            key={step === 3 ? "submit" : "continue"}
            type={step === 3 ? "submit" : "button"}
            className="primary"
            disabled={
              busy ||
              locating ||
              (step === 0 &&
                (categories.isPending || services.isPending || !selected)) ||
              (step === 2 && windows.isPending)
            }
            onClick={step < 3 ? continueStep : undefined}
            pending={busy}
            pendingLabel="Saving..."
          >
            {t(
              busy ? "Submitting…" : step === 3 ? "Submit request" : "Continue",
            )}
          </SafeAsyncButton>
        </div>
      </form>
      {blocker.state === "blocked" && (
        <ConfirmActionDialog
          title="Leave this request?"
          onClose={() => blocker.reset()}
        >
          <div className="leave-booking">
            <p>You have entered some details. What would you like to do?</p>
            <p className="muted">
              Drafts expire after seven days on this device. Contact and street
              address details are not saved.
            </p>
            <button
              className="primary"
              type="button"
              onClick={() => blocker.reset()}
            >
              Continue Editing
            </button>
            <SafeAsyncButton
              variant="outline"
              onClick={() => {
                const done = saveDraft(
                  profile.id,
                  type,
                  getValues(),
                  step,
                  keyRef.current,
                );
                if (done) {
                  toast.success("Draft saved.");
                  blocker.proceed();
                } else
                  toast.error(
                    "Unable to save the draft. Keep editing or discard changes.",
                  );
              }}
            >
              Save Draft
            </SafeAsyncButton>
            <button
              type="button"
              onClick={() => {
                clearDraft(profile.id, type);

                blocker.proceed();
              }}
            >
              Discard Changes
            </button>
          </div>
        </ConfirmActionDialog>
      )}
      {discardOpen && (
        <ConfirmActionDialog
          title="Discard this draft?"
          onClose={() => setDiscardOpen(false)}
        >
          <div className="leave-booking">
            <p>Your current draft will be cleared.</p>
            <button type="button" onClick={() => setDiscardOpen(false)}>
              Continue Editing
            </button>
            <button
              type="button"
              onClick={() => {
                clearDraft(profile.id, type);

                setSaved(false);
                keyRef.current = crypto.randomUUID();
                reset({
                  ...emptyValues,
                  address: {
                    ...emptyValues.address,
                    name: profile.full_name || "",
                    phone: profile.phone_e164?.replace(/^\+91/, "") || "",
                  },
                });
                setStep(0);
                setDiscardOpen(false);
              }}
            >
              Discard Changes
            </button>
          </div>
        </ConfirmActionDialog>
      )}
      <div className="draft-actions">
        <SafeAsyncButton
          variant="outline"
          type="button"
          disabled={busy}
          onClick={() => {
            const done = saveDraft(
              profile.id,
              type,
              getValues(),
              step,
              keyRef.current,
            );
            setSaved(done);
            if (done) {
              reset(getValues());
              toast.success(t("Draft saved on this device"));
            } else
              toast.error(
                "Browser storage is unavailable. Keep this page open.",
              );
          }}
          pending={busy}
          pendingLabel="Saving..."
        >
          {t("Save draft")}
        </SafeAsyncButton>
        {saved && (
          <>
            <small>{t("Draft saved on this device")}</small>
            <button type="button" onClick={() => setDiscardOpen(true)}>
              {t("Discard draft")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
