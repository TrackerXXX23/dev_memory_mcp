/**
 * Vector-related type definitions for Pinecone integration
 */

export interface VectorData {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

export interface VectorQueryOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, any>;
}

export interface VectorOperationResponse {
  success: boolean;
  error?: string;
}

export interface VectorStoreConfig {
  environment: string;
  apiKey: string;
  indexName: string;
}
