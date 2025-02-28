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
  progress: true
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
  recurringPattern: true
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  messages: true
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

// Weather forecast type
export type WeatherForecast = {
  date: string;
  dayOfWeek: string;
  temperature: number;
  weatherDescription: string;
  icon: string;
  wind: number;
  humidity: number;
  precipitation: number;
};
