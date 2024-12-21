import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PineconeStore } from '../src/core/store/pinecone';
import { VectorStoreConfig } from '../src/core/types/vector';

describe('PineconeStore', () => {
  let store: PineconeStore;
  let mockIndex: any;
  let clearIntervalSpy: any;
  let mockConfig: VectorStoreConfig;

  beforeEach(() => {
    mockConfig = {
      environment: 'test-env',
      apiKey: 'test-key',
      indexName: 'test-index'
    };

    mockIndex = {
      upsert: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
      query: vi.fn().mockResolvedValue({ matches: [{ score: 0.9, id: '1', values: [1, 2, 3], metadata: { test: true } }] }),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
      describeIndexStats: vi.fn().mockResolvedValue({ namespaces: { '': { vectorCount: 100 } } })
    };

    vi.mock('@pinecone-database/pinecone', () => ({
      Pinecone: vi.fn().mockImplementation(() => ({
        index: vi.fn().mockReturnValue(mockIndex)
      }))
    }));

    vi.mock('../src/core/utils/embeddings', () => ({
      EmbeddingsService: vi.fn().mockImplementation(() => ({
        generateEmbedding: vi.fn().mockResolvedValue({ success: true, embedding: [1, 2, 3] })
      }))
    }));

    clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    store = new PineconeStore(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await store.initialize();
      expect(result.success).toBe(true);
      expect(store.getConnectionStatus().isConnected).toBe(true);
    });

    it('should handle initialization failure', async () => {
      mockIndex.describeIndexStats.mockRejectedValueOnce(new Error('The API key you provided was rejected'));
      
      store = new PineconeStore(mockConfig);
      const result = await store.initialize();
      expect(result.success).toBe(false);
      expect(result.error).toContain('The API key you provided was rejected');
      expect(store.getConnectionStatus().isConnected).toBe(false);
    });
  });

  describe('connection status', () => {
    it('should track connection status', async () => {
      await store.initialize();
      const status = store.getConnectionStatus();
      expect(status.isConnected).toBe(true);
      expect(status.lastError).toBeNull();
    });

    it('should update status on connection failure', async () => {
      mockIndex.describeIndexStats.mockRejectedValueOnce(new Error('The API key you provided was rejected'));
      
      store = new PineconeStore(mockConfig);
      await store.initialize();
      const status = store.getConnectionStatus();
      expect(status.isConnected).toBe(false);
      expect(status.lastError).toContain('The API key you provided was rejected');
    });
  });

  describe('vector operations', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should upsert vectors successfully', async () => {
      const vectors = [
        {
          id: '1',
          values: [1, 2, 3],
          metadata: { test: true }
        }
      ];

      const result = await store.upsertVectors(vectors);
      expect(result.success).toBe(true);
      expect(mockIndex.upsert).toHaveBeenCalledWith(vectors);
    });

    it('should query vectors successfully', async () => {
      const result = await store.queryVectors([1, 2, 3]);
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results![0].score).toBe(0.9);
      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: [1, 2, 3],
        topK: 10,
        includeMetadata: undefined
      });
    });

    it('should delete vectors successfully', async () => {
      const result = await store.deleteVectors(['1', '2']);
      expect(result.success).toBe(true);
      expect(mockIndex.deleteMany).toHaveBeenCalledWith(['1', '2']);
    });

    it('should handle operation failures when not connected', async () => {
      store.dispose();
      const result = await store.upsertVectors([]);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No vectors provided');
    });
  });

  describe('connection monitoring', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should monitor connection status periodically', async () => {
      await store.initialize();
      expect(store.getConnectionStatus().isConnected).toBe(true);

      // Mock a connection failure during monitoring
      mockIndex.describeIndexStats.mockRejectedValueOnce(new Error('Connection lost'));
      
      // Fast-forward past the monitoring interval
      await vi.advanceTimersByTime(60000);

      // Connection should be marked as failed
      expect(store.getConnectionStatus().isConnected).toBe(false);
      expect(store.getConnectionStatus().lastError).toBe('Connection test failed');
    });

    it('should cleanup monitoring on dispose', async () => {
      await store.initialize(); // Start monitoring
      store.dispose();
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(store.getConnectionStatus().isConnected).toBe(false);
    });
  });
});
