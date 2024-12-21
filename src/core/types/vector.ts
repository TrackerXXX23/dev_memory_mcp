/**
 * Vector-related type definitions for Pinecone integration
 */

export interface VectorStore {
  initialize(): Promise<VectorOperationResponse>;
  getConnectionStatus(): { isConnected: boolean; lastError: string | null };
  upsertVectors(vectors: VectorData[]): Promise<VectorOperationResponse>;
  queryVectors(
    queryVector: number[],
    options?: VectorQueryOptions
  ): Promise<VectorOperationResponse & { results?: VectorSearchResult[] }>;
  deleteVectors(ids: string[]): Promise<VectorOperationResponse>;
  dispose(): void;
}

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

export interface VectorQueryMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, any>;
}

export interface VectorQueryResponse {
  matches?: VectorQueryMatch[];
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
