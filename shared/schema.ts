import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
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
  pressure?: number; // Air pressure
  visibility?: number; // Visibility in meters
  uv_index?: number; // UV index
  isCurrent?: boolean; // Flag to identify current day/time forecast
};
