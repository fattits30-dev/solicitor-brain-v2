import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.js";
import { authenticate } from "../middleware/auth.js";
import { auditLog } from "../services/audit.js";

const router = Router();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
  role: z.enum(["solicitor", "admin", "paralegal", "client"]).default("solicitor"),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    
    const result = await AuthService.register(data);
    
    // Log registration
    await auditLog({
      userId: result.user.id,
      action: "user.register",
      resource: "user",
      resourceId: result.user.id,
      metadata: { username: result.user.username, role: result.user.role },
    });
    
    res.status(201).json({
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    
    if (error instanceof Error) {
      if (error.message === "Username already exists") {
        return res.status(409).json({ error: error.message });
      }
      console.error("Registration error:", error);
      return res.status(500).json({ error: "Registration failed" });
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
    const data = loginSchema.parse(req.body);
    
    const result = await AuthService.login(data.username, data.password);
    
    // Log login
    await auditLog({
      userId: result.user.id,
      action: "user.login",
      resource: "session",
      resourceId: result.user.id,
      metadata: { username: result.user.username },
    });
    
    res.json({
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    
    if (error instanceof Error) {
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
      console.error("Login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
    
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /api/auth/logout
 * Logout a user (client-side token removal)
 */
router.post("/logout", authenticate, async (req, res) => {
  try {
    // Log logout
    await auditLog({
      userId: req.user!.id,
      action: "user.logout",
      resource: "session",
      resourceId: req.user!.id,
      metadata: { username: req.user!.username },
    });
    
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    
    // Verify current password
    const isValid = await AuthService.login(req.user!.username, data.currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    // Update password
    await AuthService.updatePassword(req.user!.id, data.newPassword);
    
    // Log password change
    await auditLog({
      userId: req.user!.id,
      action: "user.change_password",
      resource: "user",
      resourceId: req.user!.id,
      metadata: { username: req.user!.username },
    });
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh authentication token
 */
router.post("/refresh", authenticate, async (req, res) => {
  try {
    const token = AuthService.generateToken({
      userId: req.user!.id,
      username: req.user!.username,
      role: req.user!.role,
    });
    
    res.json({ token });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

export default router;