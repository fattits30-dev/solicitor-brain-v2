import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { AuthService, type AuthPayload } from '../services/auth';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../db');

const mockDb = db as any;
const mockBcrypt = bcrypt as any;
const mockJwt = jwt as any;

describe('AuthService', () => {
  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    password: 'hashedpassword',
    name: 'Test User',
    role: 'user',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserWithoutPassword = {
    id: 'user-123',
    username: 'testuser',
    name: 'Test User',
    role: 'user',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockBcrypt.hash.mockResolvedValue('hashedpassword');
    mockBcrypt.compare.mockResolvedValue(true);
    mockJwt.sign.mockReturnValue('mock-jwt-token');
    mockJwt.verify.mockReturnValue({
      userId: 'user-123',
      username: 'testuser',
      role: 'user',
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with correct rounds', async () => {
      const password = 'testpassword';
      const hashedPassword = await AuthService.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(hashedPassword).toBe('hashedpassword');
    });

    it('should handle bcrypt errors', async () => {
      mockBcrypt.hash.mockRejectedValue(new Error('Hash failed'));

      await expect(AuthService.hashPassword('test')).rejects.toThrow('Hash failed');
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      const result = await AuthService.verifyPassword('password', 'hash');

      expect(mockBcrypt.compare).toHaveBeenCalledWith('password', 'hash');
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await AuthService.verifyPassword('wrong', 'hash');

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      const payload: AuthPayload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      };

      const token = AuthService.generateToken(payload);

      expect(mockJwt.sign).toHaveBeenCalledWith(payload, expect.any(String), {
        expiresIn: '7d',
      });
      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode JWT token', () => {
      const token = 'valid-token';
      const decoded = AuthService.verifyToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(decoded).toEqual({
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      });
    });

    it('should throw error for invalid token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => AuthService.verifyToken('invalid')).toThrow('Invalid token');
    });
  });

  describe('register', () => {
    const userData = {
      username: 'newuser',
      password: 'password123',
      name: 'New User',
      email: 'new@example.com',
      role: 'user' as const,
    };

    beforeEach(() => {
      // Setup default mocks with simple any typing
      (mockDb.select as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: (jest.fn() as any).mockResolvedValue([]),
          }),
        }),
      });

      (mockDb.insert as any).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: (jest.fn() as any).mockResolvedValue([mockUser]),
        }),
      });
    });

    it('should register new user successfully', async () => {
      const result = await AuthService.register(userData);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          username: 'testuser',
          role: 'user',
        },
        expect.any(String),
        { expiresIn: '7d' }
      );

      expect(result).toEqual({
        user: mockUserWithoutPassword,
        token: 'mock-jwt-token',
      });
    });

    it('should throw error if username already exists', async () => {
      (mockDb.select as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: (jest.fn() as any).mockResolvedValue([mockUser]),
          }),
        }),
      });

      await expect(AuthService.register(userData)).rejects.toThrow('Username already exists');
    });
  });

  describe('login', () => {
    beforeEach(() => {
      (mockDb.select as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: (jest.fn() as any).mockResolvedValue([mockUser]),
          }),
        }),
      });
    });

    it('should login user successfully', async () => {
      const result = await AuthService.login('testuser', 'password123');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(mockJwt.sign).toHaveBeenCalled();

      expect(result).toEqual({
        user: mockUserWithoutPassword,
        token: 'mock-jwt-token',
      });
    });

    it('should throw error for non-existent user', async () => {
      (mockDb.select as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: (jest.fn() as any).mockResolvedValue([]),
          }),
        }),
      });

      await expect(AuthService.login('nonexistent', 'password')).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      (mockBcrypt.compare as any).mockResolvedValue(false);

      await expect(AuthService.login('testuser', 'wrongpassword')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getUserById', () => {
    it('should return user without password', async () => {
      (mockDb.select as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: (jest.fn() as any).mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await AuthService.getUserById('user-123');

      expect((mockDb.select as any)).toHaveBeenCalled();
      expect(result).toEqual(mockUserWithoutPassword);
    });

    it('should return null for non-existent user', async () => {
      (mockDb.select as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: (jest.fn() as any).mockResolvedValue([]),
          }),
        }),
      });

      const result = await AuthService.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      (mockDb.update as any).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: (jest.fn() as any).mockResolvedValue(undefined),
        }),
      });

      await AuthService.updatePassword('user-123', 'newpassword');

      expect((mockBcrypt.hash as any)).toHaveBeenCalledWith('newpassword', 10);
      expect((mockDb.update as any)).toHaveBeenCalled();
    });
  });

  describe('hasRole', () => {
    it('should return true for allowed role', () => {
      const user = { ...mockUserWithoutPassword, password: 'hashed' };
      const result = AuthService.hasRole(user, ['admin', 'user']);

      expect(result).toBe(true);
    });

    it('should return false for disallowed role', () => {
      const user = { ...mockUserWithoutPassword, password: 'hashed' };
      const result = AuthService.hasRole(user, ['admin']);

      expect(result).toBe(false);
    });
  });
});
