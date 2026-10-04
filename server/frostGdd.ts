// Pure frost and growing-degree rules. Weather fetching and proposal
// persistence stay in the weather service and scheduler respectively.
import type { ProposalDraft } from "./weatherWatch";

export interface FrostRiskEvent {
  title: string;
  description: string | null;
}

export interface FrostRiskForecastDay {
  date: string;
  tempMin: number;
  description: string;
}

export interface FrostRiskAssessment {
  reason: string;
  evidence: Record<string, unknown>;
  isSuitable: (day: { tempMin: number; precipitation: number }) => boolean;
}

export interface GddCrop {
  id: number;
  name: string;
  plantedAt: Date | null;
}

export interface GddWeatherDay {
  date: string;
  tempMin: number;
  tempMax: number;
}

export const DEFAULT_GDD_BASE_TEMP_F = 50;

export const FROST_TEMP_F = 32;
const PRECIP_SUITABLE_INCHES = 0.1;

export function assessFrostRisk(
  _event: FrostRiskEvent,
  day: FrostRiskForecastDay
): FrostRiskAssessment | null {
  if (day.tempMin > FROST_TEMP_F) return null;

  return {
    reason: `frost risk: overnight low of ${day.tempMin}°F forecast on the scheduled day`,
    evidence: { forecastDate: day.date, tempMinF: day.tempMin, description: day.description },
    isSuitable: candidate => candidate.tempMin > FROST_TEMP_F && candidate.precipitation < PRECIP_SUITABLE_INCHES,
  };
}

export function dailyGrowingDegreeDays(day: GddWeatherDay, baseTempF = DEFAULT_GDD_BASE_TEMP_F): number {
  return Math.max(0, (day.tempMin + day.tempMax) / 2 - baseTempF);
}

export function accumulateGrowingDegreeDays(days: GddWeatherDay[], baseTempF = DEFAULT_GDD_BASE_TEMP_F): number {
  return Number(days.reduce((total, day) => total + dailyGrowingDegreeDays(day, baseTempF), 0).toFixed(1));
}

export function evaluateCropGrowingDegreeDays(
  crop: GddCrop,
  days: GddWeatherDay[],
  baseTempF = DEFAULT_GDD_BASE_TEMP_F
): ProposalDraft | null {
  if (!crop.plantedAt) return null;

  const plantedDate = crop.plantedAt.toISOString().slice(0, 10);
  const relevantDays = days.filter(day => day.date >= plantedDate).sort((a, b) => a.date.localeCompare(b.date));
  if (relevantDays.length === 0) return null;

  const fromDate = relevantDays[0].date;
  const throughDate = relevantDays[relevantDays.length - 1].date;
  const accumulatedGdd = accumulateGrowingDegreeDays(relevantDays, baseTempF);

  return {
    eventId: null,
    type: "info",
    title: `Growing degree update — ${crop.name}`,
    rationale:
      `Open-Meteo daily temperatures estimate ${accumulatedGdd.toFixed(1)} growing degree days for ` +
      `${crop.name} from ${fromDate} through ${throughDate}, using a ${baseTempF}°F base. ` +
      "This is a planning estimate, not a crop maturity or harvest prediction.",
    evidence: {
      kind: "gdd",
      cropId: crop.id,
      baseTempF,
      accumulatedGdd,
      fromDate,
      throughDate,
      days: relevantDays.length,
      source: "Open-Meteo daily minimum and maximum temperatures",
    },
    changeset: [],
  };
}
