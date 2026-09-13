// Argument validation for assistant calendar/file/project tools and for the
// event update API route. Create and update are validated separately: an
// update accepts only supported partial fields, and dates are coerced to Date
// objects at this boundary. All schemas are strict so attempts to change
// ownership (userId) or internal IDs (id, eventId outside tools) are rejected
// with a validation error instead of being applied.
import { z } from "zod";

// A real date or a parseable date string. Explicitly NOT z.coerce.date():
// that coerces null to the epoch (new Date(null) is 1970-01-01), silently
// corrupting event dates. Null and unparseable input must be rejected.
const dateValue = z.union([
  z.date(),
  z.string().transform((s, ctx) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  }),
]);

// Nullable date for fields where null is meaningful (e.g. clearing a project
// end date). Null is tested FIRST so the coercing branch cannot turn it into
// the epoch.
const dateInput = z.union([z.null(), dateValue]);

export const recurringPatternInputSchema = z.object({
  frequency: z.enum(["day", "week", "month", "year"]),
  interval: z.number().int().min(1),
  endDate: z.union([z.null(), dateValue]).optional(),
}).strict();

// Supported partial event fields; strict rejects userId/id/createdAt.
// startDate/endDate are NOT NULL columns, so unlike project dates they cannot
// be set to null — only to a real date.
export const eventUpdateFieldsSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: dateValue.optional(),
  endDate: dateValue.optional(),
  allDay: z.boolean().nullable().optional(),
  location: z.string().nullable().optional(),
  checkWeather: z.boolean().nullable().optional(),
  isRecurring: z.boolean().nullable().optional(),
  recurringPattern: recurringPatternInputSchema.nullable().optional(),
  projectId: z.number().int().nullable().optional(),
}).strict();

export type EventUpdateFields = z.infer<typeof eventUpdateFieldsSchema>;

export const createEventToolSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: dateValue,
  endDate: dateValue,
  location: z.string().optional(),
  projectId: z.number().int().optional(),
  checkWeather: z.boolean().optional(),
  allDay: z.boolean().optional(),
  recurringPattern: recurringPatternInputSchema.optional(),
}).strict();

export const updateEventToolSchema = eventUpdateFieldsSchema.extend({
  eventId: z.number().int(),
}).strict();

export const deleteEventToolSchema = z.object({
  eventId: z.number().int(),
}).strict();

export const searchEventsToolSchema = z.object({
  keyword: z.string().optional(),
  startDate: dateValue.optional(),
  endDate: dateValue.optional(),
  projectId: z.number().int().optional(),
}).strict();

export const getOrCreateProjectToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
}).strict();

export const readUserFileToolSchema = z.object({
  fileId: z.number().int().optional(),
  filename: z.string().optional(),
}).strict().refine(
  args => args.fileId !== undefined || args.filename !== undefined,
  { message: "fileId or filename is required" }
);

export const listUserFilesToolSchema = z.object({
  fileType: z.string().optional(),
  projectId: z.number().int().optional(),
}).strict();

export const createUserDocumentToolSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  documentType: z.string().optional(),
  projectId: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export const listUserDocumentsToolSchema = z.object({
  documentType: z.string().optional(),
  projectId: z.number().int().optional(),
}).strict();

// Route-level update schema (PUT /api/events/:id) — partial fields only.
export const updateEventRouteSchema = eventUpdateFieldsSchema;

// Route-level update schemas for other owned records — strict, no userId/id.
export const updateProjectRouteSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  startDate: dateInput.optional(),
  endDate: dateInput.optional(),
  progress: z.number().int().nullable().optional(),
  color: z.string().nullable().optional(),
}).strict();

export const updateUserFileRouteSchema = z.object({
  description: z.string().nullable().optional(),
  projectId: z.number().int().nullable().optional(),
  metadata: z.unknown().optional(),
}).strict();

export const updateUserDocumentRouteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  documentType: z.string().optional(),
  projectId: z.number().int().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  isPublic: z.boolean().nullable().optional(),
}).strict();
