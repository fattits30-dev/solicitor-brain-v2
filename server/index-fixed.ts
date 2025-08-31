import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// API Routes - Test endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes - Auth endpoints (simplified for testing)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  
  // Simple check for testing
  if (username === "admin" && password === "password123") {
    res.json({ 
      success: true, 
      token: "test-token-123",
      user: { username: "admin", role: "admin" }
    });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// API Routes - Cases endpoint (test data)
app.get("/api/cases", (req, res) => {
  res.json([
    { id: "1", title: "Smith vs Jones", status: "active" },
    { id: "2", title: "Johnson Estate", status: "pending" }
  ]);
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(__dirname, "public");
  
  // Serve static files
  app.use(express.static(publicPath));
  
  // Catch all handler - send React app
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
} else {
  // Development - just return a message
  app.get("/", (req, res) => {
    res.json({ 
      message: "Server is running in development mode",
      api: "/api/health"
    });
  });
}

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔍 Test the API: http://localhost:${PORT}/api/health`);
});