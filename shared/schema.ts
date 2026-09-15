import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Project table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  progress: integer("progress").default(0),
  color: text("color"), // Custom color code (hex, rgb, etc)
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Calendar event table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  allDay: boolean("all_day").default(false),
  location: text("location"),
  checkWeather: boolean("check_weather").default(false),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: json("recurring_pattern"),
  uid: text("uid"), // ICS UID, kept so repeat imports cannot create silent duplicates
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Weather caching table
export const weatherCache = pgTable("weather_cache", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  date: timestamp("date").notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Assistant conversation table
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  messages: json("messages").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// User files table for document management
export const userFiles = pgTable("user_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").references(() => projects.id), // Optional project association
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(), // User's original filename
  filePath: text("file_path").notNull(), // Server storage path
  fileType: text("file_type").notNull(), // csv, ics, pdf, txt, json, etc.
  mimeType: text("mime_type").notNull(), // application/csv, text/calendar, etc.
  fileSize: integer("file_size").notNull(), // Size in bytes
  metadata: json("metadata"), // Parsed data, analysis results, etc.
  description: text("description"), // User description of the file
  uploadDate: timestamp("upload_date").defaultNow().notNull(),
  lastAccessed: timestamp("last_accessed").defaultNow().notNull()
});

// User documents table for notes and plans
export const userDocuments = pgTable("user_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").references(() => projects.id), // Optional project association
  title: text("title").notNull(),
  content: text("content").notNull(), // Markdown/text content
  documentType: text("document_type").notNull().default("note"), // note, plan, report, analysis, etc.
  tags: json("tags"), // Array of tags for organization
  isPublic: boolean("is_public").default(false), // For sharing with other users
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Farm profile — at most one per user; every column except the name is
// optional so a farm can start empty and grow into the model
export const farms = pgTable("farms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id),
  name: text("name").notNull(),
  locationName: text("location_name"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  timeZone: text("time_zone"),
  growingZone: text("growing_zone"), // e.g. "Zone 8b"
  totalAcres: doublePrecision("total_acres"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Fields / growing areas
export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  acres: doublePrecision("acres"),
  soilType: text("soil_type"),
  currentCrop: text("current_crop"),
  status: text("status").notNull().default("active"), // active | fallow | retired
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Crop plantings (a crop in the ground or planned)
export const crops = pgTable("crops", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  fieldId: integer("field_id").references(() => fields.id),
  name: text("name").notNull(),
  variety: text("variety"),
  plantedAt: timestamp("planted_at"),
  expectedHarvestAt: timestamp("expected_harvest_at"),
  status: text("status").notNull().default("planning"), // planning | planted | growing | harvested | failed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Equipment inventory
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  category: text("category"), // tractor | implement | vehicle | irrigation | tool | other
  status: text("status").notNull().default("operational"), // operational | maintenance | down
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Buildings and infrastructure
export const buildings = pgTable("buildings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  category: text("category"), // barn | greenhouse | silo | shed | coop | other
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Staff / labor
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  role: text("role"),
  contact: text("contact"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Plans: a researched, approval-gated batch of events. planData holds the
// PlanPayload from shared/plans.ts (event specs with relative offsets and
// dependencies); concrete dates are computed at apply time.
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").references(() => projects.id),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  status: text("status").notNull().default("draft"), // draft | applied | dismissed
  planData: json("plan_data").notNull(),
  sources: json("sources"), // [{ title, url }] from research
  summary: text("summary"),
  startDate: timestamp("start_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at")
});

// Proposals: pre-made change sets from the proactive agent, awaiting approval
export const proposals = pgTable("proposals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  eventId: integer("event_id").references(() => events.id),
  type: text("type").notNull(), // weather_risk | conflict | info
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  evidence: json("evidence"), // forecast snapshot, overlapping events, etc.
  changeset: json("changeset"), // [{ eventId, updates: { startDate, endDate, ... } }]
  status: text("status").notNull().default("pending"), // pending | approved | declined | expired
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at")
});

// Notifications: inbox entries surfaced by the bell
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  proposalId: integer("proposal_id").references(() => proposals.id),
  type: text("type").notNull(), // proposal | applied | declined | info
  title: text("title").notNull(),
  body: text("body"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Schema validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  displayName: true,
  profileImage: true
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  userId: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
  progress: true,
  color: true
});

export const insertEventSchema = createInsertSchema(events).pick({
  userId: true,
  projectId: true,
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  allDay: true,
  location: true,
  checkWeather: true,
  isRecurring: true,
  recurringPattern: true,
  uid: true
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  messages: true
});

export const insertUserFileSchema = createInsertSchema(userFiles).pick({
  userId: true,
  projectId: true,
  filename: true,
  originalName: true,
  filePath: true,
  fileType: true,
  mimeType: true,
  fileSize: true,
  metadata: true,
  description: true
});

export const insertUserDocumentSchema = createInsertSchema(userDocuments).pick({
  userId: true,
  projectId: true,
  title: true,
  content: true,
  documentType: true,
  tags: true,
  isPublic: true
});

export const upsertFarmSchema = createInsertSchema(farms).pick({
  userId: true,
  name: true,
  locationName: true,
  latitude: true,
  longitude: true,
  timeZone: true,
  growingZone: true,
  totalAcres: true,
  notes: true
});

export const insertFieldSchema = createInsertSchema(fields).pick({
  userId: true,
  name: true,
  acres: true,
  soilType: true,
  currentCrop: true,
  status: true,
  notes: true
});

export const insertCropSchema = createInsertSchema(crops).pick({
  userId: true,
  fieldId: true,
  name: true,
  variety: true,
  plantedAt: true,
  expectedHarvestAt: true,
  status: true,
  notes: true
});

export const insertEquipmentSchema = createInsertSchema(equipment).pick({
  userId: true,
  name: true,
  category: true,
  status: true,
  notes: true
});

export const insertBuildingSchema = createInsertSchema(buildings).pick({
  userId: true,
  name: true,
  category: true,
  notes: true
});

export const insertStaffSchema = createInsertSchema(staff).pick({
  userId: true,
  name: true,
  role: true,
  contact: true,
  notes: true
});

export const insertPlanSchema = createInsertSchema(plans).pick({
  userId: true,
  projectId: true,
  title: true,
  goal: true,
  status: true,
  planData: true,
  sources: true,
  summary: true,
  startDate: true
});

export const insertProposalSchema = createInsertSchema(proposals).pick({
  userId: true,
  eventId: true,
  type: true,
  title: true,
  rationale: true,
  evidence: true,
  changeset: true,
  status: true
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  proposalId: true,
  type: true,
  title: true,
  body: true,
  read: true
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type UserFile = typeof userFiles.$inferSelect;
export type InsertUserFile = z.infer<typeof insertUserFileSchema>;

export type UserDocument = typeof userDocuments.$inferSelect;
export type InsertUserDocument = z.infer<typeof insertUserDocumentSchema>;

export type Farm = typeof farms.$inferSelect;
export type UpsertFarm = z.infer<typeof upsertFarmSchema>;

export type Field = typeof fields.$inferSelect;
export type InsertField = z.infer<typeof insertFieldSchema>;

export type Crop = typeof crops.$inferSelect;
export type InsertCrop = z.infer<typeof insertCropSchema>;

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

export type Building = typeof buildings.$inferSelect;
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;

export type StaffMember = typeof staff.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Weather forecast type
export type WeatherForecast = {
  date: string;
  dayOfWeek: string;
  temperature: number;
  temp_min: number; // Low temperature
  temp_max: number; // High temperature
  feels_like: number; // Feels like temperature
  weatherDescription: string;
  icon: string;
  wind: number;
  humidity: number | null; // null when the provider does not report it
  precipitation: number;
  precipitationProbability?: number; // 0-100, when the provider reports it
  pressure?: number; // Air pressure
  visibility?: number; // Visibility in meters
  uv_index?: number; // UV index
  isCurrent?: boolean; // Flag to identify current day/time forecast
};
