/**
 * Context management implementation
 */

import { VectorStore } from './types/vector';
import { MemoryStore } from './types/store';
import { VectorData, VectorQueryOptions } from './types/vector';
import {
  ContextEntry,
  ContextMetadata,
  ContextQueryOptions,
  ContextSearchResult,
  ContextOperationResponse,
  ContextGraph
} from './types/context';

/**
 * Manages context retrieval and relationships for memory entries
 */
export class ContextManager {
  private vectorStore: VectorStore;
  private memoryStore: MemoryStore;
  private contextGraph: ContextGraph;

  constructor(vectorStore: VectorStore, memoryStore: MemoryStore) {
    this.vectorStore = vectorStore;
    this.memoryStore = memoryStore;
    this.contextGraph = {
      nodes: new Map(),
      edges: []
    };
  }

  /**
   * Add a new context entry
   */
  async addContext(entry: ContextEntry): Promise<ContextOperationResponse> {
    try {
      // Validate metadata
      if (!this.validateMetadata(entry.metadata)) {
        return {
          success: false,
          error: 'Invalid metadata: timestamp must be a number'
        };
      }

      // Store in memory store
      const memoryResponse = await this.memoryStore.storeMemory(entry.content, {
        ...entry.metadata,
        id: entry.id,
        vector: entry.vector
      });
      
      if (!memoryResponse.success) {
        return memoryResponse;
      }

      // Store the context vector
      if (entry.vector) {
        const vectorData: VectorData = {
          id: entry.id,
          values: entry.vector,
          metadata: {
            ...entry.metadata,
            content: entry.content
          }
        };
        
        const vectorResponse = await this.vectorStore.upsertVectors([vectorData]);
        if (!vectorResponse.success) {
          return vectorResponse;
        }
      }

      // Update context graph
      this.contextGraph.nodes.set(entry.id, entry);
      
      // Process relationships
      if (entry.metadata.relationships) {
        for (const rel of entry.metadata.relationships) {
          this.contextGraph.edges.push({
            source: entry.id,
            target: rel.targetId,
            type: rel.type,
            strength: rel.strength
          });

          // Track relationship in memory store
          await this.memoryStore.trackRelationship(entry.id, rel.targetId, rel.type);
        }
      }

      return { success: true };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message || 'Unknown error' : String(error);
      return {
        success: false,
        error: `Failed to add context: ${errorMessage}`
      };
    }
  }

  /**
   * Retrieve context based on vector similarity and metadata
   */
  async retrieveContext(
    query: string | number[],
    options?: ContextQueryOptions
  ): Promise<ContextOperationResponse> {
    try {
      // Get similar vectors
      const queryResponse = await this.memoryStore.retrieveMemories(query, {
        ...options,
        includeMetadata: true
      });

      if (!queryResponse.success || !queryResponse.memories) {
        return queryResponse;
      }

      // Process results into context entries
      let contexts: ContextSearchResult[] = [];
      
      for (const memory of queryResponse.memories) {
        const entry: ContextEntry = {
          id: memory.metadata?.id || '',
          content: memory.content,
          metadata: memory.metadata as ContextMetadata
        };

        const result: ContextSearchResult = {
          entry,
          score: memory.metadata?.score || 0
        };

        // Include related entries if requested
        if (options?.includeRelated) {
          const relatedResponse = await this.getRelatedContexts(
            entry.id,
            options.relationshipTypes
          );
          
          if (relatedResponse.success && relatedResponse.contexts) {
            result.relatedEntries = relatedResponse.contexts.map(c => c.entry);
          }
        }

        contexts.push(result);
      }

      // Filter by time range if specified
      if (options?.timeRange) {
        const { start, end } = options.timeRange;
        contexts = contexts.filter(c => {
          const timestamp = c.entry.metadata.timestamp;
          return timestamp >= start && timestamp <= end;
        });
      }

      // Filter by context types if specified
      if (options?.contextTypes) {
        contexts = contexts.filter(c => 
          options.contextTypes?.includes(c.entry.metadata.type)
        );
      }

      return {
        success: true,
        contexts
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message || 'Unknown error' : String(error);
      return {
        success: false,
        error: `Failed to retrieve context: ${errorMessage}`,
        contexts: []
      };
    }
  }

  /**
   * Get related contexts for a given context ID
   */
  private async getRelatedContexts(
    contextId: string,
    relationshipTypes?: string[]
  ): Promise<ContextOperationResponse> {
    try {
      // Get relationships from memory store
      const relatedResponse = await this.memoryStore.getRelatedMemories(
        contextId,
        relationshipTypes?.join(',')
      );

      if (!relatedResponse.success || !relatedResponse.related) {
        return relatedResponse;
      }

      // Convert to context entries
      const contexts: ContextSearchResult[] = [];
      
      for (const rel of relatedResponse.related) {
        const node = this.contextGraph.nodes.get(rel.id);
        if (node) {
          contexts.push({
            entry: node,
            score: this.getRelationshipStrength(contextId, rel.id) || 0
          });
        }
      }

      return {
        success: true,
        contexts
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message || 'Unknown error' : String(error);
      return {
        success: false,
        error: `Failed to get related contexts: ${errorMessage}`,
        contexts: []
      };
    }
  }

  /**
   * Get relationship strength between two contexts
   */
  private getRelationshipStrength(sourceId: string, targetId: string): number {
    const edge = this.contextGraph.edges.find(
      e => e.source === sourceId && e.target === targetId
    );
    return edge?.strength || 0;
  }

  /**
   * Validate context metadata
   */
  private validateMetadata(metadata: ContextMetadata): boolean {
    if (!metadata.timestamp || typeof metadata.timestamp !== 'number') {
      return false;
    }
    return true;
  }

  /**
   * Update context metadata
   */
  async updateContextMetadata(
    contextId: string,
    metadata: Partial<ContextMetadata>
  ): Promise<ContextOperationResponse> {
    try {
      const node = this.contextGraph.nodes.get(contextId);
      if (!node) {
        return {
          success: false,
          error: 'Context not found'
        };
      }

      // Update memory store
      const updatedEntry: ContextEntry = {
        ...node,
        metadata: {
          ...node.metadata,
          ...metadata
        }
      };

      const memoryResponse = await this.memoryStore.storeMemory(updatedEntry.content, {
        ...updatedEntry.metadata,
        id: updatedEntry.id,
        vector: updatedEntry.vector
      });

      if (!memoryResponse.success) {
        return memoryResponse;
      }

      // Update vector metadata if vector exists
      if (updatedEntry.vector) {
        const vectorData: VectorData = {
          id: updatedEntry.id,
          values: updatedEntry.vector,
          metadata: {
            ...updatedEntry.metadata,
            content: updatedEntry.content
          }
        };

        const vectorResponse = await this.vectorStore.upsertVectors([vectorData]);
        if (!vectorResponse.success) {
          return vectorResponse;
        }
      }

      // Update graph node
      this.contextGraph.nodes.set(contextId, updatedEntry);

      return { success: true };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message || 'Unknown error' : String(error);
      return {
        success: false,
        error: `Failed to update context metadata: ${errorMessage}`
      };
    }
  }

  /**
   * Delete a context and its relationships
   */
  async deleteContext(contextId: string): Promise<ContextOperationResponse> {
    try {
      // Remove from vector store
      const vectorResponse = await this.vectorStore.deleteVectors([contextId]);
      if (!vectorResponse.success) {
        return vectorResponse;
      }

      // Remove from memory store
      const memoryResponse = await this.memoryStore.deleteMemories([contextId]);
      if (!memoryResponse.success) {
        return memoryResponse;
      }

      // Update graph
      this.contextGraph.nodes.delete(contextId);
      this.contextGraph.edges = this.contextGraph.edges.filter(
        e => e.source !== contextId && e.target !== contextId
      );

      return { success: true };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to delete context: ${errorMessage}`
      };
    }
  }
}
