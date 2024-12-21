import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server } from '../src/core/server/server';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Request,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';

import { ContextManager } from '../src/core/context';
import { MemoryStore, MemoryMetadata, MemoryOperationResponse } from '../src/core/types/store';
import { VectorStore } from '../src/core/types/vector';
import { ContextEntry, ContextMetadata } from '../src/core/types/context';
import { VectorOperationResponse } from '../src/core/types/vector';

// Mock implementations
class MockVectorStore implements VectorStore {
  async initialize() {
    return { success: true };
  }

  getConnectionStatus() {
    return { isConnected: true, lastError: null };
  }

  async testConnection() {
    return { success: true };
  }

  async upsertVectors() {
    return { success: true };
  }

  async queryVectors() {
    return { success: true, results: [] };
  }

  async deleteVectors() {
    return { success: true };
  }

  dispose() {}
}

class MockMemoryStore implements MemoryStore {
  private memories: Map<string, ContextEntry> = new Map();
  private connectionFailure: boolean = false;

  async storeMemory(content: string, metadata: MemoryMetadata) {
    if (this.connectionFailure) {
      return { success: false, error: 'Connection failure' };
    }
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
    if (this.connectionFailure) {
      return { success: false, error: 'Connection failure' };
    }

    const memories = Array.from(this.memories.values())
      .filter(entry => {
        if (!options?.filter) return true;
        return Object.entries(options.filter).every(([key, value]) => {
          return entry.metadata[key] === value;
        });
      })
      .map(entry => ({
        content: entry.content,
        metadata: {
          id: entry.id,
          type: entry.metadata.type,
          timestamp: entry.metadata.timestamp,
          tags: entry.metadata.tags,
          vector: entry.vector
        },
        score: 1.0
      }))
      .slice(0, options?.topK || 10);

    return { success: true, memories };
  }

  async deleteMemories(ids: string[]) {
    if (this.connectionFailure) {
      return { success: false, error: 'Connection failure' };
    }
    ids.forEach(id => this.memories.delete(id));
    return { success: true };
  }

  async trackRelationship() {
    if (this.connectionFailure) {
      return { success: false, error: 'Connection failure' };
    }
    return { success: true };
  }

  async getRelatedMemories() {
    if (this.connectionFailure) {
      return { success: false, error: 'Connection failure' };
    }
    return { success: true, related: [] };
  }

  simulateConnectionFailure(failure: boolean) {
    this.connectionFailure = failure;
  }
}

describe('MCP Server', () => {
  let vectorStore: MockVectorStore;
  let memoryStore: MockMemoryStore;
  let contextManager: ContextManager;
  let server: Server;

  beforeEach(async () => {
    vectorStore = new MockVectorStore();
    memoryStore = new MockMemoryStore();
    contextManager = new ContextManager(vectorStore, memoryStore);
    server = new Server(contextManager);
  });

  describe('Tool Handling', () => {
    it('should handle add_memory tool requests', async () => {
      const request = {
        method: 'tool',
        params: {
          name: 'add_memory',
          arguments: {
            content: 'Test memory',
            type: 'note',
            tags: ['test']
          }
        }
      };

      const response = await server.processToolRequest(request);
      expect(response).toBeDefined();
      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);
    });

    it('should handle search_memories tool requests', async () => {
      const request = {
        method: 'tool',
        params: {
          name: 'search_memories',
          arguments: {
            query: 'test'
          }
        }
      };

      const response = await server.processToolRequest(request);
      expect(response).toBeDefined();
      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.memories)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle store operation failures', async () => {
      memoryStore.simulateConnectionFailure(true);
      const request = {
        method: 'tool',
        params: {
          name: 'add_memory',
          arguments: {
            content: 'Test memory',
            type: 'note'
          }
        }
      };

      const response = await server.processToolRequest(request);
      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle search operation failures', async () => {
      memoryStore.simulateConnectionFailure(true);
      const request = {
        method: 'tool',
        params: {
          name: 'search_memories',
          arguments: {
            query: 'test'
          }
        }
      };

      const response = await server.processToolRequest(request);
      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => ({
        method: 'tool',
        params: {
          name: 'add_memory',
          arguments: {
            content: 'Test memory',
            type: 'note'
          }
        }
      }));

      const responses = await Promise.all(
        requests.map(request => server.processToolRequest(request))
      );

      responses.forEach(response => {
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
      });
    });

    it('should maintain performance under load', async () => {
      const requests = Array(50).fill(null).map(() => ({
        method: 'tool',
        params: {
          name: 'add_memory',
          arguments: {
            content: 'Test memory',
            type: 'note'
          }
        }
      }));
      
      const responses = await Promise.all(
        requests.map(request => server.processToolRequest(request))
      );

      responses.forEach(response => {
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Integration', () => {
    it('should maintain data consistency across operations', async () => {
      const addRequest = {
        method: 'tool',
        params: {
          name: 'add_memory',
          arguments: {
            content: 'Test memory',
            type: 'note',
            tags: ['test']
          }
        }
      };

      await server.processToolRequest(addRequest);

      // Search for the added memory
      const searchRequest = {
        method: 'tool',
        params: {
          name: 'search_memories',
          arguments: {
            query: 'test'
          }
        }
      };

      const response = await server.processToolRequest(searchRequest);
      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toBe('Test memory');
    });
  });
});
