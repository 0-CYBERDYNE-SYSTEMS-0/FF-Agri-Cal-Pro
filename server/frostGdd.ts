// Pure frost and growing-degree rules. Weather fetching and proposal
// persistence stay in the weather service and scheduler respectively.

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
