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

// Calendar event table (enhanced with rich content fields)
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
  // Rich content fields for detailed instructions and planning
  instructions: text("instructions"), // Markdown-formatted step-by-step instructions
  materials: json("materials"), // Array of Material objects (name, quantity, checked)
  researchLinks: json("research_links"), // Array of ResearchLink objects
  notes: text("notes"), // Additional free-form notes
  imageUrls: json("image_urls"), // Array of image URLs attached to this event
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

// Notifications table for system alerts and reminders
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  eventId: integer("event_id").references(() => events.id),
  type: text("type").notNull(), // weather_alert, reminder, suggestion
  severity: text("severity").notNull(), // info, warning, critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  icon: text("icon"), // Emoji or icon name
  suggestedActions: json("suggested_actions"), // Array of QuickAction objects
  isRead: boolean("is_read").default(false).notNull(),
  dismissed: boolean("dismissed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Images table for photo storage and AI analysis
export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  eventId: integer("event_id").references(() => events.id),
  conversationId: integer("conversation_id").references(() => conversations.id),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  aiAnalysis: json("ai_analysis"), // GPT-4 Vision results
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull()
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
  instructions: true,
  materials: true,
  researchLinks: true,
  notes: true,
  imageUrls: true
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

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  eventId: true,
  type: true,
  severity: true,
  title: true,
  message: true,
  icon: true,
  suggestedActions: true
});

export const insertImageSchema = createInsertSchema(images).pick({
  userId: true,
  eventId: true,
  conversationId: true,
  filename: true,
  url: true,
  mimeType: true,
  fileSize: true,
  aiAnalysis: true
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

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;

// Material type for event materials checklist
export interface Material {
  name: string;
  quantity?: string;
  checked: boolean;
}

// Research link type for event research references
export interface ResearchLink {
  url: string;
  title?: string;
  description?: string;
}

// Quick action type for notification actions
export interface QuickAction {
  id: string;
  label: string;
  action: "reschedule" | "dismiss" | "view_event" | "view_forecast" | "custom";
  primary?: boolean;
  data?: any;
}

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
  humidity: number;
  precipitation: number;
  pressure?: number; // Air pressure
  visibility?: number; // Visibility in meters
  uv_index?: number; // UV index
  isCurrent?: boolean; // Flag to identify current day/time forecast
};
