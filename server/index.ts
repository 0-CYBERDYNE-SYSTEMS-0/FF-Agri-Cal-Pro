import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { startScheduler } from "./scheduler";
import { setupVite, serveStatic, log } from "./vite";
import { checkDatabaseConnection, getPool, hasDatabase } from "../db";
import { resolveSessionSecret } from "./sessionConfig";

const app = express();
const sessionSecret = resolveSessionSecret();

// Trust the first proxy so `secure` session cookies work behind TLS-terminating
// proxies (req.protocol/req.ip reflect X-Forwarded-* headers).
app.set("trust proxy", 1);

// --- Security Middleware ---

// Helmet: secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow Vite HMR in dev
}));

// CORS: restrict cross-origin requests
app.use(cors({
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? false : true),
  credentials: true,
}));

// Rate limiting: prevent abuse. Registered BEFORE the API routes so it guards
// every /api endpoint from the first request.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: parsePositiveInt(process.env.RATE_LIMIT_MAX, process.env.NODE_ENV === "production" ? 100 : 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

// Request logging (no sensitive data)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Persistent PostgreSQL storage is required for normal operation. In-memory
  // storage (MEM_STORAGE=1) is reserved for explicit tests or demonstrations.
  if (!hasDatabase()) {
    if (process.env.MEM_STORAGE !== "1") {
      console.error(
        "FATAL: DATABASE_URL is not set. Persistent storage is required for normal startup.\n" +
        "Set DATABASE_URL to a PostgreSQL connection string, or run with MEM_STORAGE=1 explicitly for a demo."
      );
      process.exit(1);
    }
    log("MEM_STORAGE=1: using in-memory storage (data will not persist)");
  } else {
    try {
      await checkDatabaseConnection();
      log("Connected to PostgreSQL");
    } catch (err) {
      console.error(
        "FATAL: cannot reach the PostgreSQL database at DATABASE_URL. " +
        "Persistent storage is required for normal startup.",
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    }
  }

  // Persistent session store sharing the application pg pool; the default
  // in-memory MemoryStore is only used for MEM_STORAGE demos.
  const sessionStore = hasDatabase()
    ? new (connectPgSimple(session))({
        pool: getPool(),
        createTableIfMissing: true,
      })
    : undefined;

  app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  }));

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    // Don't leak error details in production
    const response = process.env.NODE_ENV === "production"
      ? { message: "Internal Server Error" }
      : { message, status };
    res.status(status).json(response);
    console.error("Server error:", err.message);
  });

  // Setup Vite in development, serve static in production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    log(`serving on port ${port} (${app.get("env")} mode)`);
  });

  // Proactive agent: periodic weather/conflict watch (set
  // AGENT_WATCH_ENABLED=0 to disable)
  if (process.env.AGENT_WATCH_ENABLED !== "0") {
    startScheduler();
  }
})();

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
