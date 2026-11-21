import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { MobileNavBar } from "../../components/MobileNavBar";
import { addNotification } from "../../services/notifications";
import { AUTH_CHANGED_EVENT, getCurrentUserProfile } from "../../services/auth";
import { getCurrentUserProfile as fetchAccountProfile } from "../../services/api";
import { createIncidentReport } from "../../services/incidents";
import type { CreateIncidentReportPayload } from "../../services/incidents";
import { isConnectionError, saveReportForLater } from "../../services/offlineReports";
import {
  cleanDetailValues,
  getIncidentTypeConfig,
  validateDetailValue,
  validateDetailValues,
  type DetailFieldSpec,
  type DetailValue,
  type DetailValues,
  type IncidentTypeConfig,
} from "../../data/incidentTypeFields";
import { LUCENA_BARANGAYS } from "../../data/barangays";
import { getAccountTeam } from "../../data/teams";

interface VictimDetails {
  name: string;
  age: string;
  gender: "M" | "F" | "";
  address: string;
  condition: string;
  /** Extra fields for this incident type, e.g. driver/passenger for RCA or vital signs for medical. */
  details: DetailValues;
}

interface IncidentReportForm {
  timeOccurred: string;
  incidentType: string;
  responderTeam: string;
  description: string;
  barangay: string;
  latitude: string;
  longitude: string;
  victimCount: number;
  victims: VictimDetails[];
  actionTaken: string;
}

type CoordinateSource = "none" | "gps" | "manual";

type StepId = "overview" | "details" | "victims" | "operation";

type ReportStep = {
  id: StepId;
  title: string;
  description: string;
  accent: string;
  icon: string;
};

const STEP_ICONS: Record<StepId, string> = {
  overview: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  details: "M4 6h16M4 12h16M4 18h7",
  victims: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  operation: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
};

// The pages of the report, in order. Page 2 and 3 change with the incident type:
// each type has its own Details page, and some types (Stand-by Medical Team) have no victim page.
function buildReportSteps(config: IncidentTypeConfig | null): ReportStep[] {
  const steps: ReportStep[] = [
    {
      id: "overview",
      title: "Incident Overview",
      description: "When, what, and where it happened",
      accent: "bg-blue-50 text-blue-600 border-blue-100",
      icon: STEP_ICONS.overview,
    },
    {
      id: "details",
      title: config ? `${config.key === "rca" ? "Road Crash" : config.label} Details` : "Incident Details",
      description: "Information only this incident type has",
      accent: "bg-amber-50 text-amber-600 border-amber-100",
      icon: STEP_ICONS.details,
    },
  ];

  if (!config || config.victims.allowed) {
    steps.push({
      id: "victims",
      title: config?.victims.label ?? "Victim Profiling",
      description: "Every person involved and their condition",
      accent: "bg-indigo-50 text-indigo-600 border-indigo-100",
      icon: STEP_ICONS.victims,
    });
  }

  steps.push({
    id: "operation",
    title: "Operation Log",
    description: "What your team did on site",
    accent: "bg-emerald-50 text-emerald-600 border-emerald-100",
    icon: STEP_ICONS.operation,
  });

  return steps;
}

/** "Patients" -> "Patient", "Persons involved" -> "Person", used for "Patient #1". */
function singularVictimLabel(label: string | null | undefined): string {
  const first = (label ?? "Victims").split(" ")[0];
  if (first === "Casualties") return "Casualty";
  if (first === "Persons") return "Person";
  return first.endsWith("s") ? first.slice(0, -1) : first;
}

const EMPTY_VICTIM: VictimDetails = { name: "", age: "", gender: "", address: "", condition: "", details: {} };

// Option value for "Others" in dropdowns where another value can be typed.
// Short help under fields that are easy to misread. Keys are "<type key>.<field name>".
const FIELD_HINTS: Record<string, string> = {
  "rca.vehicles_involved": "Every vehicle involved, including parked ones that were hit.",
  "rca.fatalities": "People who died. Enter 0 if no one died.",
  "fire.structures_affected": "Houses or buildings damaged. Enter 0 if none.",
  "fire.families_affected": "Families who lost their home or had to leave it. Enter 0 if none.",
  "fire.fatalities": "People who died. People who were hurt go in the casualty list on the next step.",
  "drowning.rescued_alive": "Brought out alive without needing CPR.",
  "drowning.revived_cpr": "Needed CPR and survived.",
  "drowning.fatalities": "People who died.",
  "drowning.missing": "People not found yet.",
  "medical.triage_acuity": "The most serious patient you handled.",
  "ambulance.triage_acuity": "The patient's condition when you picked them up.",
  "standby.triage_acuity": "The most serious person you handled during the duty.",
  "standby.persons_assisted": "Everyone the team treated or helped. Enter 0 if none.",
};

// Details pages with many fields are split into labeled groups. Fields not listed go in a last group.
const DETAIL_GROUPS: Record<string, { title: string; names: string[] }[]> = {
  fire: [
    { title: "The fire", names: ["structure_type", "alarm_level", "suspected_cause", "bfp_present", "fire_out_time"] },
    { title: "Impact", names: ["structures_affected", "families_affected", "fatalities"] },
  ],
  drowning: [
    { title: "Scene", names: ["water_body", "activity"] },
    { title: "Victim status", names: ["rescued_alive", "revived_cpr", "fatalities", "missing"] },
    { title: "Rescue complexity", names: ["search_ongoing", "coast_guard_involved"] },
  ],
};

// A line above the list of people, so responders know who to add.
const VICTIM_STEP_NOTES: Record<string, string> = {
  rca: "Add everyone involved, including people who were not hurt, and choose each one's injury severity.",
  fire: "List each person who was hurt. People who died are counted in Fatalities on the previous step.",
  crime: "Add every victim and choose their outcome. The deceased, injured and total counts come from this list.",
  medical: "Add one card per patient. The number of patients is counted from these cards.",
  ambulance: "One patient per ambulance assistance report.",
};

const OTHER_OPTION = "__other__";

const VICTIM_FIELD_LABELS: Record<Exclude<keyof VictimDetails, "details">, string> = {
  name: "Full name",
  age: "Age",
  gender: "Biological sex",
  address: "Address",
  condition: "Physical condition",
};


// The responding team is the team an admin set on the logged-in responder account.
function readAccount(): { team: string; username: string } {
  const profile = getCurrentUserProfile();
  return { team: getAccountTeam(profile), username: profile?.username?.trim() || "" };
}

export const CreateReport: FC = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState(readAccount);

  const [formData, setFormData] = useState<IncidentReportForm>({
    timeOccurred: new Date().toTimeString().slice(0, 5),
    incidentType: "",
    responderTeam: readAccount().team,
    description: "",
    barangay: "",
    latitude: "",
    longitude: "",
    victimCount: 0,
    victims: [],
    actionTaken: "",
  });

  // Keep the team in step with the account: on login changes, and from the server once on open.
  useEffect(() => {
    let cancelled = false;
    const applyAccount = (next: { team: string; username: string }) => {
      if (cancelled) return;
      setAccount(next);
      setFormData((prev) => (prev.responderTeam === next.team ? prev : { ...prev, responderTeam: next.team }));
    };
    const onAuthChanged = () => applyAccount(readAccount());

    fetchAccountProfile()
      .then((response) => {
        const user = response?.user;
        if (!user) return;
        applyAccount({ team: getAccountTeam(user), username: user.username?.trim() || "" });
      })
      .catch(() => {
        // Offline or session check failed: keep the team from the stored login.
      });

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  // Dropdowns with "Others" (e.g. hospitals) where the responder chose to type the value, by field id.
  const [typedOtherFields, setTypedOtherFields] = useState<Record<string, boolean>>({});
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [coordinateSource, setCoordinateSource] =
    useState<CoordinateSource>("none");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  // Details are kept per incident type, so switching type and back does not lose what was typed.
  const [detailsByType, setDetailsByType] = useState<Record<string, DetailValues>>({});
  const formTopRef = useRef<HTMLDivElement>(null);

  const typeConfig = useMemo(() => getIncidentTypeConfig(formData.incidentType), [formData.incidentType]);
  const steps = useMemo(() => buildReportSteps(typeConfig), [typeConfig]);
  const lastStep = steps.length - 1;
  const currentStepId = steps[Math.min(currentStep, lastStep)].id;
  const details = detailsByType[formData.incidentType] ?? {};
  const victimRules = typeConfig?.victims ?? { allowed: true, label: "Victims", min: 0, max: null };
  const victimSingular = singularVictimLabel(victimRules.label);
  const atVictimLimit = victimRules.max !== null && formData.victims.length >= victimRules.max;

  // Field-level problems found when "Next" or "Submit" is pressed, keyed by the field's element id.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const clearFieldError = (id: string) =>
    setFieldErrors((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });

  // After a failed step, scroll to the first field with a problem and put the cursor in it.
  useEffect(() => {
    if (!focusTarget) return;
    const frame = requestAnimationFrame(() => {
      const wrap = document.getElementById(`${focusTarget}-wrap`) ?? document.getElementById(focusTarget);
      if (wrap) {
        wrap.scrollIntoView({ behavior: "smooth", block: "center" });
        const control =
          (wrap.matches("input, select, textarea") ? wrap : null) ??
          wrap.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea") ??
          wrap.querySelector<HTMLElement>("button");
        (control as HTMLElement | null)?.focus({ preventScroll: true });
      }
      setFocusTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, currentStep]);

  const setDetail = (name: string, value: DetailValue | undefined) => {
    clearFieldError(`detail-${name}`);
    setDetailsByType((prev) => {
      const next = { ...(prev[formData.incidentType] ?? {}) };
      if (value === undefined) delete next[name];
      else next[name] = value;
      return { ...prev, [formData.incidentType]: next };
    });
  };

  const setVictimDetail = (index: number, name: string, value: DetailValue | undefined) => {
    clearFieldError(`victim-${index}-${name}`);
    setFormData((prev) => {
      const victims = [...prev.victims];
      const nextDetails = { ...victims[index].details };
      if (value === undefined) delete nextDetails[name];
      else nextDetails[name] = value;
      victims[index] = { ...victims[index], details: nextDetails };
      return { ...prev, victims };
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "latitude" || name === "longitude") {
      setCoordinateSource("manual");
      setGpsAccuracy(null);
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const fillCoordinates = (
    latitude: number,
    longitude: number,
    source: CoordinateSource,
    accuracy: number | null = null,
  ) => {
    setFormData((prev) => ({
      ...prev,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    }));

    setCoordinateSource(source);
    setGpsAccuracy(accuracy);
  };

  const useCurrentGpsLocation = () => {
    if (!("geolocation" in navigator)) {
      setError(
        "GPS location is not supported by this browser. Enter coordinates manually.",
      );
      addNotification("GPS location is not supported by this browser.");
      return;
    }

    setIsGettingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        fillCoordinates(latitude, longitude, "gps", accuracy);
        setIsGettingLocation(false);

        addNotification(
          `GPS location captured${accuracy ? ` with ±${Math.round(accuracy)}m accuracy` : ""}.`,
        );
      },
      (locationError) => {
        console.error("[CreateReport] GPS error:", locationError);
        setIsGettingLocation(false);
        setError(
          "Unable to get current location. Allow location permission, turn on device location, or enter coordinates manually.",
        );
        addNotification("Unable to get current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const getCoordinateSourceLabel = () => {
    switch (coordinateSource) {
      case "gps":
        return `Device GPS${gpsAccuracy ? ` · ±${Math.round(gpsAccuracy)}m accuracy` : ""}`;
      case "manual":
        return "Typed in";
      default:
        return "No location yet";
    }
  };

  const handleVictimChange = (
    index: number,
    field: keyof VictimDetails,
    value: string,
  ) => {
    clearFieldError(`victim-${index}-${field}`);
    setFormData((prev) => {
      const updatedVictims = [...prev.victims];
      updatedVictims[index] = {
        ...updatedVictims[index],
        [field]: value as any,
      };

      return { ...prev, victims: updatedVictims };
    });
  };

  const syncVictimCount = (requestedCount: number) => {
    setFieldErrors({}); // Rows move, so their errors would point at the wrong person.
    const count = victimRules.max !== null ? Math.min(requestedCount, victimRules.max) : requestedCount;
    setFormData((prev) => {
      let currentVictims = [...prev.victims];

      if (count > currentVictims.length) {
        const diff = count - currentVictims.length;

        for (let i = 0; i < diff; i++) {
          currentVictims.push({ ...EMPTY_VICTIM, details: {} });
        }
      } else if (count < currentVictims.length) {
        currentVictims = currentVictims.slice(0, count);
      }

      return {
        ...prev,
        victimCount: count,
        victims: currentVictims,
      };
    });
  };

  const addVictimRow = () => {
    if (atVictimLimit) return;
    setFormData((prev) => ({
      ...prev,
      victimCount: prev.victims.length + 1,
      victims: [...prev.victims, { ...EMPTY_VICTIM, details: {} }],
    }));
  };

  const removeVictimRow = (index: number) => {
    setFieldErrors({}); // Rows move, so their errors would point at the wrong person.
    setFormData((prev) => {
      const updatedVictims = prev.victims.filter((_, idx) => idx !== index);

      return {
        ...prev,
        victimCount: updatedVictims.length,
        victims: updatedVictims,
      };
    });
  };

  // Each validator checks one page and returns the first problem, or null if the page is complete.
  const validateIncidentOverview = (): string | null => {
    if (!formData.timeOccurred.trim()) return "Time occurred is required.";
    if (!formData.incidentType.trim()) return "Incident type is required.";
    if (!formData.responderTeam.trim()) return "Your account has no team yet. Ask an admin to set your team (Alpha, Bravo or Charlie) in Users.";
    if (!formData.description.trim()) return "Incident description is required.";
    if (!formData.barangay.trim()) return "Barangay is required.";

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);

    if (!formData.latitude.trim() || !Number.isFinite(latitude)) {
      return "Valid latitude is required.";
    }

    if (!formData.longitude.trim() || !Number.isFinite(longitude)) {
      return "Valid longitude is required.";
    }

    if (
      latitude < 13.89 ||
      latitude > 13.98 ||
      longitude < 121.57 ||
      longitude > 121.69
    ) {
      return "Coordinates must be within Lucena City area.";
    }

    return null;
  };

  const validateIncidentDetails = (): string | null => {
    if (!typeConfig) return null;
    return validateDetailValues(typeConfig.fields, details);
  };

  const validateVictimProfiling = (): string | null => {
    if (!victimRules.allowed) return null;

    if (formData.victims.length < victimRules.min) {
      return `Add at least ${victimRules.min} ${victimSingular.toLowerCase()}.`;
    }
    if (victimRules.max !== null && formData.victims.length > victimRules.max) {
      return `Only ${victimRules.max} ${victimSingular.toLowerCase()} allowed for this incident type.`;
    }

    for (const [index, victim] of formData.victims.entries()) {
      for (const field of Object.keys(VICTIM_FIELD_LABELS) as (keyof typeof VICTIM_FIELD_LABELS)[]) {
        if (!String(victim[field]).trim()) {
          return `${victimSingular} ${index + 1}: ${VICTIM_FIELD_LABELS[field]} is required.`;
        }
      }
      if (typeConfig) {
        const victimError = validateDetailValues(typeConfig.victimFields, victim.details, `${victimSingular} ${index + 1}: `);
        if (victimError) return victimError;
      }
    }

    return null;
  };

  const validateOperationLog = (): string | null => {
    if (!formData.actionTaken.trim()) return "Action taken details are required.";
    return null;
  };

  /** Every field on a page that has a problem, in page order, as [element id, message]. */
  const collectFieldErrors = (stepId: StepId): [string, string][] => {
    const found: [string, string][] = [];
    if (stepId === "details" && typeConfig) {
      for (const spec of typeConfig.fields) {
        const message = validateDetailValue(spec, details[spec.name]);
        if (message) found.push([`detail-${spec.name}`, message]);
      }
    }
    if (stepId === "victims" && victimRules.allowed) {
      formData.victims.forEach((victim, index) => {
        for (const field of Object.keys(VICTIM_FIELD_LABELS) as (keyof typeof VICTIM_FIELD_LABELS)[]) {
          if (!String(victim[field]).trim()) found.push([`victim-${index}-${field}`, `${VICTIM_FIELD_LABELS[field]} is required.`]);
        }
        for (const spec of typeConfig?.victimFields ?? []) {
          const message = validateDetailValue(spec, victim.details[spec.name]);
          if (message) found.push([`victim-${index}-${spec.name}`, message]);
        }
      });
    }
    return found;
  };

  /** Mark the fields with problems on a page and send the cursor to the first one. */
  const flagFields = (stepId: StepId) => {
    const found = collectFieldErrors(stepId);
    setFieldErrors(Object.fromEntries(found));
    if (found.length) setFocusTarget(found[0][0]);
  };

  const stepValidators: Record<StepId, () => string | null> = {
    overview: validateIncidentOverview,
    details: validateIncidentDetails,
    victims: validateVictimProfiling,
    operation: validateOperationLog,
  };

  const showError = (message: string) => {
    setError(message);
    addNotification(message);
  };

  const goToStep = (step: number) => {
    setError(null);
    setFieldErrors({});
    setCurrentStep(step);

    // Types that need at least one patient start with an empty patient card ready to fill in.
    if (steps[step]?.id === "victims" && formData.victims.length < victimRules.min) {
      syncVictimCount(victimRules.min);
    }

    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showStepError = (stepId: StepId, message: string) => {
    const index = steps.findIndex((step) => step.id === stepId);
    if (index >= 0) setCurrentStep(index);
    showError(message);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Turn a 400 response from the backend into a message, and open the page it belongs to.
  const showServerError = (err: unknown) => {
    const data = (axios.isAxiosError(err) ? err.response?.data : undefined) as Record<string, unknown> | undefined;
    const firstMessage = (value: unknown): string | null => {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return value.length ? firstMessage(value[0]) : null;
      if (value && typeof value === "object") {
        for (const item of Object.values(value)) {
          const message = firstMessage(item);
          if (message) return message;
        }
      }
      return null;
    };

    if (data?.details) return showStepError("details", firstMessage(data.details) ?? "Check the incident details.");
    if (data?.victims) return showStepError("victims", firstMessage(data.victims) ?? "Check the victim list.");
    if (data?.coordinates || data?.latitude || data?.longitude) {
      return showStepError("overview", firstMessage(data.coordinates ?? data.latitude ?? data.longitude) ?? "Check the coordinates.");
    }
    showError(firstMessage(data) ?? "Failed to save report. Please check your connection and try again.");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Before the last page, "Next" (or pressing Enter) only checks the current page and moves on.
    if (currentStep < lastStep) {
      const stepError = stepValidators[currentStepId]();
      if (stepError) {
        showError(stepError);
        flagFields(currentStepId);
        return;
      }

      goToStep(currentStep + 1);
      return;
    }

    // On the last page, check every page again before sending, and jump back to any page with a problem.
    for (const step of steps) {
      const stepError = stepValidators[step.id]();
      if (stepError) {
        showStepError(step.id, stepError);
        flagFields(step.id);
        return;
      }
    }

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);

    // Only send this type's fields; victims are left out for types without a victim list.
    const victims = victimRules.allowed
      ? formData.victims.map((victim) => ({
          ...victim,
          details: typeConfig ? cleanDetailValues(typeConfig.victimFields, victim.details) : {},
        }))
      : [];

    const payload: CreateIncidentReportPayload = {
      timeOccurred: formData.timeOccurred,
      incidentType: formData.incidentType,
      responderTeam: formData.responderTeam,
      description: formData.description,
      location: `${formData.barangay}, Lucena City`,
      latitude,
      longitude,
      victimCount: victims.length,
      victims,
      actionTaken: formData.actionTaken,
      details: typeConfig ? cleanDetailValues(typeConfig.fields, details) : {},
      status: "Pending",
    };

    // No signal at the scene: keep the report on this phone; it is sent once the phone is online.
    const keepForLater = () => {
      if (!saveReportForLater(payload)) return false;
      addNotification("No connection. The report is saved on this phone and will be sent when you are back online.");
      navigate("/responder-dashboard", { state: { message: "Report saved on this phone", success: true } });
      return true;
    };

    if (!navigator.onLine && keepForLater()) return;

    try {
      setIsLoading(true);
      setError(null);

      await createIncidentReport(payload);

      addNotification("Report submitted successfully!");

      navigate("/responder-dashboard", {
        state: {
          message: "Report submitted successfully",
          success: true,
        },
      });
    } catch (err) {
      console.error("[CreateReport] Error saving report:", err);
      if (isConnectionError(err) && keepForLater()) return;
      showServerError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSectionHeader = (stepId: StepId) => {
    const step = steps.findIndex((item) => item.id === stepId);
    const info = steps[step];

    return (
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ${info.accent}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={info.icon} />
          </svg>
        </span>

        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
            {info.title}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {info.description}
          </p>
        </div>
      </div>
    );
  };

  const SHORT_CHOICE_LIMIT = 4;
  // Triage colors next to their options.
  const CHOICE_DOTS: Record<string, string> = { red: "bg-red-500", yellow: "bg-amber-400", green: "bg-emerald-500" };

  const inputClass =
    "w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-slate-400";

  // The details page's fields in their groups (one untitled group for types without groups).
  const detailGroups = (() => {
    if (!typeConfig) return [];
    const groups = DETAIL_GROUPS[typeConfig.key];
    if (!groups) return [{ title: "", specs: typeConfig.fields }];
    const placed = new Set(groups.flatMap((group) => group.names));
    const result = groups.map((group) => ({
      title: group.title,
      specs: group.names
        .map((name) => typeConfig.fields.find((spec) => spec.name === name))
        .filter((spec): spec is DetailFieldSpec => Boolean(spec)),
    }));
    const rest = typeConfig.fields.filter((spec) => !placed.has(spec.name));
    if (rest.length) result.push({ title: "Other details", specs: rest });
    return result.filter((group) => group.specs.length > 0);
  })();

  // Drowning: survivors are rescued alive plus revived with CPR; that is not the total number of victims.
  const renderDrowningTotals = () => {
    const count = (name: string) => {
      const value = details[name];
      return value === undefined || value === "" ? null : Number(value);
    };
    const rescued = count("rescued_alive");
    const revived = count("revived_cpr");
    const died = count("fatalities");
    const missing = count("missing");
    const survivors = rescued === null || revived === null ? null : rescued + revived;
    const everyone = survivors === null || died === null || missing === null ? null : survivors + died + missing;
    return (
      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs" aria-live="polite">
        <div>
          <dt className="font-semibold text-slate-500">Survivors</dt>
          <dd className="text-base font-black tabular-nums text-slate-900">{survivors ?? "–"}</dd>
          <dd className="text-[11px] text-slate-400">Rescued alive plus revived</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">All people accounted for</dt>
          <dd className="text-base font-black tabular-nums text-slate-900">{everyone ?? "–"}</dd>
          <dd className="text-[11px] text-slate-400">Survivors, fatalities and missing</dd>
        </div>
      </dl>
    );
  };

  const renderVictimFieldError = (index: number, field: string) => {
    const message = fieldErrors[`victim-${index}-${field}`];
    return message ? <p className="mt-1.5 text-xs font-semibold text-red-600">{message}</p> : null;
  };

  // One type-specific field: its control, a short hint when it is easy to misread, and its error.
  const renderDetailField = (
    spec: DetailFieldSpec,
    value: DetailValue | undefined,
    onChange: (value: DetailValue | undefined) => void,
    idPrefix: string,
  ) => {
    const id = `${idPrefix}-${spec.name}`;
    const fieldError = fieldErrors[id];
    const hint = typeConfig && idPrefix === "detail" ? FIELD_HINTS[`${typeConfig.key}.${spec.name}`] : undefined;
    const isWide =
      spec.kind === "multi_choice" || spec.kind === "bool" || (spec.kind === "choice" && spec.choices.length <= SHORT_CHOICE_LIMIT);
    return (
      <div
        key={spec.name}
        id={`${id}-wrap`}
        className={`${isWide ? "sm:col-span-2" : ""} ${
          fieldError
            ? "[&_input]:border-red-400 [&_select]:border-red-400 [&_[role=radio]]:border-red-300 [&_[aria-pressed]]:border-red-300"
            : ""
        }`}
      >
        {renderDetailControl(spec, value, onChange, idPrefix, hint ? `${id}-hint` : undefined, fieldError ? `${id}-error` : undefined)}
        {hint ? (
          <p id={`${id}-hint`} className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {hint}
          </p>
        ) : null}
        {fieldError ? (
          <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-red-600">
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  };

  // The control for one type-specific field. It depends on the kind of field.
  const renderDetailControl = (
    spec: DetailFieldSpec,
    value: DetailValue | undefined,
    onChange: (value: DetailValue | undefined) => void,
    idPrefix: string,
    hintId?: string,
    errorId?: string,
  ) => {
    const id = `${idPrefix}-${spec.name}`;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
    const label = (
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1.5">
        {spec.label}
        {spec.required ? <span className="text-red-500"> *</span> : null}
      </label>
    );
    const wide = spec.kind === "multi_choice" || spec.kind === "bool" ? "sm:col-span-2" : "";

    if (spec.kind === "choice") {
      const current = typeof value === "string" ? value : "";
      // Up to 4 options: show them all as buttons, quicker to tap than a dropdown.
      if (spec.choices.length <= SHORT_CHOICE_LIMIT) {
        return (
          <fieldset key={spec.name} className="sm:col-span-2">
            <legend className="mb-1.5 block text-xs font-semibold text-slate-600">
              {spec.label}
              {spec.required ? <span className="text-red-500"> *</span> : null}
            </legend>
            <div className="grid gap-2" role="radiogroup" aria-label={spec.label} aria-describedby={describedBy}>
              {spec.choices.map((choice) => {
                const isOn = current === choice.value;
                const dot = CHOICE_DOTS[choice.value];
                return (
                  <button
                    key={choice.value}
                    type="button"
                    role="radio"
                    aria-checked={isOn}
                    onClick={() => onChange(isOn && !spec.required ? undefined : choice.value)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                      isOn
                        ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isOn ? "border-blue-600" : "border-slate-300"
                      }`}
                      aria-hidden="true"
                    >
                      {isOn ? <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
                    </span>
                    {dot ? <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" /> : null}
                    <span className="min-w-0">{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      }
      return (
        <div key={spec.name} className={wide}>
          {label}
          <select id={id} className={inputClass} value={current} aria-invalid={Boolean(errorId)} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">Choose one</option>
            {spec.choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (spec.kind === "choice_other") {
      const text = typeof value === "string" ? value : "";
      const isListed = spec.choices.some((choice) => choice.value === text);
      // A saved value that is not in the list (typed before) also opens the text box.
      const isOther = id in typedOtherFields ? typedOtherFields[id] : text !== "" && !isListed;
      return (
        <div key={spec.name} className={wide}>
          {label}
          <select
            id={id}
            className={inputClass}
            value={isOther ? OTHER_OPTION : text}
            onChange={(e) => {
              const next = e.target.value;
              setTypedOtherFields((current) => ({ ...current, [id]: next === OTHER_OPTION }));
              onChange(next === OTHER_OPTION || next === "" ? undefined : next);
            }}
          >
            <option value="">{spec.label.toLowerCase().includes("hospital") ? "Choose a hospital" : "Choose one"}</option>
            {spec.choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
            <option value={OTHER_OPTION}>Others (type the name)</option>
          </select>
          {isOther ? (
            <input
              id={`${id}-other`}
              type="text"
              aria-label={`${spec.label}: other`}
              maxLength={200}
              autoFocus={!text}
              placeholder={`Type the ${spec.label.toLowerCase().includes("hospital") ? "hospital" : spec.label.toLowerCase()} name`}
              className={`${inputClass} mt-2`}
              value={text}
              onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
            />
          ) : null}
        </div>
      );
    }

    if (spec.kind === "multi_choice") {
      const selected = Array.isArray(value) ? value : [];
      return (
        <fieldset key={spec.name} className={wide}>
          <legend className="block text-xs font-semibold text-slate-600 mb-1.5">
            {spec.label}
            {spec.required ? <span className="text-red-500"> *</span> : null}
            <span className="ml-1 font-normal text-slate-400">(choose all that apply)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {spec.choices.map((choice) => {
              const isOn = selected.includes(choice.value);
              return (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => {
                    const next = isOn ? selected.filter((item) => item !== choice.value) : [...selected, choice.value];
                    onChange(next.length ? next : undefined);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                    isOn
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }

    if (spec.kind === "bool") {
      return (
        <fieldset key={spec.name} className="sm:col-span-2">
          <legend className="mb-1.5 block text-xs font-semibold text-slate-600">
            {spec.label}
            {spec.required ? <span className="text-red-500"> *</span> : null}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((option) => {
              const isOn = value === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={isOn}
                  aria-label={`${spec.label}: ${option.label}`}
                  onClick={() => onChange(isOn ? undefined : option.value)}
                  className={`rounded-xl border py-2.5 text-sm font-bold transition-colors ${
                    isOn
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }

    // Whole numbers: − and + buttons around the box, so a count can be set without the keyboard.
    if (spec.kind === "int") {
      const number = value === undefined || value === "" ? null : Number(value);
      const lowest = spec.min ?? 0;
      // From an empty box, − sets the lowest value (usually 0) and + sets one more than that.
      const step = (by: number) => {
        const next = number === null ? (by > 0 ? lowest + 1 : lowest) : Math.max(lowest, number + by);
        onChange(spec.max !== null && next > spec.max ? spec.max : next);
      };
      return (
        <div key={spec.name} className={wide}>
          {label}
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={number !== null && number <= lowest}
              aria-label={`${spec.label}: one less`}
              className="w-12 shrink-0 rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-600 transition-colors hover:border-blue-300 disabled:text-slate-300 disabled:hover:border-slate-200"
            >
              −
            </button>
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={lowest}
              max={spec.max !== null ? spec.max : undefined}
              step={1}
              aria-invalid={Boolean(errorId)}
              aria-describedby={describedBy}
              placeholder="–"
              className={`${inputClass} text-center text-base font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              value={number === null ? "" : String(value)}
              onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
            />
            <button
              type="button"
              onClick={() => step(1)}
              disabled={spec.max !== null && number !== null && number >= spec.max}
              aria-label={`${spec.label}: one more`}
              className="w-12 shrink-0 rounded-xl border border-slate-200 bg-white text-lg font-bold text-blue-700 transition-colors hover:border-blue-300 disabled:text-slate-300"
            >
              +
            </button>
          </div>
        </div>
      );
    }

    const inputType = spec.kind === "time" ? "time" : spec.kind === "decimal" ? "number" : "text";
    return (
      <div key={spec.name} className={wide}>
        {label}
        <input
          id={id}
          type={inputType}
          inputMode={spec.kind === "decimal" ? "decimal" : undefined}
          min={inputType === "number" ? spec.min : undefined}
          max={inputType === "number" && spec.max !== null ? spec.max : undefined}
          step={spec.kind === "decimal" ? "any" : undefined}
          className={inputClass}
          value={value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-28 pt-4 antialiased text-slate-800">
      <main className="max-w-lg mx-auto px-4 space-y-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-5 text-white shadow-md">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 opacity-60 pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("/responder-dashboard")}
                className="-ml-1 inline-flex items-center gap-1 rounded-lg py-1 pl-1 pr-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
              </button>
              <span
                className="truncate rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-blue-200"
                data-testid="header-team"
              >
                {formData.responderTeam ? `Team ${formData.responderTeam}` : "No team yet"}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">New incident report</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Fill it in from the scene. An admin checks it before it counts in the city’s records.
              </p>
            </div>
          </div>
        </div>

        <nav
          ref={formTopRef}
          aria-label="Report steps"
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white px-2 py-4 sm:px-4 shadow-sm"
        >
          <ol className="flex">
            {steps.map((step, index) => {
              const isDone = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <li key={step.id} className="relative flex-1">
                  {index < lastStep && (
                    <span
                      aria-hidden="true"
                      className={`absolute top-5 left-1/2 h-0.5 w-full transition-colors ${
                        isDone ? "bg-emerald-400" : "bg-slate-200"
                      }`}
                    />
                  )}

                  <button
                    type="button"
                    // Only pages already finished can be reopened; moving forward always goes through "Next".
                    onClick={() => isDone && goToStep(index)}
                    disabled={!isDone || isLoading}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`relative z-10 flex w-full flex-col items-center gap-2 px-1 text-center ${
                      isDone ? "cursor-pointer group" : "cursor-default"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isCurrent
                          ? "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100"
                          : isDone
                            ? "border-emerald-500 bg-emerald-500 text-white group-hover:ring-4 group-hover:ring-emerald-100"
                            : "border-slate-200 bg-white text-slate-400"
                      }`}
                    >
                      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isDone ? 3 : 2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={isDone ? "M5 13l4 4L19 7" : step.icon}
                        />
                      </svg>
                    </span>

                    <span
                      className={`text-[11px] sm:text-xs font-bold leading-tight ${
                        isCurrent ? "text-blue-700" : isDone ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    <span className="hidden sm:block text-[11px] font-medium leading-snug text-slate-400">
                      {step.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden divide-y divide-slate-100"
        >
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-l-red-500 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>

              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">
                  Check this before you continue
                </p>
                <p className="text-sm text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {currentStepId === "overview" && (
          <div
            className="p-5 space-y-5 sm:p-6"
          >
            {renderSectionHeader("overview")}

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Time Occurred
                </label>

                <input
                  type="time"
                  name="timeOccurred"
                  value={formData.timeOccurred}
                  onChange={handleInputChange}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Incident Type
                </label>

                <select
                  name="incidentType"
                  value={formData.incidentType}
                  onChange={handleInputChange}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                  required
                >
                  <option value="">Select incident type</option>
                  <option value="RCA">RCA</option>
                  <option value="Fire Incident">Fire Incident</option>
                  <option value="Crime Against Person/Property">
                    Crime Against Person/Property
                  </option>
                  <option value="Medical Emergency">Medical Emergency</option>
                  <option value="Ambulance Assistance">
                    Ambulance Assistance
                  </option>
                  <option value="Stand-by Medical Team">
                    Stand-by Medical Team
                  </option>
                  <option value="Drowning">Drowning</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Responding Team
                </label>

                <input
                  type="text"
                  name="responderTeam"
                  value={formData.responderTeam}
                  readOnly
                  aria-readonly="true"
                  placeholder="No team set on your account"
                  className="w-full text-sm border border-blue-200 rounded-xl px-3.5 py-2.5 bg-blue-50 text-slate-900 font-bold outline-none"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {formData.responderTeam
                    ? `From your account${account.username ? ` (@${account.username})` : ""}. Ask an admin to change your team.`
                    : "Your account has no team yet. Ask an admin to set your team (Alpha, Bravo or Charlie) in Users."}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Incident Description / Particulars
              </label>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                placeholder="Describe what happened..."
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none font-medium placeholder-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Barangay *
              </label>

              <select
                name="barangay"
                value={formData.barangay}
                onChange={handleInputChange}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                required
              >
                <option value="">Select barangay</option>
                {LUCENA_BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-[11px] text-slate-500">
                The barangay where it happened.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-bold text-blue-800">
                    Exact location
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Use your phone's GPS while you are at the scene, or type the coordinates below.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={useCurrentGpsLocation}
                    disabled={isGettingLocation}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {isGettingLocation
                      ? "Getting your location…"
                      : "Use my current location"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/70 bg-white px-3 py-2 text-xs text-slate-600">
                <span className="font-bold text-slate-800">
                  Source:
                </span>{" "}
                {getCoordinateSourceLabel()}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Latitude *
                </label>

                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  placeholder="Example: 13.9414"
                  min="13.89"
                  max="13.98"
                  step="0.000001"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-slate-400"
                  required
                />

                <p className="mt-1 text-[11px] text-slate-400">
                  Lucena latitude range: 13.89 to 13.98
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Longitude *
                </label>

                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  placeholder="Example: 121.6236"
                  min="121.57"
                  max="121.69"
                  step="0.000001"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-slate-400"
                  required
                />

                <p className="mt-1 text-[11px] text-slate-400">
                  Lucena longitude range: 121.57 to 121.69
                </p>
              </div>
            </div>
          </div>
          )}

          {currentStepId === "details" && (
          <div className="p-5 space-y-5 sm:p-6">
            {renderSectionHeader("details")}

            {typeConfig ? (
              <>
                <p className="text-xs text-slate-500">
                  Fields marked <span className="font-bold text-red-500">*</span> are required. For counts, 0 is a valid answer.
                </p>
                {detailGroups.map((group) => (
                  <section key={group.title} className="space-y-3" aria-label={group.title || undefined}>
                    {group.title ? (
                      <h3 className="border-b border-slate-100 pb-1.5 text-sm font-black text-slate-900">{group.title}</h3>
                    ) : null}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {group.specs.map((spec) =>
                        renderDetailField(spec, details[spec.name], (value) => setDetail(spec.name, value), "detail"),
                      )}
                    </div>
                    {typeConfig.key === "drowning" && group.title === "Victim status" ? renderDrowningTotals() : null}
                  </section>
                ))}
              </>
            ) : (
              <p className="text-sm text-slate-500">This incident type has no extra fields. Continue to the next step.</p>
            )}
          </div>
          )}

          {currentStepId === "victims" && (
          <div className="p-5 space-y-5 sm:p-6">
            {renderSectionHeader("victims")}

            {typeConfig && VICTIM_STEP_NOTES[typeConfig.key] ? (
              <p className="rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-blue-900">
                {VICTIM_STEP_NOTES[typeConfig.key]}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 pl-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                Total {(victimRules.label ?? "victims").toLowerCase()}
                <input
                  type="number"
                  value={formData.victimCount}
                  onChange={(e) =>
                    syncVictimCount(
                      Math.max(0, parseInt(e.target.value) || 0),
                    )
                  }
                  min={victimRules.min}
                  max={victimRules.max ?? undefined}
                  className="w-14 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-sm font-bold text-blue-600 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <button
                type="button"
                onClick={addVictimRow}
                disabled={atVictimLimit}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-600 shadow-sm transition-all hover:bg-blue-100/70 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add {victimSingular}
              </button>
            </div>

            <div className="space-y-4">
              {formData.victims.map((victim, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                >
                  <div className="text-xs font-bold text-slate-400 border-b border-slate-100 pb-2 flex justify-between items-center">
                    <span className="text-sm font-black text-slate-900">{victimSingular} {idx + 1}</span>

                    <button
                      type="button"
                      onClick={() => removeVictimRow(idx)}
                      className="text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition text-[11px] font-semibold"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor={`victim-${idx}-name`} className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Full Name
                      </label>

                      <input
                        type="text"
                        id={`victim-${idx}-name`}
                        aria-invalid={Boolean(fieldErrors[`victim-${idx}-name`])}
                        value={victim.name}
                        onChange={(e) =>
                          handleVictimChange(idx, "name", e.target.value)
                        }
                        placeholder="Full name"
                        className="w-full text-sm border border-slate-200 aria-[invalid=true]:border-red-400 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                        required
                      />
                      {renderVictimFieldError(idx, "name")}
                    </div>

                    <div>
                      <label htmlFor={`victim-${idx}-age`} className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Age
                      </label>

                      <input
                        type="text"
                        id={`victim-${idx}-age`}
                        aria-invalid={Boolean(fieldErrors[`victim-${idx}-age`])}
                        value={victim.age}
                        onChange={(e) =>
                          handleVictimChange(idx, "age", e.target.value)
                        }
                        placeholder="Age"
                        className="w-full text-sm border border-slate-200 aria-[invalid=true]:border-red-400 rounded-xl px-3 py-2 text-center outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                        required
                      />
                      {renderVictimFieldError(idx, "age")}
                    </div>

                    <div>
                      <label htmlFor={`victim-${idx}-gender`} className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Biological Sex
                      </label>

                      <select
                        id={`victim-${idx}-gender`}
                        aria-invalid={Boolean(fieldErrors[`victim-${idx}-gender`])}
                        value={victim.gender}
                        onChange={(e) =>
                          handleVictimChange(
                            idx,
                            "gender",
                            e.target.value as "M" | "F",
                          )
                        }
                        className="w-full text-sm border border-slate-200 aria-[invalid=true]:border-red-400 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                        required
                      >
                        <option value="">Select</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                      {renderVictimFieldError(idx, "gender")}
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`victim-${idx}-address`} className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Permanent/Temporary Address
                    </label>

                    <input
                      type="text"
                      id={`victim-${idx}-address`}
                      aria-invalid={Boolean(fieldErrors[`victim-${idx}-address`])}
                      value={victim.address}
                      onChange={(e) =>
                        handleVictimChange(idx, "address", e.target.value)
                      }
                      placeholder="Street, barangay, city/municipality"
                      className="w-full text-sm border border-slate-200 aria-[invalid=true]:border-red-400 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium placeholder-slate-400"
                      required
                    />
                    {renderVictimFieldError(idx, "address")}
                  </div>

                  <div>
                    <label htmlFor={`victim-${idx}-condition`} className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Physical Condition / Medical Assessment
                    </label>

                    <input
                      type="text"
                      id={`victim-${idx}-condition`}
                      aria-invalid={Boolean(fieldErrors[`victim-${idx}-condition`])}
                      value={victim.condition}
                      onChange={(e) =>
                        handleVictimChange(idx, "condition", e.target.value)
                      }
                      placeholder="e.g. conscious, abrasion, transported"
                      className="w-full text-sm border border-slate-200 aria-[invalid=true]:border-red-400 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium placeholder-slate-400"
                      required
                    />
                    {renderVictimFieldError(idx, "condition")}
                  </div>

                  {typeConfig && typeConfig.victimFields.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      {typeConfig.victimFields.map((spec) =>
                        renderDetailField(
                          spec,
                          victim.details[spec.name],
                          (value) => setVictimDetail(idx, spec.name, value),
                          `victim-${idx}`,
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {formData.victims.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-sm text-slate-400 font-medium">
                {victimRules.min > 0
                  ? `Add at least ${victimRules.min} ${victimSingular.toLowerCase()} before continuing.`
                  : `No ${(victimRules.label ?? "victims").toLowerCase()} logged for this response. Tap "Add ${victimSingular}" if there are any, or continue to the next step.`}
              </div>
            )}
          </div>
          )}

          {currentStepId === "operation" && (
          <div className="p-5 space-y-5 sm:p-6">
            {renderSectionHeader("operation")}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Action Taken
              </label>

              <textarea
                name="actionTaken"
                value={formData.actionTaken}
                onChange={handleInputChange}
                rows={3}
                placeholder="Describe field operations, interventions, or medical treatment rendered..."
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none font-medium placeholder-slate-400"
                required
              />
            </div>
          </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs font-medium text-slate-500">
              {currentStep < lastStep ? (
                <>
                  Up next:{" "}
                  <span className="font-bold text-slate-700">
                    {steps[currentStep + 1].title}
                  </span>
                </>
              ) : (
                "Last step. Review your entries, then submit."
              )}
            </p>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <button
                type="button"
                onClick={() =>
                  currentStep === 0
                    ? navigate("/responder-dashboard")
                    : goToStep(currentStep - 1)
                }
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {currentStep > 0 && (
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                )}
                {currentStep === 0 ? "Cancel" : "Back"}
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 sm:px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                {currentStep < lastStep ? (
                  <>
                    Next
                    <svg className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                ) : isLoading ? (
                  "Submitting..."
                ) : (
                  <>
                    Submit Report
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>

      <MobileNavBar />
    </div>
  );
};

export default CreateReport;