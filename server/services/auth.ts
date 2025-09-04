import type { InsertUser, User } from '@shared/schema';
import { users } from '@shared/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');

export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
}

export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token
   */
  static generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string): AuthPayload {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  }

  /**
   * Register a new user
   */
  static async register(userData: InsertUser): Promise<{ user: User; token: string }> {
    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create the user
    const [newUser] = await db
      .insert(users)
      .values({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        password_hash: hashedPassword,
      })
      .returning();

    // Generate token
    const token = this.generateToken({
      userId: newUser.id.toString(),
      username: newUser.email, // Using email as username for backward compatibility
      role: newUser.role,
    });

    // Remove password from response
    const { password_hash: _, ...userWithoutPassword } = newUser;

    return {
      user: userWithoutPassword as User,
      token,
    };
  }

  /**
   * Login a user
   */
  static async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken({
      userId: user.id.toString(),
      username: user.email, // Using email as username for backward compatibility
      role: user.role,
    });

    // Remove password from response
    const { password_hash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as User,
      token,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);

    if (!user) {
      return null;
    }

    // Remove password from response
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Update user password
   */
  static async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);

    await db
      .update(users)
      .set({
        password_hash: hashedPassword,
        updated_at: new Date(),
      })
      .where(eq(users.id, parseInt(userId)));
  }

  /**
   * Validate user role for authorization
   */
  static hasRole(user: User, allowedRoles: string[]): boolean {
    return allowedRoles.includes(user.role);
  }
}
