import { useRef, useState } from "react";
import type { FC, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MobileNavBar } from "../../components/MobileNavBar";
import { addNotification } from "../../services/notifications";
import { getCurrentUserDisplayName } from "../../services/auth";

interface VictimDetails {
  name: string;
  age: string;
  gender: "M" | "F" | "";
  address: string;
  condition: string;
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

// The report is filled in one page at a time, in this order.
const REPORT_STEPS = [
  {
    title: "Incident Overview",
    description: "When, what, and where it happened",
    accent: "bg-blue-50 text-blue-600 border-blue-100",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    title: "Victim Profiling",
    description: "Every casualty and their condition",
    accent: "bg-indigo-50 text-indigo-600 border-indigo-100",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    title: "Operation Log",
    description: "What your team did on site",
    accent: "bg-emerald-50 text-emerald-600 border-emerald-100",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
] as const;

const LAST_STEP = REPORT_STEPS.length - 1;

const VICTIM_FIELD_LABELS: Record<keyof VictimDetails, string> = {
  name: "Full name",
  age: "Age",
  gender: "Biological sex",
  address: "Address",
  condition: "Physical condition",
};

const LUCENA_BARANGAYS = [
  "Barangay 1",
  "Barangay 2",
  "Barangay 3",
  "Barangay 4",
  "Barangay 5",
  "Barangay 6",
  "Barangay 7",
  "Barangay 8",
  "Barangay 9",
  "Barangay 10",
  "Barangay 11",
  "Barra",
  "Bocohan",
  "Cotta",
  "Dalahican",
  "Domoit",
  "Gulang-Gulang",
  "Ibabang Dupay",
  "Ibabang Iyam",
  "Ibabang Talim",
  "Ilayang Dupay",
  "Ilayang Iyam",
  "Ilayang Talim",
  "Isabang",
  "Market View",
  "Mayao Castillo",
  "Mayao Crossing",
  "Mayao Kanluran",
  "Mayao Parada",
  "Mayao Silangan",
  "Ransohan",
  "Salinas",
  "Talao-Talao",
] as const;

export const CreateReport: FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<IncidentReportForm>({
    timeOccurred: new Date().toTimeString().slice(0, 5),
    incidentType: "",
    responderTeam: getCurrentUserDisplayName() || "",
    description: "",
    barangay: "",
    latitude: "",
    longitude: "",
    victimCount: 0,
    victims: [],
    actionTaken: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [coordinateSource, setCoordinateSource] =
    useState<CoordinateSource>("none");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const formTopRef = useRef<HTMLDivElement>(null);

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
        return "Manually entered coordinates";
      default:
        return "No coordinates captured yet";
    }
  };

  const handleVictimChange = (
    index: number,
    field: keyof VictimDetails,
    value: string,
  ) => {
    setFormData((prev) => {
      const updatedVictims = [...prev.victims];
      updatedVictims[index] = {
        ...updatedVictims[index],
        [field]: value as any,
      };

      return { ...prev, victims: updatedVictims };
    });
  };

  const syncVictimCount = (count: number) => {
    setFormData((prev) => {
      let currentVictims = [...prev.victims];

      if (count > currentVictims.length) {
        const diff = count - currentVictims.length;

        for (let i = 0; i < diff; i++) {
          currentVictims.push({
            name: "",
            age: "",
            gender: "",
            address: "",
            condition: "",
          });
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
    setFormData((prev) => ({
      ...prev,
      victimCount: prev.victimCount + 1,
      victims: [
        ...prev.victims,
        { name: "", age: "", gender: "", address: "", condition: "" },
      ],
    }));
  };

  const removeVictimRow = (index: number) => {
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
    if (!formData.responderTeam.trim()) return "Responding team is required.";
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

  const validateVictimProfiling = (): string | null => {
    for (const [index, victim] of formData.victims.entries()) {
      for (const field of Object.keys(VICTIM_FIELD_LABELS) as (keyof VictimDetails)[]) {
        if (!String(victim[field]).trim()) {
          return `Case patient #${index + 1}: ${VICTIM_FIELD_LABELS[field]} is required.`;
        }
      }
    }

    return null;
  };

  const validateOperationLog = (): string | null => {
    if (!formData.actionTaken.trim()) return "Action taken details are required.";
    return null;
  };

  const stepValidators = [
    validateIncidentOverview,
    validateVictimProfiling,
    validateOperationLog,
  ];

  const showError = (message: string) => {
    setError(message);
    addNotification(message);
  };

  const goToStep = (step: number) => {
    setError(null);
    setCurrentStep(step);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Before the last page, "Next" (or pressing Enter) only checks the current page and moves on.
    if (currentStep < LAST_STEP) {
      const stepError = stepValidators[currentStep]();
      if (stepError) {
        showError(stepError);
        return;
      }

      goToStep(currentStep + 1);
      return;
    }

    // On the last page, check every page again before sending, and jump back to any page with a problem.
    for (const [step, validate] of stepValidators.entries()) {
      const stepError = validate();
      if (stepError) {
        setCurrentStep(step);
        showError(stepError);
        formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        "http://127.0.0.1:8000/api/incidents/incident-reports/",
        {
          method: "POST",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeOccurred: formData.timeOccurred,
            incidentType: formData.incidentType,
            responderTeam: formData.responderTeam,
            description: formData.description,
            barangay: formData.barangay,
            barangayName: formData.barangay,
            location: `${formData.barangay}, Lucena City`,
            address: `${formData.barangay}, Lucena City`,
            latitude,
            longitude,
            victimCount: formData.victimCount,
            victims: formData.victims,
            actionTaken: formData.actionTaken,
            status: "Pending",
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      addNotification("Report submitted successfully!");

      navigate("/responder-dashboard", {
        state: {
          message: "Report submitted successfully",
          success: true,
        },
      });
    } catch (err) {
      console.error("[CreateReport] Error saving report:", err);
      setError("Failed to save report. Please try again.");
      addNotification("Failed to save report.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderSectionHeader = (step: number) => {
    const info = REPORT_STEPS[step];

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
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Step {step + 1} of {REPORT_STEPS.length}
          </p>
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

  const getAccentColor = (type: string) => {
    switch (type) {
      case "Fire Incident":
        return "border-l-4 border-l-red-500";
      case "RCA":
        return "border-l-4 border-l-amber-500";
      case "Medical Emergency":
        return "border-l-4 border-l-blue-600";
      case "Crime Against Person/Property":
        return "border-l-4 border-l-orange-600";
      default:
        return "border-l-4 border-l-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-5 sm:p-7 text-white shadow-md">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 opacity-60 pointer-events-none" />

          <div className="relative z-10 flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate("/responder-dashboard")}
              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
              title="Back to Dashboard"
            >
              <svg
                className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <span className="inline-flex text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-md">
                Response Protocol
              </span>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                New Incident Report
              </h1>
              <p className="mt-1 text-sm text-slate-400 font-medium leading-relaxed">
                Document emergency response operations and victim assessments
                for synchronization with central command.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/responder-dashboard")}
              className="hidden sm:inline-flex shrink-0 text-xs font-bold text-slate-400 hover:text-red-400 transition-colors uppercase tracking-widest"
            >
              Discard
            </button>
          </div>

          <div className="relative z-10 mt-6">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold">
              <span className="text-blue-300">
                Step {currentStep + 1} of {REPORT_STEPS.length}
              </span>
              <span className="truncate text-slate-400">
                {REPORT_STEPS[currentStep].title}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={REPORT_STEPS.length}
              aria-valuenow={currentStep + 1}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500"
                style={{ width: `${((currentStep + 1) / REPORT_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <nav
          ref={formTopRef}
          aria-label="Report steps"
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white px-2 py-4 sm:px-4 shadow-sm"
        >
          <ol className="flex">
            {REPORT_STEPS.map((step, index) => {
              const isDone = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <li key={step.title} className="relative flex-1">
                  {index < LAST_STEP && (
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
                  Submission Error
                </p>
                <p className="text-sm text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {currentStep === 0 && (
          <div
            className={`p-6 space-y-5 transition-all ${getAccentColor(formData.incidentType)}`}
          >
            {renderSectionHeader(0)}

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
                  placeholder="Responding team is set from your logged-in account"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-100 text-slate-600 cursor-not-allowed transition-all outline-none font-medium"
                  required
                />
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

              <p className="mt-1 text-[11px] text-slate-400">
                This replaces the old location input and saves a consistent
                Lucena City barangay for reports, analytics, and mapping.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                    GPS Coordinates
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Use browser GPS for real testing. Enter coordinates manually if GPS is unavailable.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={useCurrentGpsLocation}
                    disabled={isGettingLocation}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGettingLocation
                      ? "Getting GPS..."
                      : "Use Current GPS Location"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/70 bg-white px-3 py-2 text-xs text-slate-600">
                <span className="font-bold text-slate-800">
                  Coordinate Source:
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

          {currentStep === 1 && (
          <div className="p-6 space-y-5 border-l-4 border-l-indigo-500">
            {renderSectionHeader(1)}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 pl-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                Total victims
                <input
                  type="number"
                  value={formData.victimCount}
                  onChange={(e) =>
                    syncVictimCount(
                      Math.max(0, parseInt(e.target.value) || 0),
                    )
                  }
                  min="0"
                  className="w-14 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-sm font-bold text-blue-600 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <button
                type="button"
                onClick={addVictimRow}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-600 shadow-sm transition-all hover:bg-blue-100/70 active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Victim
              </button>
            </div>

            <div className="space-y-4">
              {formData.victims.map((victim, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                >
                  <div className="text-xs font-bold text-slate-400 border-b border-slate-100 pb-2 flex justify-between items-center">
                    <span>CASE PATIENT #{idx + 1}</span>

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
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Full Name
                      </label>

                      <input
                        type="text"
                        value={victim.name}
                        onChange={(e) =>
                          handleVictimChange(idx, "name", e.target.value)
                        }
                        placeholder="Full name"
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Age
                      </label>

                      <input
                        type="text"
                        value={victim.age}
                        onChange={(e) =>
                          handleVictimChange(idx, "age", e.target.value)
                        }
                        placeholder="Age"
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-center outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Biological Sex
                      </label>

                      <select
                        value={victim.gender}
                        onChange={(e) =>
                          handleVictimChange(
                            idx,
                            "gender",
                            e.target.value as "M" | "F",
                          )
                        }
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                        required
                      >
                        <option value="">Select</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Permanent/Temporary Address
                    </label>

                    <input
                      type="text"
                      value={victim.address}
                      onChange={(e) =>
                        handleVictimChange(idx, "address", e.target.value)
                      }
                      placeholder="Street, barangay, city/municipality"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium placeholder-slate-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Physical Condition / Medical Assessment
                    </label>

                    <input
                      type="text"
                      value={victim.condition}
                      onChange={(e) =>
                        handleVictimChange(idx, "condition", e.target.value)
                      }
                      placeholder="e.g. conscious, abrasion, transported"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium placeholder-slate-400"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            {formData.victimCount === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-sm text-slate-400 font-medium">
                No casualties or victim profiles logged for this response
                operation. Tap "Add Victim" if there are any, or continue to
                the next step.
              </div>
            )}
          </div>
          )}

          {currentStep === 2 && (
          <div className="p-6 space-y-5 border-l-4 border-l-emerald-500">
            {renderSectionHeader(2)}

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
              {currentStep < LAST_STEP ? (
                <>
                  Up next:{" "}
                  <span className="font-bold text-slate-700">
                    {REPORT_STEPS[currentStep + 1].title}
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
                {currentStep < LAST_STEP ? (
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