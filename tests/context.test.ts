import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../src/core/context';
import { VectorStore, MemoryStore } from '../src/core/store';
import { ContextEntry, ContextMetadata } from '../src/core/types/context';

// Mock implementations
class MockVectorStore implements VectorStore {
  private vectors: Map<string, { values: number[]; metadata: any }> = new Map();

  async initialize() {
    return { success: true };
  }

  getConnectionStatus() {
    return { isConnected: true, lastError: null };
  }

  async testConnection() {
    return { success: true };
  }

  async upsertVectors(vectors: any[]) {
    vectors.forEach(v => {
      this.vectors.set(v.id, {
        values: v.values,
        metadata: v.metadata
      });
    });
    return { success: true };
  }

  async queryVectors(queryVector: number[], options?: any) {
    // Return all vectors with a mock similarity score
    return {
      success: true,
      results: Array.from(this.vectors.entries()).map(([id, data]) => ({
        id,
        values: data.values,
        score: 0.9,
        metadata: data.metadata
      }))
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

  async storeMemory(content: string, metadata?: any) {
    const id = metadata?.id || String(this.memories.size);
    const entry: ContextEntry = {
      id,
      content,
      vector: metadata?.vector || [],
      metadata: { ...metadata, id }
    };
    this.memories.set(id, entry);
    return { success: true };
  }

  async retrieveMemories(query: string | number[], options?: any) {
    let memories = Array.from(this.memories.values()).map(entry => ({
      content: entry.content,
      metadata: {
        ...entry.metadata,
        score: 0.9
      },
      entry: {
        id: entry.id,
        content: entry.content,
        vector: entry.vector || [],
        metadata: {
          ...entry.metadata,
          score: 0.9
        }
      }
    }));
    
    // Filter by time range if provided
    if (options?.timeRange) {
      const { start, end } = options.timeRange;
      memories = memories.filter(m => {
        const timestamp = m.entry.metadata.timestamp;
        return timestamp >= start && timestamp <= end;
      });
    }
    
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
    memoryStore = new MockMemoryStore();
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
