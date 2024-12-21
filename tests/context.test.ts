import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../src/core/context';
import { VectorStore } from '../src/core/types/vector';
import { MemoryStore, MemoryMetadata, MemoryOperationResponse } from '../src/core/types/store';
import { VectorData, VectorOperationResponse, VectorSearchResult } from '../src/core/types/vector';
import { ContextEntry, ContextMetadata, ContextSearchResult } from '../src/core/types/context';

// Mock implementations
class MockVectorStore implements VectorStore {
  private vectors: Map<string, VectorData> = new Map();

  async initialize() {
    return { success: true };
  }

  getConnectionStatus() {
    return { isConnected: true, lastError: null };
  }

  async testConnection() {
    return { success: true };
  }

  async upsertVectors(vectors: VectorData[]): Promise<VectorOperationResponse> {
    vectors.forEach(v => {
      this.vectors.set(v.id, v);
    });
    return { success: true };
  }

  async queryVectors(
    queryVector: number[],
    options?: { topK?: number; filter?: Record<string, any> }
  ): Promise<VectorOperationResponse & { results?: VectorSearchResult[] }> {
    // Simulate vector similarity search with cosine similarity
    const results = Array.from(this.vectors.entries()).map(([id, data]) => {
      // Calculate cosine similarity
      const dotProduct = queryVector.reduce((sum, val, i) => sum + val * data.values[i], 0);
      const magnitude1 = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(data.values.reduce((sum, val) => sum + val * val, 0));
      const similarity = dotProduct / (magnitude1 * magnitude2);
      
      return {
        id,
        values: data.values,
        score: similarity,
        metadata: data.metadata
      };
    });

    // Sort by similarity score in descending order
    results.sort((a, b) => b.score - a.score);

    return {
      success: true,
      results: results.slice(0, options?.topK || results.length)
    };
  }

  async deleteVectors(ids: string[]) {
    ids.forEach(id => {
      this.vectors.delete(id);
    });
    return { success: true };
  }

  dispose() {}
}

class MockMemoryStore implements MemoryStore {
  private memories: Map<string, ContextEntry> = new Map();
  private relationships: Map<string, Set<string>> = new Map();
  private vectorStore: MockVectorStore;

  constructor(vectorStore: MockVectorStore) {
    this.vectorStore = vectorStore;
  }

  async storeMemory(content: string, metadata: MemoryMetadata): Promise<MemoryOperationResponse> {
    const id = metadata?.id || String(this.memories.size);
    const entry: ContextEntry = {
      id,
      content,
      vector: metadata?.vector || [],
      metadata: {
        type: metadata.type,
        timestamp: metadata.timestamp,
        tags: metadata.tags,
        attributes: metadata
      }
    };
    this.memories.set(id, entry);
    return { success: true };
  }

  async retrieveMemories(
    query: string | number[],
    options?: { topK?: number; filter?: Record<string, any> }
  ): Promise<MemoryOperationResponse> {
    let entries = Array.from(this.memories.values());
    let searchResults: ContextSearchResult[] = [];
    
    if (Array.isArray(query)) {
      // Vector query - use vector similarity
      const vectorResults = await this.vectorStore.queryVectors(query, options);
      if (!vectorResults.success) {
        return { success: false, error: 'Vector query failed' };
      }

      // Map vector results to search results with scores
      searchResults = (vectorResults.results || []).map(result => {
        const entry = this.memories.get(result.id);
        if (!entry) return null;
        return {
          entry,
          score: result.score
        };
      }).filter((r): r is ContextSearchResult => r !== null);
    } else {
      // Text query - return all entries with default scoring
      searchResults = entries.map(entry => ({
        entry,
        score: 0.5 // Default score for text queries
      }));
    }

    // Apply time range filter if provided
    const timeRange = options?.filter?.timeRange as { start: number; end: number } | undefined;
    if (timeRange) {
      const { start, end } = timeRange;
      searchResults = searchResults.filter(result => {
        const timestamp = result.entry.metadata.timestamp;
        return timestamp && timestamp >= start && timestamp <= end;
      });
    }

    // Sort by score in descending order
    searchResults.sort((a, b) => b.score - a.score);
    
    // Transform search results into expected memory format
    const memories = searchResults.slice(0, options?.topK || searchResults.length)
      .map(result => ({
        content: result.entry.content,
        metadata: {
          id: result.entry.id,
          type: result.entry.metadata.type,
          timestamp: result.entry.metadata.timestamp,
          tags: result.entry.metadata.tags,
          score: result.score
        }
      }));

    return {
      success: true,
      memories
    };
  }

  async deleteMemories(ids: string[]) {
    ids.forEach(id => {
      this.memories.delete(id);
      // Also clean up relationships
      this.relationships.delete(id);
      this.relationships.forEach(related => related.delete(id));
    });
    return { success: true };
  }

  async trackRelationship(sourceId: string, targetId: string, relationship: string) {
    if (!this.relationships.has(sourceId)) {
      this.relationships.set(sourceId, new Set());
    }
    this.relationships.get(sourceId)!.add(targetId);
    return { success: true };
  }

  async getRelatedMemories(memoryId: string, relationship?: string) {
    const related = this.relationships.get(memoryId);
    if (!related) {
      return { success: true, related: [] };
    }
    return {
      success: true,
      related: Array.from(related).map(id => ({ id, relationship: relationship || 'related' }))
    };
  }
}

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let vectorStore: MockVectorStore;
  let memoryStore: MockMemoryStore;

  beforeEach(() => {
    vectorStore = new MockVectorStore();
    memoryStore = new MockMemoryStore(vectorStore);
    contextManager = new ContextManager(vectorStore, memoryStore);
  });

  describe('addContext', () => {
    it('should successfully add a context entry', async () => {
      const entry: ContextEntry = {
        id: 'test1',
        content: 'Test content',
        vector: [0.1, 0.2, 0.3],
        metadata: {
          type: 'test',
          timestamp: Date.now(),
          tags: ['test']
        }
      };

      const result = await contextManager.addContext(entry);
      expect(result.success).toBe(true);

      // Verify the entry was stored
      const retrieveResult = await contextManager.retrieveContext([0.1, 0.2, 0.3]);
      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.contexts![0].entry.content).toBe(entry.content);
    });

    it('should handle relationships when adding context', async () => {
      const entry: ContextEntry = {
        id: 'test2',
        content: 'Test content with relationships',
        vector: [0.1, 0.2, 0.3],
        metadata: {
          type: 'test',
          timestamp: Date.now(),
          relationships: [
            { targetId: 'related1', type: 'references', strength: 0.8 }
          ]
        }
      };

      const result = await contextManager.addContext(entry);
      expect(result.success).toBe(true);

      // Verify the entry was stored with relationships
      const retrieveResult = await contextManager.retrieveContext([0.1, 0.2, 0.3]);
      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.contexts![0].entry.metadata.relationships).toBeDefined();
    });
  });

  describe('retrieveContext', () => {
    it('should retrieve context based on vector similarity', async () => {
      // Add test context first
      const entry: ContextEntry = {
        id: 'test3',
        content: 'Retrievable content',
        vector: [0.4, 0.5, 0.6],
        metadata: {
          type: 'test',
          timestamp: Date.now()
        }
      };
      await contextManager.addContext(entry);

      // Add another entry to ensure we get multiple results
      await contextManager.addContext({
        id: 'test4',
        content: 'Another content',
        vector: [0.4, 0.5, 0.7],
        metadata: {
          type: 'test',
          timestamp: Date.now()
        }
      });

      const result = await contextManager.retrieveContext([0.4, 0.5, 0.6]);
      expect(result.success).toBe(true);
      expect(result.contexts).toBeDefined();
      expect(result.contexts!.length).toBeGreaterThan(0);
      expect(result.contexts![0].entry.content).toBe('Retrievable content');
    });

    it('should filter results by time range', async () => {
      const now = Date.now();
      const entry: ContextEntry = {
        id: 'test4',
        content: 'Time-based content',
        vector: [0.7, 0.8, 0.9],
        metadata: {
          type: 'test',
          timestamp: now
        }
      };
      await contextManager.addContext(entry);

      // Add another entry outside the time range
      await contextManager.addContext({
        id: 'test5',
        content: 'Old content',
        vector: [0.7, 0.8, 0.9],
        metadata: {
          type: 'test',
          timestamp: now - 2000
        }
      });

      const result = await contextManager.retrieveContext([0.7, 0.8, 0.9], {
        timeRange: {
          start: now - 1000,
          end: now + 1000
        }
      });

      expect(result.success).toBe(true);
      expect(result.contexts).toBeDefined();
      expect(result.contexts!.length).toBeGreaterThan(0);
      expect(result.contexts![0].entry.content).toBe('Time-based content');
    });
  });

  describe('updateContextMetadata', () => {
    it('should update context metadata', async () => {
      // Add initial context
      const entry: ContextEntry = {
        id: 'test5',
        content: 'Updatable content',
        vector: [1.1, 1.2, 1.3],
        metadata: {
          type: 'test',
          timestamp: Date.now()
        }
      };
      await contextManager.addContext(entry);

      // Update metadata
      const updateResult = await contextManager.updateContextMetadata('test5', {
        tags: ['updated'],
        type: 'modified'
      });

      expect(updateResult.success).toBe(true);

      // Verify the update
      const retrieveResult = await contextManager.retrieveContext([1.1, 1.2, 1.3]);
      expect(retrieveResult.contexts![0].entry.metadata.tags).toContain('updated');
      expect(retrieveResult.contexts![0].entry.metadata.type).toBe('modified');
    });
  });

  describe('deleteContext', () => {
    it('should delete context and its relationships', async () => {
      // Add context with relationships
      const entry: ContextEntry = {
        id: 'test6',
        content: 'Deletable content',
        vector: [1.4, 1.5, 1.6],
        metadata: {
          type: 'test',
          timestamp: Date.now(),
          relationships: [
            { targetId: 'related2', type: 'references', strength: 0.7 }
          ]
        }
      };
      await contextManager.addContext(entry);

      // Delete context
      const deleteResult = await contextManager.deleteContext('test6');
      expect(deleteResult.success).toBe(true);

      // Verify deletion
      const retrieveResult = await contextManager.retrieveContext([1.4, 1.5, 1.6]);
      expect(retrieveResult.contexts?.length).toBe(0);
    });
  });
});
