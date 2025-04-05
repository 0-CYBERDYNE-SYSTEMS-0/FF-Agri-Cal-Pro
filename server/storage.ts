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
    this.initSampleData().catch(error => {
      console.error("Error initializing sample data:", error);
    });
  }

  private async initSampleData() {
    // Create a sample user
    const sampleUser: InsertUser = {
      username: "demo",
      password: "password123",
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
        recurringPattern: { frequency: "weekly", interval: 1, endDate: new Date(currentYear, currentMonth + 2, 10) }
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
        recurringPattern: { frequency: "weekly", interval: 1, endDate: new Date(currentYear, currentMonth + 2, 30) }
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
        recurringPattern: { frequency: "weekly", interval: 1, endDate: null }
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
      recurringPattern: insertEvent.recurringPattern || null
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

  // Weather functionality removed in favor of OpenWeather API
}

export const storage = new MemStorage();
