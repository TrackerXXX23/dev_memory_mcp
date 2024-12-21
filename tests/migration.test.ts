import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultMigrationTransformer } from '../src/core/migration/transformer';
import { MigrationService } from '../src/core/migration/service';
import { VectorStore } from '../src/core/types/vector';
import { ContextEntry } from '../src/core/types/context';
import { VectorData, VectorOperationResponse, VectorSearchResult } from '../src/core/types/vector';
import { EmbeddingsService } from '../src/core/utils/embeddings';

// Mock EmbeddingsService
vi.mock('../src/core/utils/embeddings', () => ({
  EmbeddingsService: vi.fn().mockImplementation(() => ({
    generateEmbedding: vi.fn().mockResolvedValue({
      success: true,
      embedding: Array(1536).fill(0.1),
    }),
  })),
}));

// Mock VectorStore
class MockVectorStore implements VectorStore {
  private vectors: Map<string, VectorData> = new Map();
  private isConnected: boolean = false;
  private lastError: string | null = null;
  private isDisposed: boolean = false;

  async initialize(): Promise<VectorOperationResponse> {
    try {
      await this.dispose();
      this.isDisposed = false;
      const testResult = await this.testConnection();
      if (!testResult.success) {
        return testResult;
      }
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Failed to initialize';
      return { success: false, error: this.lastError };
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected && !this.isDisposed,
      lastError: this.lastError
    };
  }

  async testConnection(): Promise<VectorOperationResponse> {
    try {
      if (this.isDisposed) {
        throw new Error('Store not initialized or disposed');
      }
      this.isConnected = true;
      this.lastError = null;
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Connection test failed';
      return { success: false, error: this.lastError };
    }
  }

  async upsertVectors(vectors: VectorData[]): Promise<VectorOperationResponse> {
    try {
      if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
        return { success: false, error: 'No vectors provided' };
      }

      for (const vector of vectors) {
        if (!vector.id || !Array.isArray(vector.values) || vector.values.length === 0) {
          return { success: false, error: 'Invalid vector format' };
        }
      }

      if (!this.isConnected || this.isDisposed) {
        return { success: false, error: 'Not connected to store' };
      }

      vectors.forEach(v => {
        this.vectors.set(v.id, {
          ...v,
          metadata: v.metadata ? {
            ...v.metadata,
            _updated: new Date().toISOString()
          } : {
            _updated: new Date().toISOString()
          }
        });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to upsert vectors' };
    }
  }

  async queryVectors(
    queryVector: number[],
    options?: { topK?: number; filter?: Record<string, any> }
  ): Promise<VectorOperationResponse & { results?: VectorSearchResult[] }> {
    try {
      if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
        return { success: false, error: 'Invalid query vector' };
      }

      if (!this.isConnected || this.isDisposed) {
        return { success: false, error: 'Not connected to store' };
      }

      const results = Array.from(this.vectors.values())
        .map(vector => ({
          id: vector.id,
          score: 1.0,
          metadata: vector.metadata || {}
        }))
        .slice(0, options?.topK || 10);

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to query vectors' };
    }
  }

  async deleteVectors(ids: string[]): Promise<VectorOperationResponse> {
    try {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'No vector IDs provided' };
      }

      if (ids.some(id => typeof id !== 'string' || !id)) {
        return { success: false, error: 'Invalid vector ID format' };
      }

      if (!this.isConnected || this.isDisposed) {
        return { success: false, error: 'Not connected to store' };
      }

      ids.forEach(id => this.vectors.delete(id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete vectors' };
    }
  }

  async dispose(): Promise<VectorOperationResponse> {
    try {
      this.isDisposed = true;
      this.isConnected = false;
      this.lastError = null;
      this.vectors.clear();
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Failed to dispose';
      this.vectors.clear();
      return { success: false, error: this.lastError };
    }
  }

  // Helper for testing
  getVectorCount(): number {
    return this.vectors.size;
  }
}

describe('Migration Tools', () => {
  let transformer: DefaultMigrationTransformer;
  let vectorStore: MockVectorStore;
  let migrationService: MigrationService;

  const testMemory: ContextEntry = {
    id: 'test-1',
    content: 'Test memory content',
    metadata: {
      type: 'note',
      timestamp: Date.now(),
      tags: ['test'],
      source: 'test',
      relationships: [{ targetId: 'test-2', type: 'related', strength: 1 }],
      attributes: { key: 'value' },
    },
  };

  beforeEach(async () => {
    transformer = new DefaultMigrationTransformer('test-api-key');
    vectorStore = new MockVectorStore();
    migrationService = new MigrationService('test-api-key', vectorStore);
    await vectorStore.initialize();
  });

  describe('DefaultMigrationTransformer', () => {
    it('should transform memory to vector format', async () => {
      const vector = await transformer.memoryToVector(testMemory);

      expect(vector.id).toBe(testMemory.id);
      expect(vector.metadata).toBeDefined();
      expect(vector.metadata?.content).toBe(testMemory.content);
      expect(vector.metadata?.type).toBe(testMemory.metadata.type);
      expect(vector.values).toHaveLength(1536);
    });

    it('should transform vector back to memory format', async () => {
      const vector = await transformer.memoryToVector(testMemory);
      const memory = await transformer.vectorToMemory(vector);

      expect(memory.id).toBe(testMemory.id);
      expect(memory.content).toBe(testMemory.content);
      expect(memory.metadata.type).toBe(testMemory.metadata.type);
      expect(memory.metadata.tags).toEqual(testMemory.metadata.tags);
    });

    it('should validate transformations', async () => {
      const vector = await transformer.memoryToVector(testMemory);
      const isValid = await transformer.validate(testMemory, vector);

      expect(isValid).toBe(true);
    });
  });

  describe('MigrationService', () => {
    it('should migrate memories to vector storage', async () => {
      const result = await migrationService.migrate([testMemory]);

      expect(result.success).toBe(true);
      expect(result.progress.total).toBe(1);
      expect(result.progress.processed).toBe(1);
      expect(result.progress.failed).toBe(0);
      expect(vectorStore.getVectorCount()).toBe(1);
    });

    it('should handle validation-only mode', async () => {
      const result = await migrationService.migrate([testMemory], { validateOnly: true });

      expect(result.success).toBe(true);
      expect(result.progress.processed).toBe(1);
      expect(vectorStore.getVectorCount()).toBe(0);
    });

    it('should handle batch processing', async () => {
      const memories = Array(5).fill(null).map((_, i) => ({
        ...testMemory,
        id: `test-${i}`,
      }));

      const result = await migrationService.migrate(memories, { batchSize: 2 });

      expect(result.success).toBe(true);
      expect(result.progress.total).toBe(5);
      expect(result.progress.processed).toBe(5);
      expect(vectorStore.getVectorCount()).toBe(5);
    });

    it('should handle rollback on error', async () => {
      const badMemory: ContextEntry = {
        ...testMemory,
        id: 'bad-memory',
        metadata: {
          type: 'invalid',
          timestamp: -1 // This will cause validation to fail
        }
      };

      const result = await migrationService.migrate(
        [testMemory, badMemory],
        { rollbackOnError: true }
      );

      expect(result.success).toBe(false);
      expect(result.rollbackRequired).toBe(true);
      expect(vectorStore.getVectorCount()).toBe(0);
    });

    it('should track migration progress', async () => {
      await migrationService.migrate([testMemory]);

      const snapshots = migrationService.getSnapshots();
      const latestSnapshot = migrationService.getLatestSnapshot();

      expect(snapshots.length).toBeGreaterThan(0);
      expect(latestSnapshot?.state).toBe('completed');
      expect(latestSnapshot?.progress.processed).toBe(1);
    });

    it('should handle store connection failures', async () => {
      await vectorStore.dispose();
      const result = await migrationService.migrate([testMemory]);
      expect(result.success).toBe(false);
      expect(result.progress.errors.length).toBeGreaterThan(0);
      expect(result.progress.failed).toBe(1);
    });
  });
});
