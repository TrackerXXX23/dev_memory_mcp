/**
 * Pinecone vector store client implementation
 * Handles vector storage operations with connection monitoring and error handling
 */

import { Pinecone, RecordMetadata, Index } from '@pinecone-database/pinecone';
import { VectorData, VectorQueryOptions, VectorSearchResult, VectorStoreConfig, VectorOperationResponse } from '../types/vector';
import { VectorStore, MemoryStore } from '../store';
import { EmbeddingsService } from '../utils/embeddings';

export class PineconeStore extends VectorStore implements MemoryStore {
  private client: Pinecone;
  private index!: Index; // Mark as definitely assigned
  private isConnected: boolean = false;
  private readonly config: VectorStoreConfig;
  private lastError: string | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  private embeddings: EmbeddingsService;

  constructor(config: VectorStoreConfig) {
    super();
    this.config = config;
    this.client = new Pinecone({
      apiKey: config.apiKey
    });
    this.embeddings = new EmbeddingsService(config.apiKey);
  }

  /**
   * Store a new memory entry
   */
  async storeMemory(content: string, metadata?: Record<string, any>): Promise<VectorOperationResponse> {
    try {
      const embeddingResult = await this.embeddings.generateEmbedding(content);
      if (!embeddingResult.success || !embeddingResult.embedding) {
        return embeddingResult;
      }

      const vector: VectorData = {
        id: crypto.randomUUID(),
        values: embeddingResult.embedding,
        metadata: {
          ...metadata,
          content,
          timestamp: new Date().toISOString()
        }
      };

      return await this.upsertVectors([vector]);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to store memory';
      return {
        success: false,
        error: this.lastError
      };
    }
  }

  /**
   * Retrieve memories similar to the query
   */
  async retrieveMemories(
    query: string | number[],
    options?: VectorQueryOptions
  ): Promise<VectorOperationResponse & { memories?: Array<{ content: string; metadata?: Record<string, any> }> }> {
    try {
      let queryVector: number[];
      
      if (typeof query === 'string') {
        const embeddingResult = await this.embeddings.generateEmbedding(query);
        if (!embeddingResult.success || !embeddingResult.embedding) {
          return embeddingResult;
        }
        queryVector = embeddingResult.embedding;
      } else {
        queryVector = query;
      }

      const queryResult = await this.queryVectors(queryVector, {
        ...options,
        includeMetadata: true
      });

      if (!queryResult.success || !queryResult.results) {
        return queryResult;
      }

      return {
        success: true,
        memories: queryResult.results.map(result => ({
          content: result.metadata?.content || '',
          metadata: result.metadata
        }))
      };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to retrieve memories';
      return {
        success: false,
        error: this.lastError
      };
    }
  }

  /**
   * Delete memories by ID
   */
  async deleteMemories(ids: string[]): Promise<VectorOperationResponse> {
    return this.deleteVectors(ids);
  }

  /**
   * Track relationships between memories
   */
  async trackRelationship(
    sourceId: string,
    targetId: string,
    relationship: string
  ): Promise<VectorOperationResponse> {
    try {
      // Get source vector to update its metadata
      const sourceResult = await this.queryVectors([0], {
        filter: { id: { $eq: sourceId } },
        includeMetadata: true
      });

      if (!sourceResult.success || !sourceResult.results?.length) {
        return {
          success: false,
          error: 'Source memory not found'
        };
      }

      const sourceVector = sourceResult.results[0];
      const relationships: Record<string, string[]> = sourceVector.metadata?.relationships || {};
      relationships[relationship] = relationships[relationship] || [];
      
      if (!relationships[relationship].includes(targetId)) {
        relationships[relationship].push(targetId);
      }

      // Update source vector with new relationship
      return await this.upsertVectors([{
        id: sourceId,
        values: sourceVector.values || [],
        metadata: {
          ...sourceVector.metadata,
          relationships
        }
      }]);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to track relationship';
      return {
        success: false,
        error: this.lastError
      };
    }
  }

  /**
   * Get related memories
   */
  async getRelatedMemories(
    memoryId: string,
    relationship?: string
  ): Promise<VectorOperationResponse & { related?: Array<{ id: string; relationship: string }> }> {
    try {
      const result = await this.queryVectors([0], {
        filter: { id: { $eq: memoryId } },
        includeMetadata: true
      });

      if (!result.success || !result.results?.length) {
        return {
          success: false,
          error: 'Memory not found'
        };
      }

      const relationships: Record<string, string[]> = result.results[0].metadata?.relationships || {};
      const related: Array<{ id: string; relationship: string }> = [];

      if (relationship) {
        // Return specific relationship type
        const relatedIds = relationships[relationship] || [];
        related.push(...relatedIds.map(id => ({ id, relationship })));
      } else {
        // Return all relationships
        for (const [rel, ids] of Object.entries(relationships)) {
          if (Array.isArray(ids)) {
            related.push(...ids.map(id => ({ id, relationship: rel })));
          }
        }
      }

      return {
        success: true,
        related
      };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to get related memories';
      return {
        success: false,
        error: this.lastError
      };
    }
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): { isConnected: boolean; lastError: string | null } {
    return {
      isConnected: this.isConnected,
      lastError: this.lastError,
    };
  }

  /**
   * Initialize connection to Pinecone index and start monitoring
   */
  async initialize(): Promise<VectorOperationResponse> {
    try {
      // Validate configuration
      if (!this.config.indexName) {
        throw new Error('Index name is required');
      }

      // Initialize index
      this.index = this.client.index(this.config.indexName);
      
      // Test connection by describing index
      await this.index.describeIndexStats();
      
      this.isConnected = true;
      this.lastError = null;

      // Start connection monitoring
      this.startConnectionMonitoring();

      return { success: true };
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Failed to initialize Pinecone index';
      
      return {
        success: false,
        error: this.lastError,
      };
    }
  }

  /**
   * Test connection to Pinecone and update status
   */
  async testConnection(): Promise<VectorOperationResponse> {
    try {
      if (!this.index) {
        throw new Error('Client not initialized');
      }

      await this.index.describeIndexStats();
      this.isConnected = true;
      this.lastError = null;
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : 'Connection test failed';
      return {
        success: false,
        error: this.lastError,
      };
    }
  }

  /**
   * Start monitoring connection status
   */
  private startConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(async () => {
      await this.testConnection();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop connection monitoring
   */
  public stopConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  /**
   * Upsert vectors to Pinecone index
   */
  async upsertVectors(vectors: VectorData[]): Promise<VectorOperationResponse> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Pinecone');
      }

      if (!vectors.length) {
        throw new Error('No vectors provided');
      }

      await this.index.upsert(vectors.map(vector => ({
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata,
      })));
      
      return { success: true };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to upsert vectors';
      return {
        success: false,
        error: this.lastError,
      };
    }
  }

  /**
   * Query vectors by similarity
   */
  async queryVectors(queryVector: number[], options: VectorQueryOptions = {}): Promise<VectorOperationResponse & { results?: VectorSearchResult[] }> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Pinecone');
      }

      if (!queryVector.length) {
        throw new Error('Query vector is required');
      }

      const response = await this.index.query({
        vector: queryVector,
        topK: options.topK || 10,
        filter: options.filter,
        includeMetadata: options.includeMetadata,
      });

      const results = response.matches?.map(match => ({
        id: match.id,
        score: match.score || 0, // Provide default score if undefined
        metadata: match.metadata,
      })) || [];

      return {
        success: true,
        results,
      };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to query vectors';
      return {
        success: false,
        error: this.lastError,
      };
    }
  }

  /**
   * Delete vectors by ID
   */
  async deleteVectors(ids: string[]): Promise<VectorOperationResponse> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Pinecone');
      }

      if (!ids.length) {
        throw new Error('No vector IDs provided');
      }

      await this.index.deleteMany(ids);
      return { success: true };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to delete vectors';
      return {
        success: false,
        error: this.lastError,
      };
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopConnectionMonitoring();
    this.isConnected = false;
  }
}
