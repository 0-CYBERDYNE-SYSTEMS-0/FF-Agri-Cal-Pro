import { users, type User, type InsertUser, projects, type Project, type InsertProject, events, type Event, type InsertEvent, conversations, type Conversation, type InsertConversation, assistantActionApprovals, type AssistantActionApproval, type InsertAssistantActionApproval, userFiles, type UserFile, type InsertUserFile, userDocuments, type UserDocument, type InsertUserDocument, farms, type Farm, type UpsertFarm, fields, type Field, type InsertField, crops, type Crop, type InsertCrop, equipment, type Equipment, type InsertEquipment, buildings, type Building, type InsertBuilding, staff, type StaffMember, type InsertStaffMember, plans, type Plan, type InsertPlan, proposals, type Proposal, type InsertProposal, notifications, type Notification, type InsertNotification, weatherCache, WeatherForecast } from "@shared/schema";
import { getDb } from "../db";
import { eq, and, gte, lte, desc, gt, isNull, lte as lessThanOrEqual } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@shared/schema";
import * as bcrypt from "bcrypt";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Project methods
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByUser(userId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Event methods
  getEvent(id: number): Promise<Event | undefined>;
  getEventByUid(userId: number, uid: string): Promise<Event | undefined>;
  getEventsByUser(userId: number): Promise<Event[]>;
  getEventsByProject(projectId: number): Promise<Event[]>;
  getEventsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  createEvents(events: InsertEvent[]): Promise<Event[]>;
  updateEvent(id: number, event: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;

  // Conversation methods
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByUser(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, messages: any[]): Promise<Conversation | undefined>;
  createAssistantActionApproval(approval: InsertAssistantActionApproval): Promise<AssistantActionApproval>;
  getPendingAssistantActionApprovals(userId: number, conversationId: number, now: Date): Promise<AssistantActionApproval[]>;
  claimAssistantActionApproval(id: string, userId: number, conversationId: number, now: Date): Promise<AssistantActionApproval | undefined>;
  cancelAssistantActionApproval(id: string, userId: number, conversationId: number, now: Date): Promise<boolean>;

  // User file methods
  getUserFile(id: number): Promise<UserFile | undefined>;
  getUserFilesByUser(userId: number): Promise<UserFile[]>;
  getUserFilesByProject(projectId: number): Promise<UserFile[]>;
  getUserFilesByType(userId: number, fileType: string): Promise<UserFile[]>;
  createUserFile(file: InsertUserFile): Promise<UserFile>;
  updateUserFile(id: number, file: Partial<UserFile>): Promise<UserFile | undefined>;
  deleteUserFile(id: number): Promise<boolean>;

  // User document methods
  getUserDocument(id: number): Promise<UserDocument | undefined>;
  getUserDocumentsByUser(userId: number): Promise<UserDocument[]>;
  getUserDocumentsByProject(projectId: number): Promise<UserDocument[]>;
  getUserDocumentsByType(userId: number, documentType: string): Promise<UserDocument[]>;
  createUserDocument(document: InsertUserDocument): Promise<UserDocument>;
  updateUserDocument(id: number, document: Partial<UserDocument>): Promise<UserDocument | undefined>;
  deleteUserDocument(id: number): Promise<boolean>;

  // Farm profile (one per user)
  getFarmByUser(userId: number): Promise<Farm | undefined>;
  createFarm(farm: UpsertFarm): Promise<Farm>;
  updateFarm(id: number, farm: Partial<Farm>): Promise<Farm | undefined>;
  getAllFarmUserIds(): Promise<number[]>;

  // Field methods
  getField(id: number): Promise<Field | undefined>;
  getFieldsByUser(userId: number): Promise<Field[]>;
  createField(field: InsertField): Promise<Field>;
  updateField(id: number, field: Partial<Field>): Promise<Field | undefined>;
  deleteField(id: number): Promise<boolean>;

  // Crop methods
  getCrop(id: number): Promise<Crop | undefined>;
  getCropsByUser(userId: number): Promise<Crop[]>;
  createCrop(crop: InsertCrop): Promise<Crop>;
  updateCrop(id: number, crop: Partial<Crop>): Promise<Crop | undefined>;
  deleteCrop(id: number): Promise<boolean>;

  // Equipment methods
  getEquipment(id: number): Promise<Equipment | undefined>;
  getEquipmentByUser(userId: number): Promise<Equipment[]>;
  createEquipment(item: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, item: Partial<Equipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: number): Promise<boolean>;

  // Building methods
  getBuilding(id: number): Promise<Building | undefined>;
  getBuildingsByUser(userId: number): Promise<Building[]>;
  createBuilding(building: InsertBuilding): Promise<Building>;
  updateBuilding(id: number, building: Partial<Building>): Promise<Building | undefined>;
  deleteBuilding(id: number): Promise<boolean>;

  // Staff methods
  getStaffMember(id: number): Promise<StaffMember | undefined>;
  getStaffByUser(userId: number): Promise<StaffMember[]>;
  createStaffMember(member: InsertStaffMember): Promise<StaffMember>;
  updateStaffMember(id: number, member: Partial<StaffMember>): Promise<StaffMember | undefined>;
  deleteStaffMember(id: number): Promise<boolean>;

  // Plan methods (researched event batches, approval-gated)
  getPlan(id: number): Promise<Plan | undefined>;
  getPlansByUser(userId: number): Promise<Plan[]>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: number, plan: Partial<Plan>): Promise<Plan | undefined>;
  applyPlan(id: number, events: InsertEvent[], startDate: Date): Promise<{ plan: Plan; events: Event[] } | undefined>;

  // Proposal methods (agent change sets awaiting approval)
  getProposal(id: number): Promise<Proposal | undefined>;
  getProposalsByUser(userId: number): Promise<Proposal[]>;
  getPendingProposalsByUser(userId: number): Promise<Proposal[]>;
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  updateProposal(id: number, proposal: Partial<Proposal>): Promise<Proposal | undefined>;

  // Notification methods (inbox behind the bell)
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number, read: boolean): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: number): Promise<number>;

  // Weather cache persistence (observed/forecast history)
  upsertWeatherCache(location: string, date: Date, data: unknown): Promise<void>;

  // Storage interface intentionally doesn't include weather fetch functions
  // as weather data comes directly from the OpenWeatherAPI
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private events: Map<number, Event>;
  private conversations: Map<number, Conversation>;
  private assistantActionApprovals: Map<string, AssistantActionApproval>;
  private userFiles: Map<number, UserFile>;
  private userDocuments: Map<number, UserDocument>;
  private farms: Map<number, Farm>;
  private fields: Map<number, Field>;
  private crops: Map<number, Crop>;
  private equipment: Map<number, Equipment>;
  private buildings: Map<number, Building>;
  private staff: Map<number, StaffMember>;
  private plans: Map<number, Plan>;
  private proposals: Map<number, Proposal>;
  private notifications: Map<number, Notification>;
  private weatherCacheRows: Map<string, { id: number; location: string; date: Date; data: unknown; createdAt: Date }>;
  private currentUserId: number;
  private currentProjectId: number;
  private currentEventId: number;
  private currentConversationId: number;
  private currentUserFileId: number;
  private currentUserDocumentId: number;
  private currentFarmId: number;
  private currentFieldId: number;
  private currentCropId: number;
  private currentEquipmentId: number;
  private currentBuildingId: number;
  private currentStaffId: number;
  private currentPlanId: number;
  private currentProposalId: number;
  private currentNotificationId: number;
  private currentWeatherCacheId: number;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.events = new Map();
    this.conversations = new Map();
    this.assistantActionApprovals = new Map();
    this.userFiles = new Map();
    this.userDocuments = new Map();
    this.farms = new Map();
    this.fields = new Map();
    this.crops = new Map();
    this.equipment = new Map();
    this.buildings = new Map();
    this.staff = new Map();
    this.plans = new Map();
    this.proposals = new Map();
    this.notifications = new Map();
    this.weatherCacheRows = new Map();
    this.currentUserId = 1;
    this.currentProjectId = 1;
    this.currentEventId = 1;
    this.currentConversationId = 1;
    this.currentUserFileId = 1;
    this.currentUserDocumentId = 1;
    this.currentFarmId = 1;
    this.currentFieldId = 1;
    this.currentCropId = 1;
    this.currentEquipmentId = 1;
    this.currentBuildingId = 1;
    this.currentStaffId = 1;
    this.currentPlanId = 1;
    this.currentProposalId = 1;
    this.currentNotificationId = 1;
    this.currentWeatherCacheId = 1;

    // Initialize with sample data
    this.initSampleData().catch(error => {
      console.error("Error initializing sample data:", error);
    });
  }

  private async initSampleData() {
    // Create a sample user (password hashed for bcrypt compatibility)
    const hashedPassword = await bcrypt.hash("password123", 10);
    const sampleUser: InsertUser = {
      username: "demo",
      password: hashedPassword,
      email: "demo@example.com",
      displayName: "Sarah Johnson",
      profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    };
    const user = await this.createUser(sampleUser);

    // Create sample projects
    const projectsData: InsertProject[] = [
      {
        userId: user.id,
        name: "Summer Vegetable Garden",
        description: "Planning and managing summer vegetables",
        status: "active",
        startDate: new Date(2023, 3, 1), // April 1, 2023
        endDate: new Date(2023, 8, 30), // September 30, 2023
        progress: 45
      },
      {
        userId: user.id,
        name: "Crop Rotation Plan",
        description: "Multi-year crop rotation strategy",
        status: "planning",
        startDate: new Date(2023, 0, 1), // January 1, 2023
        endDate: new Date(2025, 11, 31), // December 31, 2025
        progress: 20
      },
      {
        userId: user.id,
        name: "Compost Management",
        description: "Ongoing compost pile maintenance",
        status: "ongoing",
        startDate: new Date(2023, 0, 1), // January 1, 2023
        endDate: new Date(2023, 11, 31), // December 31, 2023
        progress: 70
      },
      {
        userId: user.id,
        name: "Fruit Orchard Management",
        description: "Maintaining and harvesting fruit trees",
        status: "active",
        startDate: new Date(2023, 2, 1), // March 1, 2023
        endDate: new Date(2023, 10, 30), // November 30, 2023
        progress: 55
      },
      {
        userId: user.id,
        name: "Winter Cover Crops",
        description: "Planning and planting cover crops for soil health",
        status: "planning",
        startDate: new Date(2023, 8, 1), // September 1, 2023
        endDate: new Date(2024, 2, 28), // February 28, 2024
        progress: 10
      }
    ];

    const projects = [];
    for (const projectData of projectsData) {
      const project = await this.createProject(projectData);
      projects.push(project);
    }

    // Create sample events
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const eventsData: InsertEvent[] = [
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Soil Preparation",
        description: "Prepare soil for planting",
        startDate: new Date(currentYear, currentMonth, 12, 10, 0), // 10 AM
        endDate: new Date(currentYear, currentMonth, 12, 12, 0), // 12 PM
        allDay: false,
        location: "Main Garden",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Plant Tomatoes",
        description: "Plant tomato seedlings",
        startDate: new Date(currentYear, currentMonth, 13, 14, 0), // 2 PM
        endDate: new Date(currentYear, currentMonth, 13, 16, 0), // 4 PM
        allDay: false,
        location: "Vegetable Garden",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[2].id,
        title: "Check Compost",
        description: "Turn compost pile and check moisture",
        startDate: new Date(currentYear, currentMonth, 13, 9, 0), // 9 AM
        endDate: new Date(currentYear, currentMonth, 13, 10, 0), // 10 AM
        allDay: false,
        location: "Compost Area",
        checkWeather: false,
        isRecurring: true,
        recurringPattern: { frequency: "week", interval: 1, endDate: null }
      },
      {
        userId: user.id,
        projectId: projects[1].id,
        title: "Water Schedule",
        description: "Implement water schedule for crops",
        startDate: new Date(currentYear, currentMonth, 14, 8, 0), // 8 AM
        endDate: new Date(currentYear, currentMonth, 14, 9, 0), // 9 AM
        allDay: false,
        location: "Main Garden",
        checkWeather: true,
        isRecurring: true,
        recurringPattern: { frequency: "day", interval: 2, endDate: new Date(currentYear, currentMonth + 1, 14) }
      },
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Harvest Lettuce",
        description: "Harvest mature lettuce",
        startDate: new Date(currentYear, currentMonth, 18, 16, 0), // 4 PM
        endDate: new Date(currentYear, currentMonth, 18, 17, 0), // 5 PM
        allDay: false,
        location: "Vegetable Garden",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[1].id,
        title: "Crop Rotation Planning",
        description: "Plan crop rotation for next season",
        startDate: new Date(currentYear, currentMonth, 22, 10, 0), // 10 AM
        endDate: new Date(currentYear, currentMonth, 22, 15, 0), // 3 PM
        allDay: false,
        location: "Home Office",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[2].id,
        title: "Irrigation Check",
        description: "Check irrigation system",
        startDate: new Date(currentYear, currentMonth, 28, 9, 0), // 9 AM
        endDate: new Date(currentYear, currentMonth, 28, 11, 0), // 11 AM
        allDay: false,
        location: "All Gardens",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      
      // New events for development and testing
      // Current month events
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Apply Organic Fertilizer",
        description: "Apply compost tea to vegetable beds for nutrient boost",
        startDate: new Date(currentYear, currentMonth, 5, 8, 0), // 8 AM
        endDate: new Date(currentYear, currentMonth, 5, 10, 0), // 10 AM
        allDay: false,
        location: "Vegetable Garden",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Install Tomato Cages",
        description: "Install support structures for growing tomato plants",
        startDate: new Date(currentYear, currentMonth, 15, 9, 0), // 9 AM
        endDate: new Date(currentYear, currentMonth, 15, 11, 0), // 11 AM
        allDay: false,
        location: "Vegetable Garden",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Pest Monitoring",
        description: "Check plants for signs of pests and apply organic deterrents if needed",
        startDate: new Date(currentYear, currentMonth, 10, 16, 0), // 4 PM
        endDate: new Date(currentYear, currentMonth, 10, 17, 0), // 5 PM
        allDay: false,
        location: "All Gardens",
        checkWeather: false,
        isRecurring: true,
        recurringPattern: { frequency: "week", interval: 1, endDate: new Date(currentYear, currentMonth + 2, 10) }
      },
      {
        userId: user.id,
        projectId: projects[3].id,
        title: "Prune Fruit Trees",
        description: "Summer pruning of fruit trees to control growth and improve airflow",
        startDate: new Date(currentYear, currentMonth, 20, 10, 0), // 10 AM
        endDate: new Date(currentYear, currentMonth, 20, 14, 0), // 2 PM
        allDay: false,
        location: "Orchard",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[3].id,
        title: "Fruit Thinning",
        description: "Remove excess fruit to improve size and quality of remaining fruit",
        startDate: new Date(currentYear, currentMonth, 8, 9, 0), // 9 AM
        endDate: new Date(currentYear, currentMonth, 8, 12, 0), // 12 PM
        allDay: false,
        location: "Orchard",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[2].id,
        title: "Add New Materials to Compost",
        description: "Add fresh green and brown materials to compost pile",
        startDate: new Date(currentYear, currentMonth, 7, 14, 0), // 2 PM
        endDate: new Date(currentYear, currentMonth, 7, 15, 0), // 3 PM
        allDay: false,
        location: "Compost Area",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[4].id,
        title: "Cover Crop Research",
        description: "Research appropriate cover crops for local climate and soil needs",
        startDate: new Date(currentYear, currentMonth, 25, 13, 0), // 1 PM
        endDate: new Date(currentYear, currentMonth, 25, 16, 0), // 4 PM
        allDay: false,
        location: "Home Office",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[4].id,
        title: "Order Cover Crop Seeds",
        description: "Purchase selected cover crop seeds from supplier",
        startDate: new Date(currentYear, currentMonth, 30, 10, 0), // 10 AM
        endDate: new Date(currentYear, currentMonth, 30, 11, 0), // 11 AM
        allDay: false,
        location: "Home Office",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      },
      
      // Next month events
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Harvest Summer Vegetables",
        description: "Harvest peak season vegetables (tomatoes, peppers, zucchini)",
        startDate: new Date(currentYear, currentMonth + 1, 3, 8, 0), // 8 AM
        endDate: new Date(currentYear, currentMonth + 1, 3, 10, 0), // 10 AM
        allDay: false,
        location: "Vegetable Garden",
        checkWeather: true,
        isRecurring: true,
        recurringPattern: { frequency: "week", interval: 1, endDate: new Date(currentYear, currentMonth + 2, 30) }
      },
      {
        userId: user.id,
        projectId: projects[3].id,
        title: "Early Apple Harvest",
        description: "Harvest early ripening apple varieties",
        startDate: new Date(currentYear, currentMonth + 1, 15, 9, 0), // 9 AM
        endDate: new Date(currentYear, currentMonth + 1, 15, 12, 0), // 12 PM
        allDay: false,
        location: "Orchard",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[1].id,
        title: "Soil Testing",
        description: "Collect soil samples for testing before crop rotation planning",
        startDate: new Date(currentYear, currentMonth + 1, 10, 10, 0), // 10 AM
        endDate: new Date(currentYear, currentMonth + 1, 10, 12, 0), // 12 PM
        allDay: false,
        location: "All Gardens",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[0].id,
        title: "Plant Fall Crops",
        description: "Plant cold-tolerant vegetables for fall harvest",
        startDate: new Date(currentYear, currentMonth + 1, 20, 9, 0), // 9 AM
        endDate: new Date(currentYear, currentMonth + 1, 20, 13, 0), // 1 PM
        allDay: false,
        location: "Vegetable Garden",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[2].id,
        title: "Compost Temperature Check",
        description: "Monitor compost pile temperature for proper decomposition",
        startDate: new Date(currentYear, currentMonth + 1, 5, 9, 0), // 9 AM
        endDate: new Date(currentYear, currentMonth + 1, 5, 10, 0), // 10 AM
        allDay: false,
        location: "Compost Area",
        checkWeather: false,
        isRecurring: true,
        recurringPattern: { frequency: "week", interval: 1, endDate: null }
      },
      
      // Future events
      {
        userId: user.id,
        projectId: projects[4].id,
        title: "Plant Cover Crops",
        description: "Sow cover crops in cleared garden beds",
        startDate: new Date(currentYear, currentMonth + 2, 15, 8, 0), // 8 AM
        endDate: new Date(currentYear, currentMonth + 2, 15, 12, 0), // 12 PM
        allDay: false,
        location: "Main Garden",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[3].id,
        title: "Orchard Cleanup",
        description: "Remove fallen fruit and debris from orchard floor",
        startDate: new Date(currentYear, currentMonth + 2, 5, 14, 0), // 2 PM
        endDate: new Date(currentYear, currentMonth + 2, 5, 17, 0), // 5 PM
        allDay: false,
        location: "Orchard",
        checkWeather: true,
        isRecurring: false,
        recurringPattern: null
      },
      {
        userId: user.id,
        projectId: projects[1].id,
        title: "Finalize Crop Rotation Plan",
        description: "Complete comprehensive crop rotation plan based on soil test results",
        startDate: new Date(currentYear, currentMonth + 2, 20, 13, 0), // 1 PM
        endDate: new Date(currentYear, currentMonth + 2, 20, 17, 0), // 5 PM
        allDay: false,
        location: "Home Office",
        checkWeather: false,
        isRecurring: false,
        recurringPattern: null
      }
    ];

    for (const eventData of eventsData) {
      await this.createEvent(eventData);
    }

    // Initialize sample conversation
    const sampleConversation: InsertConversation = {
      userId: user.id,
      messages: [
        {
          role: "assistant",
          content: "Hello! I'm Farm Friend, your agricultural planning assistant. The current season is a great time for various farming activities. How can I help with your agricultural planning today?"
        },
        {
          role: "user",
          content: "What are some important seasonal tasks I should be planning for?"
        },
        {
          role: "assistant",
          content: "Great question about seasonal planning! To provide you with the most relevant recommendations, could you tell me your location? This will help me suggest activities based on your local climate and growing conditions."
        }
      ]
    };
    await this.createConversation(sampleConversation);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date(),
      profileImage: insertUser.profileImage || null
    };
    this.users.set(id, user);
    return user;
  }

  // Project methods
  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectsByUser(userId: number): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      (project) => project.userId === userId
    );
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const project: Project = { 
      ...insertProject, 
      id, 
      createdAt: new Date(),
      status: insertProject.status || "active",
      description: insertProject.description || null,
      startDate: insertProject.startDate || null,
      endDate: insertProject.endDate || null,
      progress: insertProject.progress || null,
      color: insertProject.color || null
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: number, projectData: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject = { ...project, ...projectData };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Event methods
  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventsByUser(userId: number): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      (event) => event.userId === userId
    );
  }

  async getEventsByProject(projectId: number): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      (event) => event.projectId === projectId
    );
  }

  async getEventsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      (event) => event.userId === userId && 
                 event.startDate >= startDate && 
                 event.startDate <= endDate
    );
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = this.currentEventId++;
    const event: Event = {
      ...insertEvent,
      id,
      createdAt: new Date(),
      description: insertEvent.description || null,
      projectId: insertEvent.projectId || null,
      allDay: insertEvent.allDay || null,
      location: insertEvent.location || null,
      checkWeather: insertEvent.checkWeather || null,
      isRecurring: insertEvent.isRecurring || null,
      recurringPattern: insertEvent.recurringPattern || null,
      uid: insertEvent.uid ?? null
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent = { ...event, ...eventData };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    return this.events.delete(id);
  }

  async createEvents(eventsToInsert: InsertEvent[]): Promise<Event[]> {
    const created: Event[] = [];
    for (const eventData of eventsToInsert) {
      created.push(await this.createEvent(eventData));
    }
    return created;
  }

  async getEventByUid(userId: number, uid: string): Promise<Event | undefined> {
    return Array.from(this.events.values()).find(
      (event) => event.userId === userId && event.uid === uid,
    );
  }

  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationsByUser(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conversation) => conversation.userId === userId
    );
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++;
    const conversation: Conversation = { 
      ...insertConversation, 
      id, 
      createdAt: new Date(),
      messages: insertConversation.messages || []
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: number, messages: any[]): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;

    const updatedConversation = { ...conversation, messages };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  async createAssistantActionApproval(approval: InsertAssistantActionApproval): Promise<AssistantActionApproval> {
    const record: AssistantActionApproval = { ...approval, claimedAt: null, createdAt: new Date() };
    this.assistantActionApprovals.set(record.id, record);
    return record;
  }

  async getPendingAssistantActionApprovals(userId: number, conversationId: number, now: Date): Promise<AssistantActionApproval[]> {
    for (const [id, approval] of Array.from(this.assistantActionApprovals.entries())) {
      if (approval.expiresAt <= now) this.assistantActionApprovals.delete(id);
    }
    return Array.from(this.assistantActionApprovals.values()).filter(approval =>
      approval.userId === userId && approval.conversationId === conversationId && !approval.claimedAt && approval.expiresAt > now
    );
  }

  async claimAssistantActionApproval(id: string, userId: number, conversationId: number, now: Date): Promise<AssistantActionApproval | undefined> {
    const approval = this.assistantActionApprovals.get(id);
    if (!approval || approval.userId !== userId || approval.conversationId !== conversationId || approval.claimedAt || approval.expiresAt <= now) {
      return undefined;
    }
    const claimed = { ...approval, claimedAt: now };
    this.assistantActionApprovals.set(id, claimed);
    return claimed;
  }

  async cancelAssistantActionApproval(id: string, userId: number, conversationId: number, now: Date): Promise<boolean> {
    return !!(await this.claimAssistantActionApproval(id, userId, conversationId, now));
  }

  // User file methods
  async getUserFile(id: number): Promise<UserFile | undefined> {
    return this.userFiles.get(id);
  }

  async getUserFilesByUser(userId: number): Promise<UserFile[]> {
    return Array.from(this.userFiles.values()).filter(
      (file) => file.userId === userId
    );
  }

  async getUserFilesByProject(projectId: number): Promise<UserFile[]> {
    return Array.from(this.userFiles.values()).filter(
      (file) => file.projectId === projectId
    );
  }

  async getUserFilesByType(userId: number, fileType: string): Promise<UserFile[]> {
    return Array.from(this.userFiles.values()).filter(
      (file) => file.userId === userId && file.fileType === fileType
    );
  }

  async createUserFile(insertFile: InsertUserFile): Promise<UserFile> {
    const id = this.currentUserFileId++;
    const file: UserFile = { 
      ...insertFile, 
      id, 
      uploadDate: new Date(),
      lastAccessed: new Date(),
      projectId: insertFile.projectId || null,
      metadata: insertFile.metadata || null,
      description: insertFile.description || null
    };
    this.userFiles.set(id, file);
    return file;
  }

  async updateUserFile(id: number, fileData: Partial<UserFile>): Promise<UserFile | undefined> {
    const file = this.userFiles.get(id);
    if (!file) return undefined;

    const updatedFile = { ...file, ...fileData, lastAccessed: new Date() };
    this.userFiles.set(id, updatedFile);
    return updatedFile;
  }

  async deleteUserFile(id: number): Promise<boolean> {
    return this.userFiles.delete(id);
  }

  // User document methods
  async getUserDocument(id: number): Promise<UserDocument | undefined> {
    return this.userDocuments.get(id);
  }

  async getUserDocumentsByUser(userId: number): Promise<UserDocument[]> {
    return Array.from(this.userDocuments.values()).filter(
      (doc) => doc.userId === userId
    );
  }

  async getUserDocumentsByProject(projectId: number): Promise<UserDocument[]> {
    return Array.from(this.userDocuments.values()).filter(
      (doc) => doc.projectId === projectId
    );
  }

  async getUserDocumentsByType(userId: number, documentType: string): Promise<UserDocument[]> {
    return Array.from(this.userDocuments.values()).filter(
      (doc) => doc.userId === userId && doc.documentType === documentType
    );
  }

  async createUserDocument(insertDocument: InsertUserDocument): Promise<UserDocument> {
    const id = this.currentUserDocumentId++;
    const document: UserDocument = { 
      ...insertDocument, 
      id, 
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: insertDocument.projectId || null,
      documentType: insertDocument.documentType || "note",
      tags: insertDocument.tags || null,
      isPublic: insertDocument.isPublic || null
    };
    this.userDocuments.set(id, document);
    return document;
  }

  async updateUserDocument(id: number, documentData: Partial<UserDocument>): Promise<UserDocument | undefined> {
    const document = this.userDocuments.get(id);
    if (!document) return undefined;

    const updatedDocument = { ...document, ...documentData, updatedAt: new Date() };
    this.userDocuments.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteUserDocument(id: number): Promise<boolean> {
    return this.userDocuments.delete(id);
  }

  // Farm profile methods
  async getFarmByUser(userId: number): Promise<Farm | undefined> {
    return Array.from(this.farms.values()).find(farm => farm.userId === userId);
  }

  async createFarm(insertFarm: UpsertFarm): Promise<Farm> {
    const id = this.currentFarmId++;
    const now = new Date();
    const farm: Farm = {
      ...insertFarm,
      id,
      createdAt: now,
      updatedAt: now,
      locationName: insertFarm.locationName ?? null,
      latitude: insertFarm.latitude ?? null,
      longitude: insertFarm.longitude ?? null,
      timeZone: insertFarm.timeZone ?? null,
      growingZone: insertFarm.growingZone ?? null,
      totalAcres: insertFarm.totalAcres ?? null,
      notes: insertFarm.notes ?? null,
    };
    this.farms.set(id, farm);
    return farm;
  }

  async updateFarm(id: number, farmData: Partial<Farm>): Promise<Farm | undefined> {
    const farm = this.farms.get(id);
    if (!farm) return undefined;
    const updated = { ...farm, ...farmData, updatedAt: new Date() };
    this.farms.set(id, updated);
    return updated;
  }

  async getAllFarmUserIds(): Promise<number[]> {
    return Array.from(this.farms.values()).map(farm => farm.userId);
  }

  // Field methods
  async getField(id: number): Promise<Field | undefined> {
    return this.fields.get(id);
  }

  async getFieldsByUser(userId: number): Promise<Field[]> {
    return Array.from(this.fields.values()).filter(field => field.userId === userId);
  }

  async createField(insertField: InsertField): Promise<Field> {
    const id = this.currentFieldId++;
    const field: Field = {
      ...insertField,
      id,
      createdAt: new Date(),
      acres: insertField.acres ?? null,
      soilType: insertField.soilType ?? null,
      currentCrop: insertField.currentCrop ?? null,
      status: insertField.status || "active",
      notes: insertField.notes ?? null,
    };
    this.fields.set(id, field);
    return field;
  }

  async updateField(id: number, fieldData: Partial<Field>): Promise<Field | undefined> {
    const field = this.fields.get(id);
    if (!field) return undefined;
    const updated = { ...field, ...fieldData };
    this.fields.set(id, updated);
    return updated;
  }

  async deleteField(id: number): Promise<boolean> {
    return this.fields.delete(id);
  }

  // Crop methods
  async getCrop(id: number): Promise<Crop | undefined> {
    return this.crops.get(id);
  }

  async getCropsByUser(userId: number): Promise<Crop[]> {
    return Array.from(this.crops.values()).filter(crop => crop.userId === userId);
  }

  async createCrop(insertCrop: InsertCrop): Promise<Crop> {
    const id = this.currentCropId++;
    const crop: Crop = {
      ...insertCrop,
      id,
      createdAt: new Date(),
      fieldId: insertCrop.fieldId ?? null,
      variety: insertCrop.variety ?? null,
      plantedAt: insertCrop.plantedAt ?? null,
      expectedHarvestAt: insertCrop.expectedHarvestAt ?? null,
      status: insertCrop.status || "planning",
      notes: insertCrop.notes ?? null,
    };
    this.crops.set(id, crop);
    return crop;
  }

  async updateCrop(id: number, cropData: Partial<Crop>): Promise<Crop | undefined> {
    const crop = this.crops.get(id);
    if (!crop) return undefined;
    const updated = { ...crop, ...cropData };
    this.crops.set(id, updated);
    return updated;
  }

  async deleteCrop(id: number): Promise<boolean> {
    return this.crops.delete(id);
  }

  // Equipment methods
  async getEquipment(id: number): Promise<Equipment | undefined> {
    return this.equipment.get(id);
  }

  async getEquipmentByUser(userId: number): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(item => item.userId === userId);
  }

  async createEquipment(insertEquipment: InsertEquipment): Promise<Equipment> {
    const id = this.currentEquipmentId++;
    const item: Equipment = {
      ...insertEquipment,
      id,
      createdAt: new Date(),
      category: insertEquipment.category ?? null,
      status: insertEquipment.status || "operational",
      notes: insertEquipment.notes ?? null,
    };
    this.equipment.set(id, item);
    return item;
  }

  async updateEquipment(id: number, equipmentData: Partial<Equipment>): Promise<Equipment | undefined> {
    const item = this.equipment.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...equipmentData };
    this.equipment.set(id, updated);
    return updated;
  }

  async deleteEquipment(id: number): Promise<boolean> {
    return this.equipment.delete(id);
  }

  // Building methods
  async getBuilding(id: number): Promise<Building | undefined> {
    return this.buildings.get(id);
  }

  async getBuildingsByUser(userId: number): Promise<Building[]> {
    return Array.from(this.buildings.values()).filter(building => building.userId === userId);
  }

  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const id = this.currentBuildingId++;
    const building: Building = {
      ...insertBuilding,
      id,
      createdAt: new Date(),
      category: insertBuilding.category ?? null,
      notes: insertBuilding.notes ?? null,
    };
    this.buildings.set(id, building);
    return building;
  }

  async updateBuilding(id: number, buildingData: Partial<Building>): Promise<Building | undefined> {
    const building = this.buildings.get(id);
    if (!building) return undefined;
    const updated = { ...building, ...buildingData };
    this.buildings.set(id, updated);
    return updated;
  }

  async deleteBuilding(id: number): Promise<boolean> {
    return this.buildings.delete(id);
  }

  // Staff methods
  async getStaffMember(id: number): Promise<StaffMember | undefined> {
    return this.staff.get(id);
  }

  async getStaffByUser(userId: number): Promise<StaffMember[]> {
    return Array.from(this.staff.values()).filter(member => member.userId === userId);
  }

  async createStaffMember(insertStaff: InsertStaffMember): Promise<StaffMember> {
    const id = this.currentStaffId++;
    const member: StaffMember = {
      ...insertStaff,
      id,
      createdAt: new Date(),
      role: insertStaff.role ?? null,
      contact: insertStaff.contact ?? null,
      notes: insertStaff.notes ?? null,
    };
    this.staff.set(id, member);
    return member;
  }

  async updateStaffMember(id: number, staffData: Partial<StaffMember>): Promise<StaffMember | undefined> {
    const member = this.staff.get(id);
    if (!member) return undefined;
    const updated = { ...member, ...staffData };
    this.staff.set(id, updated);
    return updated;
  }

  async deleteStaffMember(id: number): Promise<boolean> {
    return this.staff.delete(id);
  }

  // Plan methods
  async getPlan(id: number): Promise<Plan | undefined> {
    return this.plans.get(id);
  }

  async getPlansByUser(userId: number): Promise<Plan[]> {
    return Array.from(this.plans.values())
      .filter(plan => plan.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createPlan(insertPlan: InsertPlan): Promise<Plan> {
    const id = this.currentPlanId++;
    const plan: Plan = {
      ...insertPlan,
      id,
      createdAt: new Date(),
      status: insertPlan.status || "draft",
      projectId: insertPlan.projectId ?? null,
      sources: insertPlan.sources ?? null,
      summary: insertPlan.summary ?? null,
      startDate: insertPlan.startDate ?? null,
      appliedAt: null,
    };
    this.plans.set(id, plan);
    return plan;
  }

  async updatePlan(id: number, planData: Partial<Plan>): Promise<Plan | undefined> {
    const plan = this.plans.get(id);
    if (!plan) return undefined;
    const updated = { ...plan, ...planData };
    this.plans.set(id, updated);
    return updated;
  }

  async applyPlan(id: number, eventsToInsert: InsertEvent[], startDate: Date): Promise<{ plan: Plan; events: Event[] } | undefined> {
    const plan = this.plans.get(id);
    if (!plan || plan.status !== "draft") return undefined;

    // Claim synchronously before creating events so overlapping requests cannot
    // both apply the same plan in the in-memory test/demo backend.
    const appliedPlan = { ...plan, status: "applied", appliedAt: new Date(), startDate };
    this.plans.set(id, appliedPlan);
    const firstEventId = this.currentEventId;
    const createdEvents: Event[] = [];
    try {
      for (const insertEvent of eventsToInsert) {
        const eventId = this.currentEventId++;
        const event: Event = {
          ...insertEvent,
          id: eventId,
          createdAt: new Date(),
          description: insertEvent.description || null,
          projectId: insertEvent.projectId || null,
          allDay: insertEvent.allDay || null,
          location: insertEvent.location || null,
          checkWeather: insertEvent.checkWeather || null,
          isRecurring: insertEvent.isRecurring || null,
          recurringPattern: insertEvent.recurringPattern || null,
          uid: insertEvent.uid ?? null,
        };
        this.events.set(eventId, event);
        createdEvents.push(event);
      }
      return { plan: appliedPlan, events: createdEvents };
    } catch (error) {
      for (const event of createdEvents) this.events.delete(event.id);
      this.currentEventId = firstEventId;
      this.plans.set(id, plan);
      throw error;
    }
  }

  // Proposal methods
  async getProposal(id: number): Promise<Proposal | undefined> {
    return this.proposals.get(id);
  }

  async getProposalsByUser(userId: number): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter(proposal => proposal.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPendingProposalsByUser(userId: number): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter(proposal => proposal.userId === userId && proposal.status === "pending")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createProposal(insertProposal: InsertProposal): Promise<Proposal> {
    const id = this.currentProposalId++;
    const proposal: Proposal = {
      ...insertProposal,
      id,
      createdAt: new Date(),
      eventId: insertProposal.eventId ?? null,
      evidence: insertProposal.evidence ?? null,
      changeset: insertProposal.changeset ?? null,
      status: insertProposal.status || "pending",
      decidedAt: null,
    };
    this.proposals.set(id, proposal);
    return proposal;
  }

  async updateProposal(id: number, proposalData: Partial<Proposal>): Promise<Proposal | undefined> {
    const proposal = this.proposals.get(id);
    if (!proposal) return undefined;
    const updated = { ...proposal, ...proposalData };
    this.proposals.set(id, updated);
    return updated;
  }

  // Notification methods
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.currentNotificationId++;
    const notification: Notification = {
      ...insertNotification,
      id,
      createdAt: new Date(),
      proposalId: insertNotification.proposalId ?? null,
      body: insertNotification.body ?? null,
      read: insertNotification.read ?? false,
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationRead(id: number, read: boolean): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    const updated = { ...notification, read };
    this.notifications.set(id, updated);
    return updated;
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    let count = 0;
    for (const notification of Array.from(this.notifications.values())) {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        count++;
      }
    }
    return count;
  }

  // Weather cache persistence
  async upsertWeatherCache(location: string, date: Date, data: unknown): Promise<void> {
    const key = `${location}|${date.toISOString().slice(0, 10)}`;
    this.weatherCacheRows.set(key, {
      id: this.weatherCacheRows.has(key) ? this.weatherCacheRows.get(key)!.id : this.currentWeatherCacheId++,
      location,
      date,
      data,
      createdAt: new Date(),
    });
  }

  // Weather functionality removed in favor of OpenWeather API
}

// PostgreSQL storage backed by Drizzle over node-postgres, using the existing
// schema in shared/schema.ts.
export class DbStorage implements IStorage {
  private db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const rows = await this.db.insert(users).values(user).returning();
    return rows[0];
  }

  // Project methods
  async getProject(id: number): Promise<Project | undefined> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return rows[0];
  }

  async getProjectsByUser(userId: number): Promise<Project[]> {
    return this.db.select().from(projects).where(eq(projects.userId, userId));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const rows = await this.db.insert(projects).values(project).returning();
    return rows[0];
  }

  async updateProject(id: number, projectData: Partial<Project>): Promise<Project | undefined> {
    const rows = await this.db.update(projects).set(projectData).where(eq(projects.id, id)).returning();
    return rows[0];
  }

  async deleteProject(id: number): Promise<boolean> {
    const rows = await this.db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
    return rows.length > 0;
  }

  // Event methods
  async getEvent(id: number): Promise<Event | undefined> {
    const rows = await this.db.select().from(events).where(eq(events.id, id)).limit(1);
    return rows[0];
  }

  async getEventByUid(userId: number, uid: string): Promise<Event | undefined> {
    const rows = await this.db
      .select()
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.uid, uid)))
      .limit(1);
    return rows[0];
  }

  async getEventsByUser(userId: number): Promise<Event[]> {
    return this.db.select().from(events).where(eq(events.userId, userId));
  }

  async getEventsByProject(projectId: number): Promise<Event[]> {
    return this.db.select().from(events).where(eq(events.projectId, projectId));
  }

  async getEventsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Event[]> {
    return this.db
      .select()
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          gte(events.startDate, startDate),
          lte(events.startDate, endDate)
        )
      );
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const rows = await this.db.insert(events).values(event).returning();
    return rows[0];
  }

  async createEvents(eventsToInsert: InsertEvent[]): Promise<Event[]> {
    if (eventsToInsert.length === 0) return [];
    return this.db.transaction(async (tx) => {
      const created: Event[] = [];
      for (const eventData of eventsToInsert) {
        const rows = await tx.insert(events).values(eventData).returning();
        created.push(rows[0]);
      }
      return created;
    });
  }

  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const rows = await this.db.update(events).set(eventData).where(eq(events.id, id)).returning();
    return rows[0];
  }

  async deleteEvent(id: number): Promise<boolean> {
    const rows = await this.db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
    return rows.length > 0;
  }

  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    const rows = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return rows[0];
  }

  async getConversationsByUser(userId: number): Promise<Conversation[]> {
    return this.db.select().from(conversations).where(eq(conversations.userId, userId));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const rows = await this.db.insert(conversations).values(conversation).returning();
    return rows[0];
  }

  async updateConversation(id: number, messages: any[]): Promise<Conversation | undefined> {
    const rows = await this.db.update(conversations).set({ messages }).where(eq(conversations.id, id)).returning();
    return rows[0];
  }

  async createAssistantActionApproval(approval: InsertAssistantActionApproval): Promise<AssistantActionApproval> {
    const rows = await this.db.insert(assistantActionApprovals).values(approval).returning();
    return rows[0];
  }

  async getPendingAssistantActionApprovals(userId: number, conversationId: number, now: Date): Promise<AssistantActionApproval[]> {
    await this.db.delete(assistantActionApprovals).where(lessThanOrEqual(assistantActionApprovals.expiresAt, now));
    return this.db.select().from(assistantActionApprovals).where(and(
      eq(assistantActionApprovals.userId, userId),
      eq(assistantActionApprovals.conversationId, conversationId),
      isNull(assistantActionApprovals.claimedAt),
      gt(assistantActionApprovals.expiresAt, now),
    ));
  }

  async claimAssistantActionApproval(id: string, userId: number, conversationId: number, now: Date): Promise<AssistantActionApproval | undefined> {
    const rows = await this.db.update(assistantActionApprovals)
      .set({ claimedAt: now })
      .where(and(
        eq(assistantActionApprovals.id, id),
        eq(assistantActionApprovals.userId, userId),
        eq(assistantActionApprovals.conversationId, conversationId),
        isNull(assistantActionApprovals.claimedAt),
        gt(assistantActionApprovals.expiresAt, now),
      ))
      .returning();
    return rows[0];
  }

  async cancelAssistantActionApproval(id: string, userId: number, conversationId: number, now: Date): Promise<boolean> {
    const claimed = await this.claimAssistantActionApproval(id, userId, conversationId, now);
    return !!claimed;
  }

  // User file methods
  async getUserFile(id: number): Promise<UserFile | undefined> {
    const rows = await this.db.select().from(userFiles).where(eq(userFiles.id, id)).limit(1);
    return rows[0];
  }

  async getUserFilesByUser(userId: number): Promise<UserFile[]> {
    return this.db.select().from(userFiles).where(eq(userFiles.userId, userId));
  }

  async getUserFilesByProject(projectId: number): Promise<UserFile[]> {
    return this.db.select().from(userFiles).where(eq(userFiles.projectId, projectId));
  }

  async getUserFilesByType(userId: number, fileType: string): Promise<UserFile[]> {
    return this.db
      .select()
      .from(userFiles)
      .where(and(eq(userFiles.userId, userId), eq(userFiles.fileType, fileType)));
  }

  async createUserFile(file: InsertUserFile): Promise<UserFile> {
    const rows = await this.db.insert(userFiles).values(file).returning();
    return rows[0];
  }

  async updateUserFile(id: number, fileData: Partial<UserFile>): Promise<UserFile | undefined> {
    const rows = await this.db
      .update(userFiles)
      .set({ ...fileData, lastAccessed: new Date() })
      .where(eq(userFiles.id, id))
      .returning();
    return rows[0];
  }

  async deleteUserFile(id: number): Promise<boolean> {
    const rows = await this.db.delete(userFiles).where(eq(userFiles.id, id)).returning({ id: userFiles.id });
    return rows.length > 0;
  }

  // User document methods
  async getUserDocument(id: number): Promise<UserDocument | undefined> {
    const rows = await this.db.select().from(userDocuments).where(eq(userDocuments.id, id)).limit(1);
    return rows[0];
  }

  async getUserDocumentsByUser(userId: number): Promise<UserDocument[]> {
    return this.db.select().from(userDocuments).where(eq(userDocuments.userId, userId));
  }

  async getUserDocumentsByProject(projectId: number): Promise<UserDocument[]> {
    return this.db.select().from(userDocuments).where(eq(userDocuments.projectId, projectId));
  }

  async getUserDocumentsByType(userId: number, documentType: string): Promise<UserDocument[]> {
    return this.db
      .select()
      .from(userDocuments)
      .where(and(eq(userDocuments.userId, userId), eq(userDocuments.documentType, documentType)));
  }

  async createUserDocument(document: InsertUserDocument): Promise<UserDocument> {
    const rows = await this.db.insert(userDocuments).values(document).returning();
    return rows[0];
  }

  async updateUserDocument(id: number, documentData: Partial<UserDocument>): Promise<UserDocument | undefined> {
    const rows = await this.db
      .update(userDocuments)
      .set({ ...documentData, updatedAt: new Date() })
      .where(eq(userDocuments.id, id))
      .returning();
    return rows[0];
  }

  async deleteUserDocument(id: number): Promise<boolean> {
    const rows = await this.db.delete(userDocuments).where(eq(userDocuments.id, id)).returning({ id: userDocuments.id });
    return rows.length > 0;
  }

  // Farm profile methods
  async getFarmByUser(userId: number): Promise<Farm | undefined> {
    const rows = await this.db.select().from(farms).where(eq(farms.userId, userId)).limit(1);
    return rows[0];
  }

  async createFarm(farm: UpsertFarm): Promise<Farm> {
    const rows = await this.db.insert(farms).values(farm).returning();
    return rows[0];
  }

  async updateFarm(id: number, farmData: Partial<Farm>): Promise<Farm | undefined> {
    const rows = await this.db.update(farms).set({ ...farmData, updatedAt: new Date() }).where(eq(farms.id, id)).returning();
    return rows[0];
  }

  async getAllFarmUserIds(): Promise<number[]> {
    const rows = await this.db.select({ userId: farms.userId }).from(farms);
    return rows.map(row => row.userId);
  }

  // Field methods
  async getField(id: number): Promise<Field | undefined> {
    const rows = await this.db.select().from(fields).where(eq(fields.id, id)).limit(1);
    return rows[0];
  }

  async getFieldsByUser(userId: number): Promise<Field[]> {
    return this.db.select().from(fields).where(eq(fields.userId, userId));
  }

  async createField(field: InsertField): Promise<Field> {
    const rows = await this.db.insert(fields).values(field).returning();
    return rows[0];
  }

  async updateField(id: number, fieldData: Partial<Field>): Promise<Field | undefined> {
    const rows = await this.db.update(fields).set(fieldData).where(eq(fields.id, id)).returning();
    return rows[0];
  }

  async deleteField(id: number): Promise<boolean> {
    const rows = await this.db.delete(fields).where(eq(fields.id, id)).returning({ id: fields.id });
    return rows.length > 0;
  }

  // Crop methods
  async getCrop(id: number): Promise<Crop | undefined> {
    const rows = await this.db.select().from(crops).where(eq(crops.id, id)).limit(1);
    return rows[0];
  }

  async getCropsByUser(userId: number): Promise<Crop[]> {
    return this.db.select().from(crops).where(eq(crops.userId, userId));
  }

  async createCrop(crop: InsertCrop): Promise<Crop> {
    const rows = await this.db.insert(crops).values(crop).returning();
    return rows[0];
  }

  async updateCrop(id: number, cropData: Partial<Crop>): Promise<Crop | undefined> {
    const rows = await this.db.update(crops).set(cropData).where(eq(crops.id, id)).returning();
    return rows[0];
  }

  async deleteCrop(id: number): Promise<boolean> {
    const rows = await this.db.delete(crops).where(eq(crops.id, id)).returning({ id: crops.id });
    return rows.length > 0;
  }

  // Equipment methods
  async getEquipment(id: number): Promise<Equipment | undefined> {
    const rows = await this.db.select().from(equipment).where(eq(equipment.id, id)).limit(1);
    return rows[0];
  }

  async getEquipmentByUser(userId: number): Promise<Equipment[]> {
    return this.db.select().from(equipment).where(eq(equipment.userId, userId));
  }

  async createEquipment(item: InsertEquipment): Promise<Equipment> {
    const rows = await this.db.insert(equipment).values(item).returning();
    return rows[0];
  }

  async updateEquipment(id: number, equipmentData: Partial<Equipment>): Promise<Equipment | undefined> {
    const rows = await this.db.update(equipment).set(equipmentData).where(eq(equipment.id, id)).returning();
    return rows[0];
  }

  async deleteEquipment(id: number): Promise<boolean> {
    const rows = await this.db.delete(equipment).where(eq(equipment.id, id)).returning({ id: equipment.id });
    return rows.length > 0;
  }

  // Building methods
  async getBuilding(id: number): Promise<Building | undefined> {
    const rows = await this.db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
    return rows[0];
  }

  async getBuildingsByUser(userId: number): Promise<Building[]> {
    return this.db.select().from(buildings).where(eq(buildings.userId, userId));
  }

  async createBuilding(building: InsertBuilding): Promise<Building> {
    const rows = await this.db.insert(buildings).values(building).returning();
    return rows[0];
  }

  async updateBuilding(id: number, buildingData: Partial<Building>): Promise<Building | undefined> {
    const rows = await this.db.update(buildings).set(buildingData).where(eq(buildings.id, id)).returning();
    return rows[0];
  }

  async deleteBuilding(id: number): Promise<boolean> {
    const rows = await this.db.delete(buildings).where(eq(buildings.id, id)).returning({ id: buildings.id });
    return rows.length > 0;
  }

  // Staff methods
  async getStaffMember(id: number): Promise<StaffMember | undefined> {
    const rows = await this.db.select().from(staff).where(eq(staff.id, id)).limit(1);
    return rows[0];
  }

  async getStaffByUser(userId: number): Promise<StaffMember[]> {
    return this.db.select().from(staff).where(eq(staff.userId, userId));
  }

  async createStaffMember(member: InsertStaffMember): Promise<StaffMember> {
    const rows = await this.db.insert(staff).values(member).returning();
    return rows[0];
  }

  async updateStaffMember(id: number, staffData: Partial<StaffMember>): Promise<StaffMember | undefined> {
    const rows = await this.db.update(staff).set(staffData).where(eq(staff.id, id)).returning();
    return rows[0];
  }

  async deleteStaffMember(id: number): Promise<boolean> {
    const rows = await this.db.delete(staff).where(eq(staff.id, id)).returning({ id: staff.id });
    return rows.length > 0;
  }

  // Plan methods
  async getPlan(id: number): Promise<Plan | undefined> {
    const rows = await this.db.select().from(plans).where(eq(plans.id, id)).limit(1);
    return rows[0];
  }

  async getPlansByUser(userId: number): Promise<Plan[]> {
    return this.db.select().from(plans).where(eq(plans.userId, userId)).orderBy(desc(plans.createdAt));
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    const rows = await this.db.insert(plans).values(plan).returning();
    return rows[0];
  }

  async updatePlan(id: number, planData: Partial<Plan>): Promise<Plan | undefined> {
    const rows = await this.db.update(plans).set(planData).where(eq(plans.id, id)).returning();
    return rows[0];
  }

  async applyPlan(id: number, eventsToInsert: InsertEvent[], startDate: Date): Promise<{ plan: Plan; events: Event[] } | undefined> {
    return this.db.transaction(async (tx) => {
      // The conditional update is the atomic claim. Concurrent requests that
      // lose the draft -> applied transition receive no row and create no events.
      const claimed = await tx.update(plans)
        .set({ status: "applied", appliedAt: new Date(), startDate })
        .where(and(eq(plans.id, id), eq(plans.status, "draft")))
        .returning();
      if (claimed.length === 0) return undefined;

      const createdEvents: Event[] = [];
      for (const eventData of eventsToInsert) {
        const rows = await tx.insert(events).values(eventData).returning();
        createdEvents.push(rows[0]);
      }
      return { plan: claimed[0], events: createdEvents };
    });
  }

  // Proposal methods
  async getProposal(id: number): Promise<Proposal | undefined> {
    const rows = await this.db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
    return rows[0];
  }

  async getProposalsByUser(userId: number): Promise<Proposal[]> {
    return this.db.select().from(proposals).where(eq(proposals.userId, userId)).orderBy(desc(proposals.createdAt));
  }

  async getPendingProposalsByUser(userId: number): Promise<Proposal[]> {
    return this.db
      .select()
      .from(proposals)
      .where(and(eq(proposals.userId, userId), eq(proposals.status, "pending")))
      .orderBy(desc(proposals.createdAt));
  }

  async createProposal(proposal: InsertProposal): Promise<Proposal> {
    const rows = await this.db.insert(proposals).values(proposal).returning();
    return rows[0];
  }

  async updateProposal(id: number, proposalData: Partial<Proposal>): Promise<Proposal | undefined> {
    const rows = await this.db.update(proposals).set(proposalData).where(eq(proposals.id, id)).returning();
    return rows[0];
  }

  // Notification methods
  async getNotification(id: number): Promise<Notification | undefined> {
    const rows = await this.db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return rows[0];
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return this.db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const rows = await this.db.insert(notifications).values(notification).returning();
    return rows[0];
  }

  async markNotificationRead(id: number, read: boolean): Promise<Notification | undefined> {
    const rows = await this.db.update(notifications).set({ read }).where(eq(notifications.id, id)).returning();
    return rows[0];
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return rows.length;
  }

  // Weather cache persistence: one row per location per calendar day
  async upsertWeatherCache(location: string, date: Date, data: unknown): Promise<void> {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    await this.db.transaction(async (tx) => {
      await tx
        .delete(weatherCache)
        .where(
          and(
            eq(weatherCache.location, location),
            gte(weatherCache.date, dayStart),
            lte(weatherCache.date, dayEnd)
          )
        );
      await tx.insert(weatherCache).values({ location, date: dayStart, data: data as never });
    });
  }
}

// Persistent PostgreSQL storage is the default. In-memory storage exists only
// for explicitly selected tests or demonstrations via MEM_STORAGE=1.
export const storage: IStorage =
  process.env.MEM_STORAGE === "1" ? new MemStorage() : new DbStorage(getDb());
