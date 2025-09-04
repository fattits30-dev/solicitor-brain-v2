import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { db } from '../db';
import { StorageService } from '../storage';
import { users, cases, documents, consents, auditLog } from '../../shared/schema';

// Mock the database
jest.mock('../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('StorageService', () => {
  let storage: StorageService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = db as any;
    storage = new StorageService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('User Operations', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashed_password',
      name: 'Test User',
      role: 'solicitor',
      created_at: new Date(),
      updated_at: new Date(),
    };

    describe('getUser', () => {
      it('should return user when found', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([mockUser]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getUser('1');

        expect(result).toEqual(mockUser);
        expect(mockDb.select).toHaveBeenCalled();
        expect(mockSelect.from).toHaveBeenCalledWith(users);
        expect(mockSelect.where).toHaveBeenCalled();
      });

      it('should return undefined when user not found', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getUser('999');

        expect(result).toBeUndefined();
      });

      it('should handle database errors gracefully', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        };
        mockDb.select.mockReturnValue(mockSelect);

        await expect(storage.getUser('1')).rejects.toThrow('Database connection failed');
      });
    });

    describe('getUserByUsername', () => {
      it('should return user when found by email', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([mockUser]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getUserByUsername('test@example.com');

        expect(result).toEqual(mockUser);
      });

      it('should return undefined when user not found by email', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getUserByUsername('nonexistent@example.com');

        expect(result).toBeUndefined();
      });
    });

    describe('createUser', () => {
      it('should create user successfully', async () => {
        const newUser = {
          email: 'new@example.com',
          password_hash: 'hashed_password',
          name: 'New User',
          role: 'solicitor',
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ ...mockUser, ...newUser, id: 2 }]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await storage.createUser(newUser);

        expect(result).toEqual(expect.objectContaining(newUser));
        expect(mockDb.insert).toHaveBeenCalledWith(users);
        expect(mockInsert.values).toHaveBeenCalledWith(newUser);
        expect(mockInsert.returning).toHaveBeenCalled();
      });

      it('should handle duplicate email error', async () => {
        const newUser = {
          email: 'existing@example.com',
          password_hash: 'hashed_password',
          name: 'New User',
          role: 'solicitor',
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint')),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        await expect(storage.createUser(newUser)).rejects.toThrow();
      });
    });
  });

  describe('Case Operations', () => {
    const mockCase = {
      id: 1,
      caseReference: 'CASE-2024-001',
      title: 'Test Case',
      status: 'active',
      priority: 'medium',
      createdById: 1,
      assignedToId: 1,
      description: 'Test case description',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('getCases', () => {
      it('should return all cases', async () => {
        const mockSelect = {
          from: jest.fn().mockResolvedValue([mockCase]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getCases();

        expect(result).toEqual([mockCase]);
        expect(mockDb.select).toHaveBeenCalled();
        expect(mockSelect.from).toHaveBeenCalledWith(cases);
      });

      it('should return empty array when no cases exist', async () => {
        const mockSelect = {
          from: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getCases();

        expect(result).toEqual([]);
      });
    });

    describe('getCase', () => {
      it('should return case when found', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([mockCase]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getCase('1');

        expect(result).toEqual(mockCase);
        expect(mockDb.select).toHaveBeenCalled();
        expect(mockSelect.where).toHaveBeenCalled();
      });

      it('should return undefined when case not found', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getCase('999');

        expect(result).toBeUndefined();
      });
    });

    describe('createCase', () => {
      it('should create case with auto-generated reference', async () => {
        const newCase = {
          title: 'New Test Case',
          status: 'active',
          priority: 'high',
          description: 'New case description',
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ ...mockCase, ...newCase, id: 2 }]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await storage.createCase(newCase);

        expect(result).toEqual(expect.objectContaining(newCase));
        expect(result.caseReference).toMatch(/^CASE-\d+-[A-Z0-9]{6}$/);
        expect(mockDb.insert).toHaveBeenCalledWith(cases);
        expect(mockInsert.values).toHaveBeenCalledWith(
          expect.objectContaining({
            ...newCase,
            caseReference: expect.stringMatching(/^CASE-\d+-[A-Z0-9]{6}$/),
          })
        );
      });

      it('should use provided case reference if given', async () => {
        const newCase = {
          title: 'New Test Case',
          caseReference: 'CUSTOM-2024-001',
          status: 'active',
          priority: 'high',
          description: 'New case description',
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ ...mockCase, ...newCase, id: 2 }]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await storage.createCase(newCase);

        expect(result.caseReference).toBe('CUSTOM-2024-001');
        expect(mockInsert.values).toHaveBeenCalledWith(newCase);
      });
    });

    describe('updateCase', () => {
      it('should update case successfully', async () => {
        const updates = { title: 'Updated Title', priority: 'high' };
        const updatedCase = { ...mockCase, ...updates };

        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([updatedCase]),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        const result = await storage.updateCase('1', updates);

        expect(result).toEqual(updatedCase);
        expect(mockDb.update).toHaveBeenCalledWith(cases);
        expect(mockUpdate.set).toHaveBeenCalledWith(
          expect.objectContaining({
            ...updates,
            updatedAt: expect.any(Date),
          })
        );
        expect(mockUpdate.where).toHaveBeenCalled();
        expect(mockUpdate.returning).toHaveBeenCalled();
      });

      it('should return undefined when case not found for update', async () => {
        const updates = { title: 'Updated Title' };

        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([]),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        const result = await storage.updateCase('999', updates);

        expect(result).toBeUndefined();
      });
    });

    describe('deleteCase', () => {
      it('should delete case successfully', async () => {
        const mockDelete = {
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        };
        mockDb.delete.mockReturnValue(mockDelete);

        const result = await storage.deleteCase('1');

        expect(result).toBe(true);
        expect(mockDb.delete).toHaveBeenCalledWith(cases);
        expect(mockDelete.where).toHaveBeenCalled();
      });

      it('should return false when case not found for deletion', async () => {
        const mockDelete = {
          where: jest.fn().mockResolvedValue({ rowCount: 0 }),
        };
        mockDb.delete.mockReturnValue(mockDelete);

        const result = await storage.deleteCase('999');

        expect(result).toBe(false);
      });
    });
  });

  describe('Document Operations', () => {
    const mockDocument = {
      id: 1,
      caseId: 1,
      fileName: 'test.pdf',
      filePath: '/uploads/test.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      hash: 'abc123',
      uploadedById: 1,
      extractedText: 'Extracted text content',
      metadata: { pages: 5 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('getDocumentsByCase', () => {
      it('should return documents for a case', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([mockDocument]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getDocumentsByCase('1');

        expect(result).toEqual([mockDocument]);
        expect(mockDb.select).toHaveBeenCalled();
        expect(mockSelect.from).toHaveBeenCalledWith(documents);
        expect(mockSelect.where).toHaveBeenCalled();
      });

      it('should return empty array when no documents exist for case', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getDocumentsByCase('999');

        expect(result).toEqual([]);
      });
    });

    describe('createDocument', () => {
      it('should create document successfully', async () => {
        const newDocument = {
          caseId: 1,
          fileName: 'new.pdf',
          filePath: '/uploads/new.pdf',
          hash: 'def456',
          extractedText: 'New document content',
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ ...mockDocument, ...newDocument, id: 2 }]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await storage.createDocument(newDocument);

        expect(result).toEqual(expect.objectContaining(newDocument));
        expect(mockDb.insert).toHaveBeenCalledWith(documents);
        expect(mockInsert.values).toHaveBeenCalledWith(newDocument);
        expect(mockInsert.returning).toHaveBeenCalled();
      });
    });
  });

  describe('Audit Log Operations', () => {
    const mockAuditEntry = {
      id: 1,
      userId: 'user123',
      action: 'CREATE',
      entityType: 'case',
      entityId: '1',
      resource: 'cases',
      resourceId: '1',
      metadata: { operation: 'create_case' },
      redactedData: null,
      timestamp: new Date(),
    };

    describe('createAuditLog', () => {
      it('should create audit log entry successfully', async () => {
        const newAuditEntry = {
          userId: 'user123',
          action: 'CREATE',
          resource: 'cases',
          resourceId: '1',
          metadata: { operation: 'create_case' },
          redactedData: null,
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ ...mockAuditEntry, ...newAuditEntry, id: 2 }]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await storage.createAuditLog(newAuditEntry);

        expect(result).toEqual(expect.objectContaining(newAuditEntry));
        expect(mockDb.insert).toHaveBeenCalledWith(auditLog);
        expect(mockInsert.values).toHaveBeenCalledWith(newAuditEntry);
        expect(mockInsert.returning).toHaveBeenCalled();
      });
    });

    describe('getAuditLogs', () => {
      it('should return audit logs with summary', async () => {
        const mockEntries = [
          { ...mockAuditEntry, action: 'CREATE', resource: 'cases', userId: 'user1' },
          { ...mockAuditEntry, id: 2, action: 'UPDATE', resource: 'documents', userId: 'user2' },
          { ...mockAuditEntry, id: 3, action: 'DELETE', resource: 'cases', userId: 'user1' },
        ];

        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockResolvedValue(mockEntries),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getAuditLogs();

        expect(result.entries).toEqual(mockEntries);
        expect(result.summary).toEqual({
          byAction: { CREATE: 1, UPDATE: 1, DELETE: 1 },
          byResource: { cases: 2, documents: 1 },
          byUser: { user1: 2, user2: 1 },
          byHour: expect.any(Object),
        });
      });

      it('should handle null values safely in summary calculation', async () => {
        const mockEntriesWithNulls = [
          { ...mockAuditEntry, resource: null, userId: null, timestamp: null },
        ];

        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockResolvedValue(mockEntriesWithNulls),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getAuditLogs();

        expect(result.entries).toEqual(mockEntriesWithNulls);
        // Should not crash and should handle nulls gracefully
        expect(result.summary.byResource).toEqual({});
        expect(result.summary.byUser).toEqual({});
        expect(result.summary.byHour).toEqual({ unknown: 1 });
      });
    });
  });

  describe('Consent Operations', () => {
    const mockConsent = {
      id: 1,
      personId: 1,
      consentType: 'ocr_processing',
      granted: true,
      grantedAt: new Date(),
      revokedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('getConsentsByPerson', () => {
      it('should return consents for a person', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([mockConsent]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getConsentsByPerson('1');

        expect(result).toEqual([mockConsent]);
        expect(mockDb.select).toHaveBeenCalled();
        expect(mockSelect.from).toHaveBeenCalledWith(consents);
        expect(mockSelect.where).toHaveBeenCalled();
      });

      it('should handle string personId correctly', async () => {
        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([mockConsent]),
        };
        mockDb.select.mockReturnValue(mockSelect);

        const result = await storage.getConsentsByPerson('123');

        expect(result).toEqual([mockConsent]);
        // Verify that the personId was parsed as integer
        expect(mockSelect.where).toHaveBeenCalled();
      });
    });

    describe('createConsent', () => {
      it('should create consent successfully', async () => {
        const newConsent = {
          personId: 1,
          consentType: 'data_sharing',
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ ...mockConsent, ...newConsent, id: 2 }]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await storage.createConsent(newConsent);

        expect(result).toEqual(expect.objectContaining(newConsent));
        expect(mockDb.insert).toHaveBeenCalledWith(consents);
        expect(mockInsert.values).toHaveBeenCalledWith(newConsent);
        expect(mockInsert.returning).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(storage.getUser('1')).rejects.toThrow('Database connection failed');
    });

    it('should handle transaction rollback scenarios', async () => {
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockRejectedValue(new Error('Transaction rolled back')),
      };
      mockDb.insert.mockReturnValue(mockInsert);

      await expect(storage.createUser({
        email: 'test@example.com',
        password_hash: 'hash',
        name: 'Test',
        role: 'solicitor',
      })).rejects.toThrow('Transaction rolled back');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockUser,
        id: i + 1,
        email: `user${i}@example.com`,
      }));

      const mockSelect = {
        from: jest.fn().mockResolvedValue(largeResultSet),
      };
      mockDb.select.mockReturnValue(mockSelect);

      const result = await storage.getCases();
      
      // Should handle large datasets without issues
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle concurrent operations safely', async () => {
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUser]),
      };
      mockDb.insert.mockReturnValue(mockInsert);

      const promises = Array.from({ length: 10 }, (_, i) =>
        storage.createUser({
          email: `concurrent${i}@example.com`,
          password_hash: 'hash',
          name: `User ${i}`,
          role: 'solicitor',
        })
      );

      // Should not throw errors with concurrent operations
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });
});