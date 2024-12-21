/**
 * Core store interface defining the contract for all store implementations
 */

import { VectorData, VectorQueryOptions, VectorSearchResult, VectorOperationResponse } from './types/vector';

/**
 * Abstract base class for vector store implementations
 * Defines the required interface that all store implementations must follow
 */
export abstract class VectorStore {
  /**
   * Initialize the store connection
   */
  abstract initialize(): Promise<VectorOperationResponse>;

  /**
   * Get current connection status
   */
  abstract getConnectionStatus(): { isConnected: boolean; lastError: string | null };

  /**
   * Test connection to the store
   */
  abstract testConnection(): Promise<VectorOperationResponse>;

  /**
   * Upsert vectors to the store
   * @param vectors Array of vector data to upsert
   */
  abstract upsertVectors(vectors: VectorData[]): Promise<VectorOperationResponse>;

  /**
   * Query vectors by similarity
   * @param queryVector Vector to compare against
   * @param options Query options like topK, filters
   */
  abstract queryVectors(
    queryVector: number[],
    options?: VectorQueryOptions
  ): Promise<VectorOperationResponse & { results?: VectorSearchResult[] }>;

  /**
   * Delete vectors by ID
   * @param ids Array of vector IDs to delete
   */
  abstract deleteVectors(ids: string[]): Promise<VectorOperationResponse>;

  /**
   * Cleanup resources
   */
  abstract dispose(): void;
}

/**
 * Memory store interface for storing and retrieving memory entries
 */
export interface MemoryStore {
  /**
   * Store a new memory entry
   * @param content Memory content
   * @param metadata Additional metadata
   */
  storeMemory(content: string, metadata?: Record<string, any>): Promise<VectorOperationResponse>;

  /**
   * Retrieve memories similar to the query
   * @param query Query string or vector
   * @param options Search options
   */
  retrieveMemories(
    query: string | number[],
    options?: VectorQueryOptions
  ): Promise<VectorOperationResponse & { memories?: Array<{ content: string; metadata?: Record<string, any> }> }>;

  /**
   * Delete memories by ID
   * @param ids Memory IDs to delete
   */
  deleteMemories(ids: string[]): Promise<VectorOperationResponse>;

  /**
   * Track relationships between memories
   * @param sourceId Source memory ID
   * @param targetId Target memory ID
   * @param relationship Type of relationship
   */
  trackRelationship(
    sourceId: string,
    targetId: string,
    relationship: string
  ): Promise<VectorOperationResponse>;

  /**
   * Get related memories
   * @param memoryId Memory ID to find relationships for
   * @param relationship Optional relationship type filter
   */
  getRelatedMemories(
    memoryId: string,
    relationship?: string
  ): Promise<VectorOperationResponse & { related?: Array<{ id: string; relationship: string }> }>;
}
