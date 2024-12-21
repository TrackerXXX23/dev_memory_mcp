/**
 * Memory store type definitions
 */

import { VectorOperationResponse } from './vector';

export interface MemoryMetadata {
  id: string;
  type: string;
  timestamp: number;
  tags?: string[];
  vector?: number[];
  [key: string]: any;
}

export interface MemoryEntry {
  content: string;
  metadata: MemoryMetadata;
}

export interface MemoryQueryOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface MemoryQueryResult {
  content: string;
  metadata?: MemoryMetadata;
  score?: number;
}

export interface MemoryOperationResponse extends VectorOperationResponse {
  memories?: MemoryQueryResult[];
  related?: Array<{ id: string; type?: string }>;
}

export interface MemoryStore {
  storeMemory(content: string, metadata: MemoryMetadata): Promise<MemoryOperationResponse>;
  retrieveMemories(query: string | number[], options?: MemoryQueryOptions): Promise<MemoryOperationResponse>;
  deleteMemories(ids: string[]): Promise<MemoryOperationResponse>;
  trackRelationship(sourceId: string, targetId: string, type: string): Promise<MemoryOperationResponse>;
  getRelatedMemories(memoryId: string, relationshipTypes?: string): Promise<MemoryOperationResponse>;
}
