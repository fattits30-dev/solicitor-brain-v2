/**
 * Test Redis Serialization Fixes
 * Verifies that complex objects are properly serialized/deserialized for Redis storage
 */

const { 
  serializeForRedis, 
  deserializeFromRedis, 
  sanitizeJobData, 
  sanitizeJobResult,
  createSafeCopy,
  isSerializable
} = require('../utils/redis-serializer');

describe('Redis Serialization', () => {
  
  describe('Buffer Serialization', () => {
    test('should serialize and deserialize Buffer objects', () => {
      const buffer = Buffer.from('test data', 'utf8');
      const serialized = serializeForRedis({ data: buffer });
      const deserialized = deserializeFromRedis(serialized);
      
      expect(Buffer.isBuffer(deserialized.data)).toBe(true);
      expect(deserialized.data.toString()).toBe('test data');
    });
  });

  describe('Uint8Array Serialization', () => {
    test('should serialize and deserialize Uint8Array objects', () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
      const serialized = serializeForRedis({ data: uint8Array });
      const deserialized = deserializeFromRedis(serialized);
      
      expect(deserialized.data instanceof Uint8Array).toBe(true);
      expect(Array.from(deserialized.data)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Date Serialization', () => {
    test('should serialize and deserialize Date objects', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      const serialized = serializeForRedis({ timestamp: date });
      const deserialized = deserializeFromRedis(serialized);
      
      expect(deserialized.timestamp instanceof Date).toBe(true);
      expect(deserialized.timestamp.getTime()).toBe(date.getTime());
    });
  });

  describe('Embedding Vector Serialization', () => {
    test('should serialize and deserialize embedding vectors', () => {
      const embeddings = new Array(768).fill(0).map(() => Math.random());
      const serialized = serializeForRedis({ embeddings });
      const deserialized = deserializeFromRedis(serialized);
      
      expect(Array.isArray(deserialized.embeddings)).toBe(true);
      expect(deserialized.embeddings.length).toBe(768);
      expect(deserialized.embeddings[0]).toBeCloseTo(embeddings[0], 10);
    });
  });

  describe('Complex Job Data', () => {
    test('should sanitize BullMQ job data properly', () => {
      const complexJobData = {
        id: 'test-job-1',
        type: 'embedding_generation',
        data: {
          text: 'Test document content',
          buffer: Buffer.from('binary data'),
          embeddings: new Array(384).fill(0.5),
          timestamp: new Date(),
          nested: {
            uint8Array: new Uint8Array([10, 20, 30]),
            metadata: {
              userId: 'user123',
              caseId: 'case456'
            }
          }
        },
        metadata: {
          deadline: new Date(Date.now() + 86400000) // 1 day from now
        }
      };

      const sanitized = sanitizeJobData(complexJobData);
      
      // Should be JSON serializable
      expect(isSerializable(sanitized)).toBe(true);
      
      // Verify structure is preserved
      expect(sanitized.id).toBe('test-job-1');
      expect(sanitized.data.text).toBe('Test document content');
      expect(Array.isArray(sanitized.data.embeddings)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle circular references', () => {
      const objA = { name: 'A' };
      const objB = { name: 'B', ref: objA };
      objA.ref = objB; // Create circular reference

      const safeCopy = createSafeCopy({ circular: objA });
      expect(isSerializable(safeCopy)).toBe(true);
    });

    test('should handle functions by removing them', () => {
      const objWithFunction = {
        data: 'test',
        fn: () => console.log('test'),
        nested: {
          anotherFn: function() { return 'hello'; }
        }
      };

      const safeCopy = createSafeCopy(objWithFunction);
      expect(safeCopy.data).toBe('test');
      expect(safeCopy.fn).toBeUndefined();
      expect(safeCopy.nested.anotherFn).toBeUndefined();
    });
  });

  describe('Agent Workflow Job Results', () => {
    test('should handle typical agent result objects', () => {
      const agentResult = {
        jobId: 'job-12345',
        success: true,
        result: {
          embeddings: new Float32Array([0.1, 0.2, 0.3, 0.4]),
          analysis: 'Legal analysis complete',
          generatedAt: new Date(),
          documents: [{
            template: 'witness-statement',
            content: 'Document content here...',
            generated: new Date()
          }]
        },
        processingTime: 1500,
        agentUsed: 'dolphin-mixtral'
      };

      const sanitized = sanitizeJobResult(agentResult);
      expect(isSerializable(sanitized)).toBe(true);
      expect(sanitized.success).toBe(true);
      expect(sanitized.result.analysis).toBe('Legal analysis complete');
    });
  });

  describe('Real-world Redis Operations', () => {
    test('should handle document ingestion pipeline data', () => {
      const pipelineData = {
        documentId: 'doc-123',
        chunks: [
          {
            text: 'Legal document chunk 1...',
            embeddings: new Array(768).fill().map(() => Math.random()),
            metadata: {
              page: 1,
              position: 0,
              extractedAt: new Date()
            }
          },
          {
            text: 'Legal document chunk 2...',
            embeddings: new Array(768).fill().map(() => Math.random()),
            metadata: {
              page: 1,
              position: 1,
              extractedAt: new Date()
            }
          }
        ],
        ocrData: {
          confidence: 0.95,
          pages: 5,
          processedBuffer: Buffer.from('processed data')
        }
      };

      const safeCopy = createSafeCopy(pipelineData);
      const serialized = serializeForRedis(safeCopy);
      const deserialized = deserializeFromRedis(serialized);

      expect(deserialized.documentId).toBe('doc-123');
      expect(deserialized.chunks.length).toBe(2);
      expect(Array.isArray(deserialized.chunks[0].embeddings)).toBe(true);
      expect(Buffer.isBuffer(deserialized.ocrData.processedBuffer)).toBe(true);
    });
  });
});

// Helper test to verify our fixes solve the original problem
describe('BullMQ Integration Test', () => {
  test('should prevent Redis serialization errors in job queue', () => {
    // This simulates what would happen in BullMQ when adding a job
    const problematicJobData = {
      type: 'embedding_generation',
      data: {
        text: 'Document to process',
        buffer: Buffer.from('file content'),
        embeddings: new Float64Array([0.1, 0.2, 0.3]),
        metadata: {
          uploadedAt: new Date(),
          fileInfo: {
            size: 1024,
            type: 'application/pdf'
          }
        }
      }
    };

    // Before: This would cause Redis serialization error
    expect(() => JSON.stringify(problematicJobData)).toThrow();

    // After: Our sanitization should make it safe
    const sanitized = sanitizeJobData(createSafeCopy(problematicJobData));
    expect(() => JSON.stringify(sanitized)).not.toThrow();
    
    // Verify the sanitized data is equivalent
    expect(sanitized.type).toBe('embedding_generation');
    expect(sanitized.data.text).toBe('Document to process');
    expect(Array.isArray(sanitized.data.embeddings)).toBe(true);
  });
});