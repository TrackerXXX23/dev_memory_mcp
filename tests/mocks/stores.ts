import { VectorStore } from '../../src/core/types/vector';
import { MemoryStore, MemoryOperationResponse, MemoryMetadata, MemoryQueryResult } from '../../src/core/types/store';
import { ContextEntry, ContextMetadata } from '../../src/core/types/context';
import { VectorData, VectorOperationResponse, VectorSearchResult } from '../../src/core/types/vector';

export class MockVectorStore implements VectorStore {
  private vectors: Map<string, VectorData> = new Map();
  private isConnectionFailing: boolean = false;
  private isConnected: boolean = false;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private isDisposed: boolean = false;
  private lastError: string | null = null;

  constructor() {
    this.isConnected = false; // Start disconnected like real store
  }

  simulateConnectionFailure(shouldFail: boolean) {
    this.isConnectionFailing = shouldFail;
    if (shouldFail) {
      this.isConnected = false;
      this.lastError = 'Connection failed';
    }
  }

  async initialize(): Promise<VectorOperationResponse> {
    try {
      // Clear any existing state
      await this.dispose();

      // Reset disposed flag
      this.isDisposed = false;

      if (this.isConnectionFailing) {
        this.isConnected = false;
        this.lastError = 'Connection failed';
        return { success: false, error: this.lastError };
      }

      // Test connection
      const testResult = await this.testConnection();
      if (!testResult.success) {
        return testResult;
      }

      // Start connection monitoring
      this.startConnectionMonitoring();
      
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

      if (this.isConnectionFailing) {
        this.isConnected = false;
        this.lastError = 'Connection failed';
        return { success: false, error: this.lastError };
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
      // Input validation
      if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
        return { success: false, error: 'No vectors provided' };
      }

      // Validate vector format
      for (const vector of vectors) {
        if (!vector.id || !Array.isArray(vector.values) || vector.values.length === 0) {
          return { success: false, error: 'Invalid vector format' };
        }
      }

      // Connection check
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
      // Input validation
      if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
        return { success: false, error: 'Invalid query vector' };
      }

      // Connection check
      if (!this.isConnected || this.isDisposed) {
        return { success: false, error: 'Not connected to store' };
      }

      // Calculate cosine similarity for all vectors
      const results = Array.from(this.vectors.values())
        .map(vector => {
          const similarity = this.calculateCosineSimilarity(queryVector, vector.values);
          return {
            id: vector.id,
            score: similarity,
            metadata: vector.metadata || {}
          };
        })
        // Apply filter if provided
        .filter(result => {
          if (!options?.filter) return true;
          return Object.entries(options.filter).every(([key, value]) => {
            return result.metadata?.[key] === value;
          });
        })
        // Sort by similarity score
        .sort((a, b) => b.score - a.score)
        // Limit results if topK specified
        .slice(0, options?.topK || 10);

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to query vectors' };
    }
  }

  async deleteVectors(ids: string[]): Promise<VectorOperationResponse> {
    try {
      // Input validation
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: 'No vector IDs provided' };
      }

      // Validate ID format
      if (ids.some(id => typeof id !== 'string' || !id)) {
        return { success: false, error: 'Invalid vector ID format' };
      }

      // Connection check
      if (!this.isConnected || this.isDisposed) {
        return { success: false, error: 'Not connected to store' };
      }

      ids.forEach(id => this.vectors.delete(id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete vectors' };
    }
  }

  private startConnectionMonitoring(): void {
    // Clear any existing interval
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    // Start new monitoring interval
    this.connectionCheckInterval = setInterval(async () => {
      if (this.isDisposed) {
        if (this.connectionCheckInterval) {
          clearInterval(this.connectionCheckInterval);
          this.connectionCheckInterval = null;
        }
        return;
      }

      try {
        await this.testConnection();
      } catch (error) {
        this.isConnected = false;
        this.lastError = error instanceof Error ? error.message : 'Connection test failed';
      }
    }, 30000);

    // Ensure cleanup on process exit
    process.on('beforeExit', () => {
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }
    });
  }

  async dispose(): Promise<VectorOperationResponse> {
    try {
      // Mark as disposed first to prevent new operations
      this.isDisposed = true;

      // Clear monitoring interval
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }

      // Reset state
      this.isConnected = false;
      this.lastError = null;
      this.vectors.clear();

      return { success: true };
    } catch (error) {
      // Ensure cleanup even on error
      this.connectionCheckInterval = null;
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Failed to dispose';
      this.vectors.clear();

      return { 
        success: false, 
        error: this.lastError 
      };
    }
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export class MockMemoryStore implements MemoryStore {
  private memories: Map<string, ContextEntry> = new Map();
  private relationships: Map<string, Map<string, string>> = new Map();

  async storeMemory(content: string, metadata: MemoryMetadata): Promise<MemoryOperationResponse> {
    try {
      const id = metadata.id;
      const contextMetadata: ContextMetadata = {
        type: metadata.type,
        timestamp: metadata.timestamp,
        tags: metadata.tags || [],
        relationships: metadata.relationships || [],
        attributes: metadata
      };

      const entry: ContextEntry = {
        id,
        content,
        vector: metadata.vector,
        metadata: contextMetadata
      };

      this.memories.set(id, entry);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to store memory'
      };
    }
  }

  async retrieveMemories(
    query: string | number[],
    options?: { topK?: number; filter?: Record<string, any> }
  ): Promise<MemoryOperationResponse> {
    try {
      const memories: MemoryQueryResult[] = Array.from(this.memories.values())
        .filter(entry => {
          if (!options?.filter) return true;
          return Object.entries(options.filter).every(([key, value]) => {
            if (key === 'timeRange') {
              const { start, end } = value as { start: number; end: number };
              return entry.metadata.timestamp >= start && entry.metadata.timestamp <= end;
            }
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
            vector: entry.vector,
            relationships: entry.metadata.relationships
          },
          score: 1.0
        }))
        .slice(0, options?.topK || 10);

      return { success: true, memories };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve memories'
      };
    }
  }

  async deleteMemories(ids: string[]): Promise<MemoryOperationResponse> {
    try {
      ids.forEach(id => {
        this.memories.delete(id);
        // Clean up relationships
        this.relationships.delete(id);
        this.relationships.forEach(relations => relations.delete(id));
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete memories'
      };
    }
  }

  async trackRelationship(
    sourceId: string,
    targetId: string,
    type: string
  ): Promise<MemoryOperationResponse> {
    try {
      if (!this.relationships.has(sourceId)) {
        this.relationships.set(sourceId, new Map());
      }
      this.relationships.get(sourceId)!.set(targetId, type);

      // Update memory metadata
      const memory = this.memories.get(sourceId);
      if (memory) {
        memory.metadata.relationships = memory.metadata.relationships || [];
        memory.metadata.relationships.push({
          targetId,
          type,
          strength: 1.0
        });
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to track relationship'
      };
    }
  }

  async getRelatedMemories(
    memoryId: string,
    relationshipTypes?: string
  ): Promise<MemoryOperationResponse> {
    try {
      const relations = this.relationships.get(memoryId);
      if (!relations) {
        return { success: true, related: [] };
      }

      const related = Array.from(relations.entries())
        .filter(([_, type]) => !relationshipTypes || type === relationshipTypes)
        .map(([id, type]) => ({
          id,
          type
        }));

      return { success: true, related };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get related memories'
      };
    }
  }
}
