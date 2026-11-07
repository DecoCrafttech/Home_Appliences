import { AccountAccessState } from "./components/AccountAccessState";
import { VisitCalendar } from "./VisitCalendar";
import { ImageWithFallback } from "@home/ui";
import { serviceIcon } from "./servicePresentation";
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
import { api, catalogueImageUrl } from "./lib/api";
import type {
  Address,
  CatalogueItem,
  Customer,
  RequestRecord,
} from "./lib/types";
import { useTranslation } from "./lib/language";
import { clearDraft, readDraft, saveDraft } from "./lib/drafts";
import { LoadingSkeleton, EmptyState } from "./components/ui";

const bookingInputSchema = bookingFormSchema.extend({
  details: bookingFormSchema.shape.details.extend({
    description:
      bookingFormSchema.shape.details.shape.description.removeDefault(),
  }),
});
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
      <AccountAccessState
        label={type === "service" ? "Service request" : "Installation request"}
        title="Sign in to book your visit"
        unauthorized={unauthorized}
        retry={() => profile.refetch({ cancelRefetch: false })}
        pending={profile.isFetching}
      />
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
  const [initialDraft] = useState(() => {
    if (params.get("repeat")) return null;
    const draft = readDraft(profile.id, type);
    if (
      catalogueSelection &&
      draft &&
      (draft.values.applianceCategoryId !== params.get("applianceCategoryId") ||
        draft.values.serviceId !== params.get("serviceId"))
    )
      return null;
    return draft;
  });
  const [step, setStep] = useState(initialDraft?.step || 0);
  const [editingAddress, setEditingAddress] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState(false);
  const [stepError, setStepError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const keyRef = useRef(initialDraft?.idempotencyKey || crypto.randomUUID());
  const submittingRef = useRef(false);
  const initialized = useRef(false);
  const advancing = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingInputSchema),
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
  useEffect(() => {
    const options =
      selected?.booking_options?.filter((option) => option.active) || [];
    if (options.length === 1 && !selectedOptionIds(values.details).length)
      setValue("details.optionId", options[0]!.id, { shouldDirty: true });
  }, [selected, values.details, setValue]);
  const selectAddress = (a: Address, dirty = true) => {
    setEditingAddress(false);
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
        saveDraft(profile.id, type, getValues(), step, keyRef.current);
      }
    }, 750);
    return () => clearTimeout(timeout);
  }, [values, step, form.formState.isDirty, getValues, profile.id, type, busy]);
  async function continueStep() {
    if (advancing.current) return;
    advancing.current = true;
    try {
      setStepError("");
      if (step === 0) {
        const available =
          selected?.booking_options?.filter((option) => option.active) || [];
        if (
          available.length === 1 &&
          !selectedOptionIds(getValues("details")).length
        )
          setValue("details.optionId", available[0]!.id, { shouldDirty: true });
      }
      const valid = await trigger(
        step === 0
          ? ["applianceCategoryId", "serviceId", "details"]
          : step === 1
            ? ["address"]
            : ["preferredDate", "preferredTimeWindow"],
        { shouldFocus: true },
      );
      if (!valid) {
        if (step === 1) setEditingAddress(true);
        const message = (
          step === 0
            ? ["applianceCategoryId", "serviceId", "details"]
            : step === 1
              ? ["address"]
              : ["preferredDate", "preferredTimeWindow"]
        )
          .map(
            (field) =>
              form.getFieldState(field as keyof BookingFormValues).error
                ?.message,
          )
          .find(Boolean);
        setStepError(
          typeof message === "string"
            ? message
            : "Please check the highlighted fields before continuing.",
        );
        toast.error(
          locale === "ta"
            ? "குறிக்கப்பட்ட விவரங்களைச் சரிபார்க்கவும்"
            : "Please check the highlighted fields.",
        );
        return;
      }
      if (step === 0) {
        if (!selected) {
          setStepError(
            "This service is no longer available. Browse services to choose another.",
          );
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
          setStepError("Choose an available service option before continuing.");
          return;
        }
        const error = validateServiceAnswers(
          selected.form_fields || [],
          getValues("details"),
        );
        if (error) {
          setStepError(error);
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
      setStep(Math.min(3, step + 1));
    } finally {
      advancing.current = false;
    }
  }
  async function useLocation() {
    if (locating) return;
    setLocationError("");
    setEditingAddress(true);
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError(
        "Location needs a secure connection and a supported browser. Enter your address manually.",
      );
      return;
    }
    setLocating(true);
    try {
      const getPosition = (options: PositionOptions) =>
        new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, options),
        );
      let position: GeolocationPosition;
      try {
        position = await getPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      } catch (error) {
        if ((error as GeolocationPositionError).code === 1) throw error;
        // Android network positioning can fail while GPS is still available.
        position = await getPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 60000,
        });
      }
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
      let filled = false;
      for (const field of ["area", "city", "state", "pinCode"] as const)
        if (result.data.data[field]?.trim()) {
          setValue(`address.${field}`, result.data.data[field].trim(), {
            shouldDirty: true,
            shouldValidate: true,
          });
          filled = true;
        }
      if (!filled)
        throw new Error(
          "No address details were found. Enter your address manually.",
        );
      toast.success("Address found. Check your house or street below.");
    } catch (error) {
      const code = (error as GeolocationPositionError).code;
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error?.message ||
          "Address lookup is unavailable. Enter your address manually."
        : code === 1
          ? "Location is blocked. Allow location for FixBeez or Chrome in Android settings and turn on device Location, then try again. You can also enter your address manually."
          : code === 2 || code === 3
            ? "Unable to get a location fix. Turn on device Location and try again, or enter your address manually."
            : error instanceof Error
              ? error.message
              : "Unable to detect your location. Enter your address manually.";
      setLocationError(message);
    } finally {
      setLocating(false);
    }
  }
  async function submit(data: BookingFormValues) {
    if (step !== 3 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmissionError(false);
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
      setSubmissionError(true);
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
  return (
    <section className="section page booking-page">
      <div className="page-heading">
        <div>
          <h1 tabIndex={-1} ref={heading}>
            {t(
              [
                type === "service" ? "Service Request" : "Installation Request",
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
        {["Service", "Address", "Visit", "Preview"].map((title, index) => (
          <li key={title} className={index <= step ? "selected" : ""}>
            <button
              type="button"
              aria-label={`Step ${index + 1}: ${t(title)}`}
              aria-current={index === step ? "step" : undefined}
              disabled={index > step || busy || locating}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              <small>{t(title)}</small>
            </button>
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
                <ImageWithFallback
                  className="selected-appliance-photo"
                  src={catalogueImageUrl(
                    categories.data?.find(
                      (c) => c.id === values.applianceCategoryId,
                    )?.icon_url,
                  )}
                  alt=""
                />
                <p>{selected?.name || "Loading selected service..."}</p>
              </div>
            )}
            {!catalogueSelection && (
              <>
                <h2>{t("Choose an item")}</h2>
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
                        }}
                      >
                        <ImageWithFallback
                          className="choice-appliance-photo"
                          src={catalogueImageUrl(appliance.icon_url)}
                          alt=""
                        />
                        {t(appliance.name)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {errors.applianceCategoryId && (
              <p className="field-error" role="alert">
                Choose an item.
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
                    No options are available for this item yet.{" "}
                    <Link to="/support">Contact support</Link>.
                  </p>
                ) : (
                  <div className="booking-service-grid">
                    {services.data.map((service) => {
                      const Icon = serviceIcon(
                        service.name,
                        type === "service" ? "SERVICE" : "INSTALLATION",
                      );
                      return (
                        <button
                          type="button"
                          className={`booking-service-card ${values.serviceId === service.id ? "is-selected" : ""}`}
                          key={service.id}
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
                          }}
                        >
                          <Icon aria-hidden="true" />
                          <strong>{t(service.name)}</strong>
                          {service.description && (
                            <small>{service.description}</small>
                          )}
                        </button>
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
            {(selected?.booking_options?.filter((o) => o.active).length || 0) >
              1 && (
              <fieldset className="booking-options">
                <legend>
                  {type === "service"
                    ? "What needs attention?"
                    : "Installation requirement"}
                </legend>
                {selected?.booking_options
                  ?.filter((o) => o.active)
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
            {locationError && (
              <p className="location-feedback" role="alert">
                {locationError}
              </p>
            )}
            {locating && (
              <p className="location-feedback" role="status">
                Finding your location? Keep Location turned on while we look up
                your address.
              </p>
            )}
            <div className="address-options">
              {addresses.data?.map((address) => (
                <button
                  type="button"
                  className="address-option"
                  key={address.id}
                  aria-pressed={
                    values.address.line1 === address.line1 &&
                    values.address.phone === address.phone.replace(/^\+91/, "")
                  }
                  onClick={() => {
                    selectAddress(address);
                    setEditingAddress(false);
                  }}
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
            {values.address.line1 && !editingAddress ? (
              <article className="selected-address-card">
                <strong>{values.address.name}</strong>
                <p>{values.address.phone}</p>
                <p>
                  {values.address.line1}, {values.address.area},{" "}
                  {values.address.city} {values.address.pinCode}
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditingAddress(true)}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setValue(
                      "address",
                      {
                        ...emptyValues.address,
                        name: profile.full_name || "",
                        phone: profile.phone_e164?.replace(/^\+91/, "") || "",
                      },
                      { shouldDirty: true },
                    );
                    setEditingAddress(true);
                  }}
                >
                  Add new address
                </button>
              </article>
            ) : (
              <>
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
          </>
        )}
        {step === 2 && (
          <>
            <h2>{t("Preferred date")}</h2>
            <VisitCalendar
              value={values.preferredDate}
              min={businessDate()}
              onChange={(date) => {
                setValue("preferredDate", date, { shouldDirty: true });
                setValue("preferredTimeWindow", "", { shouldDirty: true });
              }}
            />
            {errors.preferredDate && (
              <p className="field-error" role="alert">
                Choose a date today or later.
              </p>
            )}
            <h2>{t("Preferred visit window")}</h2>
            <p>{t("Our executive will confirm availability.")}</p>
            {values.preferredDate &&
              (windows.isPending ? (
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
                      aria-label={t(window.label)}
                      className={
                        values.preferredTimeWindow === window.id
                          ? "selected"
                          : ""
                      }
                      aria-pressed={values.preferredTimeWindow === window.id}
                      onClick={() =>
                        setValue("preferredTimeWindow", window.id, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <strong>{window.id.replace("-", "–")}</strong>
                      <small>{t(window.label)}</small>
                    </button>
                  ))}
                </div>
              ))}
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
        {submissionError && step === 3 && (
          <div role="alert">
            <EmptyState
              kind="booking"
              title="Request couldn't be submitted"
              description="Your details are still here. Check your connection and try again."
              primaryAction={
                <button
                  className="secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => void form.handleSubmit(submit)()}
                >
                  Try Again
                </button>
              }
            />
          </div>
        )}
        {stepError && (
          <p className="field-error" role="alert">
            {stepError}
          </p>
        )}
        <div className="wizard-actions">
          <div className="wizard-action-buttons">
            {step > 0 && (
              <SafeAsyncButton
                variant="outline"
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setStep((current) => current - 1)}
                pending={false}
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
                (step === 1 && addresses.isPending) ||
                (step === 2 && windows.isPending)
              }
              onClick={step < 3 ? continueStep : undefined}
              pending={busy}
              pendingLabel="Saving..."
            >
              {t(
                busy
                  ? "Submitting…"
                  : step === 3
                    ? "Submit request"
                    : "Continue",
              )}
            </SafeAsyncButton>
          </div>
        </div>
      </form>
      {blocker.state === "blocked" && (
        <ConfirmActionDialog
          title="Leave this request?"
          onClose={() => blocker.reset()}
        >
          <div className="leave-booking">
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
              className="discard-outline"
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
    </section>
  );
}
