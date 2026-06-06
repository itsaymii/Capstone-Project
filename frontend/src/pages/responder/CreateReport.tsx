import { useState } from "react";
import type { FC, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MobileNavBar } from "../../components/MobileNavBar";
import { addNotification } from "../../services/notifications";

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

type CoordinateSource = "none" | "gps" | "development" | "manual";

const LUCENA_CENTER_COORDINATES = {
  latitude: 13.9414,
  longitude: 121.6236,
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

function isWithinLucena(latitude: number, longitude: number): boolean {
  return (
    latitude >= 13.89 &&
    latitude <= 13.98 &&
    longitude >= 121.57 &&
    longitude <= 121.69
  );
}

export const CreateReport: FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<IncidentReportForm>({
    timeOccurred: new Date().toTimeString().slice(0, 5),
    incidentType: "",
    responderTeam: "",
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

  const useDevelopmentLocation = () => {
    fillCoordinates(
      LUCENA_CENTER_COORDINATES.latitude,
      LUCENA_CENTER_COORDINATES.longitude,
      "development",
      null,
    );

    setError(null);
    addNotification("Development coordinates added for Lucena City testing.");
  };

  const useCurrentGpsLocation = () => {
    if (!("geolocation" in navigator)) {
      setError(
        "GPS location is not supported by this browser. Use development coordinates or enter coordinates manually.",
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

        if (!isWithinLucena(latitude, longitude)) {
          setError(
            "GPS coordinates were captured, but they are outside the Lucena City validation range. Use this only if testing outside Lucena.",
          );
          addNotification("GPS captured, but outside Lucena City range.");
          return;
        }

        addNotification(
          `GPS location captured${accuracy ? ` with ±${Math.round(accuracy)}m accuracy` : ""}.`,
        );
      },
      (locationError) => {
        console.error("[CreateReport] GPS error:", locationError);
        setIsGettingLocation(false);
        setError(
          "Unable to get current location. Allow location permission, turn on device location, or use development coordinates.",
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
      case "development":
        return "Development test location · Lucena City center";
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.incidentType.trim()) {
      setError("Incident type is required.");
      addNotification("Incident type is required.");
      return;
    }

    if (!formData.responderTeam.trim()) {
      setError("Responding team is required.");
      addNotification("Responding team is required.");
      return;
    }

    if (!formData.description.trim()) {
      setError("Incident description is required.");
      addNotification("Incident description is required.");
      return;
    }

    if (!formData.barangay.trim()) {
      setError("Barangay is required.");
      addNotification("Barangay is required.");
      return;
    }

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);

    if (!Number.isFinite(latitude)) {
      setError("Valid latitude is required.");
      addNotification("Valid latitude is required.");
      return;
    }

    if (!Number.isFinite(longitude)) {
      setError("Valid longitude is required.");
      addNotification("Valid longitude is required.");
      return;
    }

    if (
      latitude < 13.89 ||
      latitude > 13.98 ||
      longitude < 121.57 ||
      longitude > 121.69
    ) {
      setError("Coordinates must be within Lucena City area.");
      addNotification("Coordinates must be within Lucena City area.");
      return;
    }

    if (!formData.actionTaken.trim()) {
      setError("Action taken details are required.");
      addNotification("Action taken details are required.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        "http://127.0.0.1:8000/api/incidents/incident-reports/",
        {
          method: "POST",
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
            status: "Submitted",
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
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/responder-dashboard")}
              className="group flex items-center justify-center w-10 h-10 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all border border-slate-100 shadow-sm active:scale-90"
              title="Back to Dashboard"
            >
              <svg
                className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 opacity-60 block mb-0.5 leading-none">
                Response Protocol
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                New Incident Report
              </h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
              Document emergency response operations and victim assessments for
              synchronization with central command.
            </p>

            <button
              onClick={() => navigate("/responder-dashboard")}
              className="hidden sm:inline-flex text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
            >
              Discard Report
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
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

          <div
            className={`p-6 space-y-5 transition-all ${getAccentColor(formData.incidentType)}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                0. Incident Overview
              </h3>

              <span className="text-[11px] font-semibold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                Required Form
              </span>
            </div>

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
                  onChange={handleInputChange}
                  placeholder="e.g. Ambulance Team"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-slate-400"
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
                    Use browser GPS for real testing. Use development location
                    when presenting on a laptop without GPS.
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

                  <button
                    type="button"
                    onClick={useDevelopmentLocation}
                    disabled={isGettingLocation}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Use Dev Lucena Location
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

          <div className="p-6 space-y-4 bg-slate-50/50 border-l-4 border-l-slate-400">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-200/80 inline-block px-2.5 py-1 rounded-md">
                2. Victim Profiling
              </h3>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-inner">
                  <span className="text-xs text-slate-500 font-bold px-2">
                    Total Count:
                  </span>

                  <input
                    type="number"
                    value={formData.victimCount}
                    onChange={(e) =>
                      syncVictimCount(
                        Math.max(0, parseInt(e.target.value) || 0),
                      )
                    }
                    min="0"
                    className="w-12 text-center text-sm font-bold bg-slate-50 rounded-lg py-1 text-blue-600 outline-none border border-transparent focus:border-slate-200"
                  />
                </div>

                <button
                  type="button"
                  onClick={addVictimRow}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-600 font-semibold text-xs rounded-xl shadow-sm transition-all"
                >
                  Add Victim
                </button>
              </div>
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
                operation.
              </div>
            )}
          </div>

          <div className="p-6 space-y-4 border-l-4 border-l-emerald-500">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 inline-block px-2.5 py-1 rounded-md">
              3. Operation Log
            </h3>

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

          <div className="p-4 bg-slate-50/80 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => navigate("/responder-dashboard")}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/10 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              {isLoading ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </main>

      <MobileNavBar />
    </div>
  );
};

export default CreateReport;
