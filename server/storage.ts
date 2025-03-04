import { users, type User, type InsertUser, projects, type Project, type InsertProject, events, type Event, type InsertEvent, conversations, type Conversation, type InsertConversation, WeatherForecast } from "@shared/schema";

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
  getEventsByUser(userId: number): Promise<Event[]>;
  getEventsByProject(projectId: number): Promise<Event[]>;
  getEventsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;

  // Conversation methods
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByUser(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, messages: any[]): Promise<Conversation | undefined>;

  // Storage interface intentionally doesn't include weather functions
  // as weather data comes directly from the OpenWeatherAPI
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private events: Map<number, Event>;
  private conversations: Map<number, Conversation>;
  private currentUserId: number;
  private currentProjectId: number;
  private currentEventId: number;
  private currentConversationId: number;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.events = new Map();
    this.conversations = new Map();
    this.currentUserId = 1;
    this.currentProjectId = 1;
    this.currentEventId = 1;
    this.currentConversationId = 1;

    // Initialize with sample data
    this.initSampleData();
  }

  private initSampleData() {
    // Create a sample user
    const sampleUser: InsertUser = {
      username: "demo",
      password: "password123",
      email: "demo@example.com",
      displayName: "Sarah Johnson",
      profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    };
    const user = this.createUser(sampleUser);

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
      }
    ];

    const projects = projectsData.map(project => this.createProject(project));

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
        recurringPattern: { frequency: "weekly", interval: 1, endDate: null }
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
        recurringPattern: { frequency: "daily", interval: 2, endDate: new Date(currentYear, currentMonth + 1, 14) }
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
      }
    ];

    eventsData.forEach(event => this.createEvent(event));

    // Initialize sample conversation
    const sampleConversation: InsertConversation = {
      userId: user.id,
      messages: [
        {
          role: "assistant",
          content: "Hello! I'm Farm Friend your agricultural planning assistant. How can I help you today?"
        },
        {
          role: "user",
          content: "I need help planning my tomato planting schedule."
        },
        {
          role: "assistant",
          content: "I'd be happy to help with your tomato planting schedule! Could you tell me your location so I can provide recommendations based on your climate zone?"
        }
      ]
    };
    this.createConversation(sampleConversation);
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
    const user: User = { ...insertUser, id, createdAt: new Date() };
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
    const project: Project = { ...insertProject, id, createdAt: new Date() };
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
    const event: Event = { ...insertEvent, id, createdAt: new Date() };
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
    const conversation: Conversation = { ...insertConversation, id, createdAt: new Date() };
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

  // Weather functionality removed in favor of OpenWeather API
}

export const storage = new MemStorage();
