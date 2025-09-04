import { Router } from 'express';
import { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth';
import { structuredLogger, LogCategory } from '../services/structured-logger';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, name, role = 'paralegal' } = req.body;

    if (!username || !password || !email || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await AuthService.register({
      username,
      password,
      email,
      name,
      role,
    });

    await structuredLogger.logAuthEvent(
      'register',
      result.user.id,
      true,
      undefined,
      {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        metadata: {
          username,
          email,
          role,
          operation: 'user_registration'
        }
      }
    );

    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error: any) {
    await structuredLogger.logAuthEvent(
      'register',
      username || 'unknown',
      false,
      error,
      {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        metadata: {
          username,
          email,
          role,
          errorType: error.message,
          operation: 'user_registration_failed'
        }
      }
    );
    
    if (error.message === 'Username already exists') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login a user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await AuthService.login(email, password);

    await structuredLogger.logAuthEvent(
      'login',
      result.user.id,
      true,
      undefined,
      {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        metadata: {
          email,
          role: result.user.role,
          operation: 'user_login'
        }
      }
    );

    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    await structuredLogger.logAuthEvent(
      'login',
      email || 'unknown',
      false,
      error as Error,
      {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        metadata: {
          email,
          operation: 'user_login_failed'
        }
      }
    );
    
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

/**
 * POST /api/auth/logout
 * Logout a user (client-side token removal)
 */
router.post('/logout', authenticate, async (req: any, res) => {
  await structuredLogger.logAuthEvent(
    'logout',
    req.user?.id || 'unknown',
    true,
    undefined,
    {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      sessionId: req.sessionID,
      metadata: {
        operation: 'user_logout'
      }
    }
  );
  
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', authenticate, async (req: any, res) => {
  try {
    // req.user is already populated by authenticate middleware
    if (!req.user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: req.user });
  } catch (error) {
    await structuredLogger.error(
      'Failed to get current user information',
      LogCategory.AUTH,
      error as Error,
      {
        userId: req.user?.id,
        method: req.method,
        url: req.url,
        metadata: {
          operation: 'get_current_user_failed'
        }
      },
      ['auth', 'user', 'failed']
    );
    
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * GET /api/auth/health
 * Check auth system health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'Auth system operational',
    timestamp: new Date().toISOString(),
  });
});

export default router;
