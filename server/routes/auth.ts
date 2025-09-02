import { Router } from "express";
import { AuthService } from "../services/auth";
import { authenticate } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password, email, name, role = "paralegal" } = req.body;
    
    if (!username || !password || !email || !name) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    const result = await AuthService.register({
      username,
      password,
      email,
      name,
      role,
    });
    
    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error: any) {
    if (error.message === "Username already exists") {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/auth/login
 * Login a user
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    const result = await AuthService.login(username, password);
    
    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error: any) {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

/**
 * POST /api/auth/logout
 * Logout a user (client-side token removal)
 */
router.post("/logout", authenticate, async (req: any, res) => {
  res.json({ message: "Logged out successfully" });
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get("/me", authenticate, async (req: any, res) => {
  try {
    const user = await AuthService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

/**
 * GET /api/auth/health
 * Check auth system health
 */
router.get("/health", (req, res) => {
  res.json({ 
    status: "Auth system operational",
    timestamp: new Date().toISOString()
  });
});

export default router;