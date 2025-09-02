import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../db';
import { auditLog, getAuditLogs } from '../services/audit';

// Mock dependencies
jest.mock('../db');

const mockDb = db as jest.Mocked<typeof db>;
let mockValues: jest.Mock;

describe('Audit Service', () => {
  const mockAuditEntry = {
    userId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID format
    action: 'LOGIN',
    resource: 'auth',
    resourceId: 'session-456',
    metadata: {
      username: 'testuser',
      password: 'secret123',
      token: 'jwt-token-here',
      email: 'test@example.com',
      phone: '+1234567890',
      address: '123 Main St',
      safeField: 'this is safe',
    },
  };

  const mockAuditLogRecord = {
    id: '550e8400-e29b-41d4-a716-446655440001', // Valid UUID format
    userId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID format
    action: 'LOGIN',
    resource: 'auth',
    resourceId: 'session-456',
    metadata: {
      username: 'testuser',
      password: '[REDACTED]',
      token: '[REDACTED]',
      email: '[REDACTED]',
      phone: '[REDACTED]',
      address: '[REDACTED]',
      safeField: 'this is safe',
    },
    redactedData: 'password, token, email, phone, address',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockValues = jest.fn();
    (mockDb.insert as any).mockReturnValue({
      values: mockValues,
    });

    (mockDb.select as any).mockReturnValue({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          offset: jest.fn().mockReturnValue({
            orderBy: (jest.fn() as any).mockResolvedValue([mockAuditLogRecord]),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('auditLog', () => {
    it('should create audit log entry with redacted sensitive data', async () => {
      await auditLog(mockAuditEntry);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Object));
      expect(mockDb.insert).toHaveBeenCalledTimes(1);

      const insertCall = mockDb.insert.mock.calls[0][0];
      expect(insertCall).toBeDefined();

      // Verify the values passed to insert
      const valuesCall = ((mockDb.insert as any)().values as jest.Mock).mock.calls[0][0];
      expect(valuesCall).toEqual({
        ...mockAuditEntry,
        metadata: {
          username: 'testuser',
          password: '[REDACTED]',
          token: '[REDACTED]',
          email: '[REDACTED]',
          phone: '[REDACTED]',
          address: '[REDACTED]',
          safeField: 'this is safe',
        },
        redactedData: 'password, token, email, phone, address',
      });
    });

    it('should handle null metadata', async () => {
      const entryWithoutMetadata = {
        ...mockAuditEntry,
        metadata: null,
      };

      await auditLog(entryWithoutMetadata);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toBeNull();
      expect(valuesCall.redactedData).toBeNull();
    });

    it('should handle empty metadata object', async () => {
      const entryWithEmptyMetadata = {
        ...mockAuditEntry,
        metadata: {},
      };

      await auditLog(entryWithEmptyMetadata);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toEqual({});
      expect(valuesCall.redactedData).toBeNull();
    });

    it('should redact case-insensitive field names', async () => {
      const entryWithMixedCase = {
        ...mockAuditEntry,
        metadata: {
          Password: 'secret',
          TOKEN: 'token123',
          Email: 'test@test.com',
          safeField: 'safe',
        },
      };

      await auditLog(entryWithMixedCase);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toEqual({
        Password: '[REDACTED]',
        TOKEN: '[REDACTED]',
        Email: '[REDACTED]',
        safeField: 'safe',
      });
      expect(valuesCall.redactedData).toBe('Password, TOKEN, Email');
    });

    it('should redact partial field name matches', async () => {
      const entryWithPartialMatches = {
        ...mockAuditEntry,
        metadata: {
          userPassword: 'secret',
          sessionToken: 'token123',
          workEmail: 'test@test.com',
          safeField: 'safe',
        },
      };

      await auditLog(entryWithPartialMatches);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toEqual({
        userPassword: '[REDACTED]',
        sessionToken: '[REDACTED]',
        workEmail: '[REDACTED]',
        safeField: 'safe',
      });
      expect(valuesCall.redactedData).toBe('userPassword, sessionToken, workEmail');
    });

    it('should handle nested objects', async () => {
      const entryWithNestedData = {
        ...mockAuditEntry,
        metadata: {
          user: {
            password: 'secret',
            email: 'test@test.com',
            profile: {
              phone: '+1234567890',
              address: '123 Main St',
            },
          },
          safeField: 'safe',
        },
      };

      await auditLog(entryWithNestedData);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toEqual({
        user: {
          password: '[REDACTED]',
          email: '[REDACTED]',
          profile: {
            phone: '[REDACTED]',
            address: '[REDACTED]',
          },
        },
        safeField: 'safe',
      });
      expect(valuesCall.redactedData).toBe('password, email, phone, address');
    });

    it('should handle arrays in metadata', async () => {
      const entryWithArrayData = {
        ...mockAuditEntry,
        metadata: {
          emails: ['test1@test.com', 'test2@test.com'],
          passwords: ['pass1', 'pass2'],
          safeArray: ['safe1', 'safe2'],
        },
      };

      await auditLog(entryWithArrayData);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toEqual({
        emails: ['[REDACTED]', '[REDACTED]'],
        passwords: ['[REDACTED]', '[REDACTED]'],
        safeArray: ['safe1', 'safe2'],
      });
      expect(valuesCall.redactedData).toBe('emails, passwords');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.insert.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Should not throw - audit logging should not break the application
      await expect(auditLog(mockAuditEntry)).resolves.not.toThrow();

      // Error should be logged to console
      // Note: In a real test, we'd mock console.error and verify it was called
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with default pagination', async () => {
      const result = await getAuditLogs({});

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual([mockAuditLogRecord]);

      // Verify the query chain
      const selectCall = mockDb.select.mock.results[0].value;
      expect(selectCall.from).toHaveBeenCalled();
      expect(selectCall.from().limit).toHaveBeenCalledWith(50);
      expect(selectCall.from().limit().offset).toHaveBeenCalledWith(0);
      expect(selectCall.from().limit().offset().orderBy).toHaveBeenCalled();
    });

    it('should apply custom pagination', async () => {
      await getAuditLogs({ limit: 20, offset: 10 });

      const selectCall = mockDb.select.mock.results[0].value;
      expect(selectCall.from().limit).toHaveBeenCalledWith(20);
      expect(selectCall.from().limit().offset).toHaveBeenCalledWith(10);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database query failed');
      });

      await expect(getAuditLogs({})).rejects.toThrow('Database query failed');
    });
  });

  describe('redactSensitiveData function', () => {
    // Test the internal redactSensitiveData function indirectly through auditLog
    it('should handle primitive values', async () => {
      const entryWithPrimitives = {
        ...mockAuditEntry,
        metadata: {
          stringField: 'safe string',
          numberField: 123,
          booleanField: true,
          nullField: null,
          undefinedField: undefined,
        },
      };

      await auditLog(entryWithPrimitives);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toEqual({
        stringField: 'safe string',
        numberField: 123,
        booleanField: true,
        nullField: null,
        undefinedField: undefined,
      });
    });

    it('should handle complex nested structures', async () => {
      const entryWithComplexData = {
        ...mockAuditEntry,
        metadata: {
          level1: {
            level2: {
              password: 'secret',
              safe: 'safe value',
              array: [
                { token: 'token1', safe: 'safe1' },
                { email: 'email@test.com', safe: 'safe2' },
              ],
            },
          },
        },
      };

      await auditLog(entryWithComplexData);

      const valuesCall = mockValues.mock.calls[0][0];
      expect(valuesCall.metadata).toEqual({
        level1: {
          level2: {
            password: '[REDACTED]',
            safe: 'safe value',
            array: [
              { token: '[REDACTED]', safe: 'safe1' },
              { email: '[REDACTED]', safe: 'safe2' },
            ],
          },
        },
      });
    });
  });
});
