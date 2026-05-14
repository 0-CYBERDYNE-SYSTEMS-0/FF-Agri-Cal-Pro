import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

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

// Rate limiting: prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

// Session store (in-memory for dev, swap to connect-pg-simple for production)
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-in-production-" + Date.now();
app.use(session({
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
  const server = await registerRoutes(app);

  // Apply rate limiting to all API routes
  app.use("/api", apiLimiter);

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
})();
