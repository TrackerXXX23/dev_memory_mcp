/**
 * Context management type definitions
 */

import { VectorOperationResponse, VectorQueryOptions } from './vector';

/**
 * Context metadata structure
 */
export interface ContextMetadata {
  type: string;
  timestamp: number;
  tags?: string[];
  source?: string;
  relationships?: Array<{
    targetId: string;
    type: string;
    strength: number;
  }>;
  attributes?: Record<string, any>;
}

/**
 * Context entry combining content and metadata
 */
export interface ContextEntry {
  id: string;
  content: string;
  vector?: number[];
  metadata: ContextMetadata;
}

/**
 * Options for context retrieval
 */
export interface ContextQueryOptions extends VectorQueryOptions {
  includeRelated?: boolean;
  relationshipTypes?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  contextTypes?: string[];
}

/**
 * Context search result
 */
export interface ContextSearchResult {
  entry: ContextEntry;
  score: number;
  relatedEntries?: ContextEntry[];
}

/**
 * Response type for context operations
 */
export interface ContextOperationResponse extends VectorOperationResponse {
  contexts?: ContextSearchResult[];
}

/**
 * Context relationship graph
 */
export interface ContextGraph {
  nodes: Map<string, ContextEntry>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    strength: number;
  }>;
}
