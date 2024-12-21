import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../src/core/context';
import { MockVectorStore, MockMemoryStore } from './mocks/stores';
import { generateTestData, testVectors } from './fixtures/test-data';

describe('Performance Tests', () => {
  let contextManager: ContextManager;
  let vectorStore: MockVectorStore;
  let memoryStore: MockMemoryStore;

  beforeEach(() => {
    vectorStore = new MockVectorStore();
    memoryStore = new MockMemoryStore();
    contextManager = new ContextManager(vectorStore, memoryStore);
  });

  describe('Batch Operations', () => {
    it('should handle large batch insertions efficiently', async () => {
      const testData = generateTestData(1000);
      const startTime = performance.now();

      for (const entry of testData) {
        await contextManager.addContext(entry);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (testData.length / duration) * 1000;

      expect(duration).toBeLessThan(10000); // 10 seconds max
      expect(operationsPerSecond).toBeGreaterThan(50); // At least 50 ops/sec
    });

    it('should handle concurrent operations efficiently', async () => {
      const testData = generateTestData(100);
      const startTime = performance.now();

      await Promise.all(
        testData.map(entry => contextManager.addContext(entry))
      );

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (testData.length / duration) * 1000;

      expect(duration).toBeLessThan(2000); // 2 seconds max
      expect(operationsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec
    });
  });

  describe('Query Performance', () => {
    beforeEach(async () => {
      // Insert test data
      const testData = generateTestData(100);
      await Promise.all(
        testData.map(entry => contextManager.addContext(entry))
      );
    });

    it('should perform vector similarity searches efficiently', async () => {
      const startTime = performance.now();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await contextManager.retrieveContext(testVectors.queryVector, {
          topK: 10
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const searchesPerSecond = (iterations / duration) * 1000;

      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(searchesPerSecond).toBeGreaterThan(10); // At least 10 searches/sec
    });

    it('should handle filtered searches efficiently', async () => {
      const startTime = performance.now();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await contextManager.retrieveContext(testVectors.queryVector, {
          topK: 10,
          filter: {
            type: 'note',
            tags: ['performance']
          }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const searchesPerSecond = (iterations / duration) * 1000;

      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(searchesPerSecond).toBeGreaterThan(10); // At least 10 searches/sec
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const testData = generateTestData(5000);

      await Promise.all(
        testData.map(entry => contextManager.addContext(entry))
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(100); // Less than 100MB increase
    });

    it('should clean up resources properly', async () => {
      const testData = generateTestData(1000);
      await Promise.all(
        testData.map(entry => contextManager.addContext(entry))
      );

      const initialMemory = process.memoryUsage().heapUsed;
      
      // Delete all test data
      await Promise.all(
        testData.map(entry => contextManager.deleteContext(entry.id))
      );

      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDifferenceMB = Math.abs(finalMemory - initialMemory) / 1024 / 1024;

      expect(memoryDifferenceMB).toBeLessThan(10); // Memory difference should be minimal
    });
  });

  describe('Connection Resilience', () => {
    it('should handle connection interruptions gracefully', async () => {
      const testData = generateTestData(10);
      
      // Simulate connection failure
      vectorStore.simulateConnectionFailure(true);

      const results = await Promise.allSettled(
        testData.map(entry => contextManager.addContext(entry))
      );

      const failedOperations = results.filter(r => r.status === 'rejected');
      expect(failedOperations.length).toBe(testData.length);
      
      // Restore connection
      vectorStore.simulateConnectionFailure(false);

      // Retry operations
      const retryResults = await Promise.all(
        testData.map(entry => contextManager.addContext(entry))
      );

      expect(retryResults.every(r => r.success)).toBe(true);
    });

    it('should maintain performance during intermittent failures', async () => {
      const testData = generateTestData(100);
      let successfulOperations = 0;
      const startTime = performance.now();

      for (const entry of testData) {
        // Randomly simulate connection issues
        vectorStore.simulateConnectionFailure(Math.random() < 0.2);
        
        try {
          await contextManager.addContext(entry);
          successfulOperations++;
        } catch (error) {
          // Expected some operations to fail
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(10000); // 10 seconds max
      expect(successfulOperations).toBeGreaterThan(0); // Some operations should succeed
    });
  });
});
