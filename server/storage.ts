import { users, type User, type InsertUser, projects, type Project, type InsertProject, events, type Event, type InsertEvent, conversations, type Conversation, type InsertConversation, userFiles, type UserFile, type InsertUserFile, userDocuments, type UserDocument, type InsertUserDocument, notifications, type Notification, type InsertNotification, images, type Image, type InsertImage, WeatherForecast } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";

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

  // Notification methods
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  getUnreadNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  dismissNotification(id: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;

  // Image methods
  getImage(id: number): Promise<Image | undefined>;
  getImagesByUser(userId: number): Promise<Image[]>;
  getImagesByEvent(eventId: number): Promise<Image[]>;
  getImagesByConversation(conversationId: number): Promise<Image[]>;
  createImage(image: InsertImage): Promise<Image>;
  deleteImage(id: number): Promise<boolean>;

  // Storage interface intentionally doesn't include weather functions
  // as weather data comes directly from the OpenWeatherAPI
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private events: Map<number, Event>;
  private conversations: Map<number, Conversation>;
  private userFiles: Map<number, UserFile>;
  private userDocuments: Map<number, UserDocument>;
  private notifications: Map<number, Notification>;
  private images: Map<number, Image>;
  private currentUserId: number;
  private currentProjectId: number;
  private currentEventId: number;
  private currentConversationId: number;
  private currentUserFileId: number;
  private currentUserDocumentId: number;
  private currentNotificationId: number;
  private currentImageId: number;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.events = new Map();
    this.conversations = new Map();
    this.userFiles = new Map();
    this.userDocuments = new Map();
    this.notifications = new Map();
    this.images = new Map();
    this.currentUserId = 1;
    this.currentProjectId = 1;
    this.currentEventId = 1;
    this.currentConversationId = 1;
    this.currentUserFileId = 1;
    this.currentUserDocumentId = 1;
    this.currentNotificationId = 1;
    this.currentImageId = 1;

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
      recurringPattern: insertEvent.recurringPattern || null,
      instructions: insertEvent.instructions || null,
      materials: insertEvent.materials || null,
      researchLinks: insertEvent.researchLinks || null,
      notes: insertEvent.notes || null,
      imageUrls: insertEvent.imageUrls || null
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

  // Notification methods
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((notif) => notif.userId === userId && !notif.dismissed)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUnreadNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((notif) => notif.userId === userId && !notif.isRead && !notif.dismissed)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.currentNotificationId++;
    const notification: Notification = {
      ...insertNotification,
      id,
      eventId: insertNotification.eventId || null,
      icon: insertNotification.icon || null,
      suggestedActions: insertNotification.suggestedActions || null,
      isRead: false,
      dismissed: false,
      createdAt: new Date()
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;

    const updatedNotification = { ...notification, isRead: true };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async dismissNotification(id: number): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;

    const updatedNotification = { ...notification, dismissed: true };
    this.notifications.set(id, updatedNotification);
    return true;
  }

  async deleteNotification(id: number): Promise<boolean> {
    return this.notifications.delete(id);
  }

  // Image methods
  async getImage(id: number): Promise<Image | undefined> {
    return this.images.get(id);
  }

  async getImagesByUser(userId: number): Promise<Image[]> {
    return Array.from(this.images.values())
      .filter((img) => img.userId === userId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async getImagesByEvent(eventId: number): Promise<Image[]> {
    return Array.from(this.images.values())
      .filter((img) => img.eventId === eventId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async getImagesByConversation(conversationId: number): Promise<Image[]> {
    return Array.from(this.images.values())
      .filter((img) => img.conversationId === conversationId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async createImage(insertImage: InsertImage): Promise<Image> {
    const id = this.currentImageId++;
    const image: Image = {
      ...insertImage,
      id,
      eventId: insertImage.eventId || null,
      conversationId: insertImage.conversationId || null,
      aiAnalysis: insertImage.aiAnalysis || null,
      uploadedAt: new Date()
    };
    this.images.set(id, image);
    return image;
  }

  async deleteImage(id: number): Promise<boolean> {
    return this.images.delete(id);
  }

  // Weather functionality removed in favor of OpenWeather API
}

// PostgreSQL Database Storage Implementation
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Project methods
  async getProject(id: number): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getProjectsByUser(userId: number): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(id: number, projectData: Partial<Project>): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set(projectData)
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Event methods
  async getEvent(id: number): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return result[0];
  }

  async getEventsByUser(userId: number): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.userId, userId));
  }

  async getEventsByProject(projectId: number): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.projectId, projectId));
  }

  async getEventsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Event[]> {
    return await db.select()
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          gte(events.startDate, startDate),
          lte(events.startDate, endDate)
        )
      );
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const result = await db.insert(events).values(insertEvent).returning();
    return result[0];
  }

  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const result = await db.update(events)
      .set(eventData)
      .where(eq(events.id, id))
      .returning();
    return result[0];
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id)).returning();
    return result.length > 0;
  }

  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return result[0];
  }

  async getConversationsByUser(userId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.userId, userId));
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }

  async updateConversation(id: number, messages: any[]): Promise<Conversation | undefined> {
    const result = await db.update(conversations)
      .set({ messages })
      .where(eq(conversations.id, id))
      .returning();
    return result[0];
  }

  // User file methods
  async getUserFile(id: number): Promise<UserFile | undefined> {
    const result = await db.select().from(userFiles).where(eq(userFiles.id, id)).limit(1);
    return result[0];
  }

  async getUserFilesByUser(userId: number): Promise<UserFile[]> {
    return await db.select().from(userFiles).where(eq(userFiles.userId, userId));
  }

  async getUserFilesByProject(projectId: number): Promise<UserFile[]> {
    return await db.select().from(userFiles).where(eq(userFiles.projectId, projectId));
  }

  async getUserFilesByType(userId: number, fileType: string): Promise<UserFile[]> {
    return await db.select()
      .from(userFiles)
      .where(and(eq(userFiles.userId, userId), eq(userFiles.fileType, fileType)));
  }

  async createUserFile(insertFile: InsertUserFile): Promise<UserFile> {
    const result = await db.insert(userFiles).values(insertFile).returning();
    return result[0];
  }

  async updateUserFile(id: number, fileData: Partial<UserFile>): Promise<UserFile | undefined> {
    const fileDataWithTimestamp = { ...fileData, lastAccessed: new Date() };
    const result = await db.update(userFiles)
      .set(fileDataWithTimestamp)
      .where(eq(userFiles.id, id))
      .returning();
    return result[0];
  }

  async deleteUserFile(id: number): Promise<boolean> {
    const result = await db.delete(userFiles).where(eq(userFiles.id, id)).returning();
    return result.length > 0;
  }

  // User document methods
  async getUserDocument(id: number): Promise<UserDocument | undefined> {
    const result = await db.select().from(userDocuments).where(eq(userDocuments.id, id)).limit(1);
    return result[0];
  }

  async getUserDocumentsByUser(userId: number): Promise<UserDocument[]> {
    return await db.select().from(userDocuments).where(eq(userDocuments.userId, userId));
  }

  async getUserDocumentsByProject(projectId: number): Promise<UserDocument[]> {
    return await db.select().from(userDocuments).where(eq(userDocuments.projectId, projectId));
  }

  async getUserDocumentsByType(userId: number, documentType: string): Promise<UserDocument[]> {
    return await db.select()
      .from(userDocuments)
      .where(and(eq(userDocuments.userId, userId), eq(userDocuments.documentType, documentType)));
  }

  async createUserDocument(insertDocument: InsertUserDocument): Promise<UserDocument> {
    const result = await db.insert(userDocuments).values(insertDocument).returning();
    return result[0];
  }

  async updateUserDocument(id: number, documentData: Partial<UserDocument>): Promise<UserDocument | undefined> {
    const documentDataWithTimestamp = { ...documentData, updatedAt: new Date() };
    const result = await db.update(userDocuments)
      .set(documentDataWithTimestamp)
      .where(eq(userDocuments.id, id))
      .returning();
    return result[0];
  }

  async deleteUserDocument(id: number): Promise<boolean> {
    const result = await db.delete(userDocuments).where(eq(userDocuments.id, id)).returning();
    return result.length > 0;
  }

  // Notification methods
  async getNotification(id: number): Promise<Notification | undefined> {
    const result = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return result[0];
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.dismissed, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          eq(notifications.dismissed, false)
        )
      )
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(insertNotification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return result[0];
  }

  async dismissNotification(id: number): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ dismissed: true })
      .where(eq(notifications.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    return result.length > 0;
  }

  // Image methods
  async getImage(id: number): Promise<Image | undefined> {
    const result = await db.select().from(images).where(eq(images.id, id)).limit(1);
    return result[0];
  }

  async getImagesByUser(userId: number): Promise<Image[]> {
    return await db.select()
      .from(images)
      .where(eq(images.userId, userId))
      .orderBy(desc(images.uploadedAt));
  }

  async getImagesByEvent(eventId: number): Promise<Image[]> {
    return await db.select()
      .from(images)
      .where(eq(images.eventId, eventId))
      .orderBy(desc(images.uploadedAt));
  }

  async getImagesByConversation(conversationId: number): Promise<Image[]> {
    return await db.select()
      .from(images)
      .where(eq(images.conversationId, conversationId))
      .orderBy(desc(images.uploadedAt));
  }

  async createImage(insertImage: InsertImage): Promise<Image> {
    const result = await db.insert(images).values(insertImage).returning();
    return result[0];
  }

  async deleteImage(id: number): Promise<boolean> {
    const result = await db.delete(images).where(eq(images.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new MemStorage();
