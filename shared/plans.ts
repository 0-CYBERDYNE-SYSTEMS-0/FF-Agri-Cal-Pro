// Plan payload contract shared by the server (draft generation, validation,
// apply) and the client (plan preview UI). A plan is a list of event specs
// whose dates are RELATIVE: each event sits `offsetDays` after the plan start
// date, or after the event it depends on. Concrete dates are computed at
// apply time, so the whole plan can be re-anchored by changing one start date.
import { z } from "zod";

export const planEventSpecSchema = z.object({
  title: z.string().min(1).max(200),
  // Markdown SOP: instructions, materials, rates, safety, contingencies
  description: z.string().max(20000).default(""),
  // Days after the anchor (plan start, or the dependency's date)
  offsetDays: z.number().int().min(0).max(3650),
  // Index of the event this event follows; null/omitted = anchored to plan start
  dependsOnIndex: z.number().int().min(0).nullable().optional(),
  durationHours: z.number().min(0.25).max(24).default(2),
  // Local time of day "HH:MM"; default "09:00"
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  location: z.string().max(200).nullable().optional(),
  checkWeather: z.boolean().default(true),
  recurring: z
    .object({
      frequency: z.enum(["day", "week", "month", "year"]),
      interval: z.number().int().min(1),
      endDate: z.string().nullable().optional(), // ISO date
    })
    .nullable()
    .optional(),
});

export const planSourceSchema = z.object({
  title: z.string().max(300).optional(),
  url: z.string().url().max(1000),
});

export const planPayloadSchema = z.object({
  events: z.array(planEventSpecSchema).min(1).max(100),
  sources: z.array(planSourceSchema).default([]),
  summary: z.string().max(20000).default(""),
});

export type PlanEventSpec = z.infer<typeof planEventSpecSchema>;
export type PlanSource = z.infer<typeof planSourceSchema>;
export type PlanPayload = z.infer<typeof planPayloadSchema>;

export interface ResolvedPlanEvent {
  index: number;
  spec: PlanEventSpec;
  startDate: Date;
  endDate: Date;
}

export class PlanResolutionError extends Error {}

function atTimeOfDay(day: Date, timeOfDay: string): Date {
  const [hours, minutes] = timeOfDay.split(":").map(part => Number.parseInt(part, 10));
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function addDays(day: Date, days: number): Date {
  const result = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Compute concrete start/end dates for every event in a plan.
 *
 * Dependency semantics: event i with dependsOnIndex = j (j < i, enforced)
 * starts offsetDays after event j's resolved start DAY. Events without a
 * dependency start offsetDays after the plan's anchor day.
 *
 * @param payload validated plan payload
 * @param anchorDay the day the plan starts (only the calendar day is used)
 */
export function resolvePlanEvents(payload: PlanPayload, anchorDay: Date): ResolvedPlanEvent[] {
  const resolved: ResolvedPlanEvent[] = [];

  for (let i = 0; i < payload.events.length; i++) {
    const spec = payload.events[i];
    const dependsOn = spec.dependsOnIndex ?? null;

    if (dependsOn !== null) {
      if (dependsOn >= i) {
        throw new PlanResolutionError(
          `Event ${i} ("${spec.title}") depends on event ${dependsOn}, which must come before it`
        );
      }
      if (dependsOn >= resolved.length) {
        throw new PlanResolutionError(`Event ${i} ("${spec.title}") has an invalid dependency index`);
      }
    }

    const anchor = dependsOn !== null ? resolved[dependsOn].startDate : anchorDay;
    const startDay = addDays(anchor, spec.offsetDays);
    const startDate = atTimeOfDay(startDay, spec.timeOfDay ?? "09:00");
    const endDate = new Date(startDate.getTime() + spec.durationHours * 60 * 60 * 1000);

    resolved.push({ index: i, spec, startDate, endDate });
  }

  return resolved;
}
