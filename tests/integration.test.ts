npm import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../src/core/context';
import { MockVectorStore, MockMemoryStore } from './mocks/stores';
import { testMemories, testVectors, testRequests } from './fixtures/test-data';

describe('Integration Tests', () => {
  let contextManager: ContextManager;
  let vectorStore: MockVectorStore;
  let memoryStore: MockMemoryStore;

  beforeEach(async () => {
    vectorStore = new MockVectorStore();
    memoryStore = new MockMemoryStore();
    contextManager = new ContextManager(vectorStore, memoryStore);
    await vectorStore.initialize();
  });

  describe('End-to-End Memory Operations', () => {
    it('should handle complete memory lifecycle', async () => {
      // Add memories
      for (const memory of testMemories) {
        const result = await contextManager.addContext(memory);
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      }

      // Query memories with different vectors
      const queries = [
        testVectors.queryVector,
        testVectors.sparseVector,
        testVectors.denseVector
      ];

      for (const queryVector of queries) {
        const searchResult = await contextManager.retrieveContext(queryVector, {
          topK: 5,
          includeRelated: true
        });
        expect(searchResult.success).toBe(true);
        expect(searchResult.error).toBeUndefined();
        expect(searchResult.contexts).toBeDefined();
        expect(searchResult.contexts?.length).toBeGreaterThan(0);
      }

      // Update metadata
      const firstMemory = testMemories[0];
      const updateResult = await contextManager.updateContextMetadata(firstMemory.id, {
        tags: [...(firstMemory.metadata.tags || []), 'updated'],
        attributes: {
          ...(firstMemory.metadata.attributes || {}),
          status: 'modified'
        }
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.error).toBeUndefined();

      // Verify update
      const verifyResult = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: { id: firstMemory.id }
      });
      expect(verifyResult.contexts?.[0].entry.metadata.tags).toContain('updated');
      expect(verifyResult.contexts?.[0].entry.metadata.attributes?.status).toBe('modified');

      // Delete memories
      const deleteResult = await contextManager.deleteContext(firstMemory.id);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.error).toBeUndefined();

      // Verify deletion
      const finalResult = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: { id: firstMemory.id }
      });
      expect(finalResult.contexts?.length).toBe(0);
    });

    it('should handle concurrent operations correctly', async () => {
      const operations = testMemories.map(memory => contextManager.addContext(memory));
      const results = await Promise.all(operations);
      
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => !r.error)).toBe(true);

      // Verify all memories were added
      const verifyResult = await contextManager.retrieveContext(testVectors.queryVector, {});
      expect(verifyResult.contexts?.length).toBe(testMemories.length);
    });
  });

  describe('Context Relationships', () => {
    it('should maintain relationship integrity', async () => {
      // Add related memories
      const memory1 = testMemories[0];
      const memory2 = testMemories[1];

      await contextManager.addContext(memory1);
      await contextManager.addContext(memory2);

      // Add relationship
      const relationshipResult = await memoryStore.trackRelationship(
        memory1.id,
        memory2.id,
        'references'
      );
      expect(relationshipResult.success).toBe(true);
      expect(relationshipResult.error).toBeUndefined();

      // Verify relationship
      const relatedResult = await memoryStore.getRelatedMemories(memory1.id);
      expect(relatedResult.success).toBe(true);
      expect(relatedResult.error).toBeUndefined();
      expect(relatedResult.related).toBeDefined();
      expect(relatedResult.related?.[0].id).toBe(memory2.id);

      // Delete source memory
      await contextManager.deleteContext(memory1.id);

      // Verify relationship cleanup
      const cleanupResult = await memoryStore.getRelatedMemories(memory1.id);
      expect(cleanupResult.related?.length).toBe(0);
    });

    it('should handle circular relationships', async () => {
      const [memory1, memory2, memory3] = testMemories;
      const addResults = await Promise.all([
        contextManager.addContext(memory1),
        contextManager.addContext(memory2),
        contextManager.addContext(memory3)
      ]);
      expect(addResults.every(r => r.success)).toBe(true);

      // Create circular relationship
      const relationshipResults = await Promise.all([
        memoryStore.trackRelationship(memory1.id, memory2.id, 'references'),
        memoryStore.trackRelationship(memory2.id, memory3.id, 'references'),
        memoryStore.trackRelationship(memory3.id, memory1.id, 'references')
      ]);
      expect(relationshipResults.every(r => r.success)).toBe(true);

      // Verify relationships
      const result = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: { id: memory1.id },
        includeRelated: true
      });

      expect(result.success).toBe(true);
      expect(result.contexts?.length).toBeGreaterThan(0);

      // Verify circular reference handling
      const relatedMemories = await memoryStore.getRelatedMemories(memory1.id);
      expect(relatedMemories.success).toBe(true);
      expect(relatedMemories.related?.length).toBe(1);
    });

    it('should handle relationship failures gracefully', async () => {
      const memory1 = testMemories[0];
      await contextManager.addContext(memory1);

      // Try to create relationship with non-existent memory
      const relationshipResult = await memoryStore.trackRelationship(
        memory1.id,
        'non-existent-id',
        'references'
      );
      expect(relationshipResult.success).toBe(false);
      expect(relationshipResult.error).toBeDefined();

      // Verify original memory is unchanged
      const verifyResult = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: { id: memory1.id }
      });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.contexts?.[0].entry.metadata.relationships).toBeUndefined();
    });
  });

  describe('Search and Filter Operations', () => {
    beforeEach(async () => {
      // Add test memories
      const results = await Promise.all(
        testMemories.map(memory => contextManager.addContext(memory))
      );
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle complex search queries', async () => {
      const result = await contextManager.retrieveContext(testVectors.queryVector, {
        topK: 5,
        filter: {
          type: 'note',
          tags: ['test'],
          'attributes.status': 'active'
        },
        timeRange: {
          start: Date.now() - 3600000, // Last hour
          end: Date.now()
        }
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.contexts).toBeDefined();
      result.contexts?.forEach(context => {
        expect(context.entry.metadata.type).toBe('note');
        expect(context.entry.metadata.tags).toContain('test');
        expect(context.entry.metadata.timestamp).toBeGreaterThan(Date.now() - 3600000);
        expect(context.entry.metadata.attributes?.status).toBe('active');
      });
    });

    it('should handle invalid search parameters gracefully', async () => {
      const result = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: {
          'invalid.path': 'value'
        }
      });

      expect(result.success).toBe(true);
      expect(result.contexts).toEqual([]);
    });

    it('should handle empty search results correctly', async () => {
      const result = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: {
          type: 'non-existent-type'
        }
      });

      expect(result.success).toBe(true);
      expect(result.contexts).toEqual([]);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle and recover from store failures', async () => {
      // Simulate store failure
      vectorStore.simulateConnectionFailure(true);

      const failedResult = await contextManager.addContext(testMemories[0]);
      expect(failedResult.success).toBe(false);
      expect(failedResult.error).toBeDefined();

      // Recover store
      vectorStore.simulateConnectionFailure(false);
      await vectorStore.initialize();

      const recoveryResult = await contextManager.addContext(testMemories[0]);
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.error).toBeUndefined();
    });

    it('should maintain data consistency during partial failures', async () => {
      // Add initial memory
      const addResult = await contextManager.addContext(testMemories[0]);
      expect(addResult.success).toBe(true);

      // Simulate failure during relationship tracking
      vectorStore.simulateConnectionFailure(true);

      const failedUpdate = await contextManager.updateContextMetadata(testMemories[0].id, {
        relationships: [{ targetId: 'non-existent', type: 'references', strength: 1 }]
      });
      expect(failedUpdate.success).toBe(false);
      expect(failedUpdate.error).toBeDefined();

      // Verify original data remains intact
      vectorStore.simulateConnectionFailure(false);
      await vectorStore.initialize();

      const verifyResult = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: { id: testMemories[0].id }
      });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.contexts?.[0].entry.content).toBe(testMemories[0].content);
    });

    it('should handle reconnection and retry operations', async () => {
      // Add initial memories
      const initialResult = await contextManager.addContext(testMemories[0]);
      expect(initialResult.success).toBe(true);
      
      // Simulate intermittent failures
      const operations = Array(5).fill(null).map(async (_, i) => {
        vectorStore.simulateConnectionFailure(i % 2 === 0);
        if (i % 2 === 0) {
          await vectorStore.initialize();
        }
        return contextManager.addContext({
          ...testMemories[1],
          id: `retry-${i}`
        });
      });

      const results = await Promise.allSettled(operations);
      const successfulOps = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failedOps = results.filter(r => r.status === 'fulfilled' && !r.value.success);

      expect(successfulOps.length).toBeGreaterThan(0);
      expect(failedOps.every(op => op.value.error)).toBe(true);
    });

    it('should handle concurrent failures and recoveries', async () => {
      const operations = testMemories.map(async (memory, i) => {
        vectorStore.simulateConnectionFailure(i % 2 === 0);
        const result = await contextManager.addContext(memory);
        vectorStore.simulateConnectionFailure(false);
        return result;
      });

      const results = await Promise.all(operations);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      expect(successCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
      expect(successCount + failureCount).toBe(testMemories.length);
    });
  });

  describe('Data Validation', () => {
    it('should validate memory content and metadata', async () => {
      // Test invalid requests
      for (const [key, request] of Object.entries(testRequests.addMemory.invalid)) {
        const result = await contextManager.addContext(request as any);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalMemory = {
        id: 'minimal-1',
        content: 'Minimal memory',
        vector: testVectors.queryVector,
        metadata: {
          type: 'note',
          timestamp: Date.now()
        }
      };

      const result = await contextManager.addContext(minimalMemory);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const verifyResult = await contextManager.retrieveContext(testVectors.queryVector, {
        filter: { id: 'minimal-1' }
      });
      expect(verifyResult.contexts?.[0].entry.metadata.tags).toBeUndefined();
      expect(verifyResult.contexts?.[0].entry.metadata.relationships).toBeUndefined();
    });

    it('should validate vector dimensions', async () => {
      const invalidMemory = {
        ...testMemories[0],
        vector: [0.1, 0.2, 0.3] // Wrong dimensions
      };

      const result = await contextManager.addContext(invalidMemory);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed metadata gracefully', async () => {
      const malformedMemory = {
        ...testMemories[0],
        metadata: {
          type: 123, // Wrong type
          timestamp: 'invalid', // Wrong type
          tags: 'not-an-array', // Wrong type
          relationships: {} // Wrong type
        }
      };

      const result = await contextManager.addContext(malformedMemory as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
