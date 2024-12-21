import { ContextEntry } from '../types/context';
import { VectorData } from '../types/vector';
import { MigrationTransformer } from './types';
import { EmbeddingsService } from '../utils/embeddings';

/**
 * Handles transformation between ContextEntry and VectorData formats
 * during migration process
 */
export class DefaultMigrationTransformer implements MigrationTransformer {
  private embeddings: EmbeddingsService;

  constructor(openAiApiKey: string) {
    this.embeddings = new EmbeddingsService(openAiApiKey);
  }
  /**
   * Convert a ContextEntry to VectorData format
   * Generates embeddings for the content and preserves metadata
   */
  async memoryToVector(memory: ContextEntry): Promise<VectorData> {
    // Generate vector embedding if not already present
    // Generate vector embedding if not already present
    let values = memory.vector;
    if (!values) {
      const result = await this.embeddings.generateEmbedding(memory.content);
      if (!result.success || !result.embedding) {
        throw new Error(`Failed to generate embedding: ${result.error}`);
      }
      values = result.embedding;
    }

    return {
      id: memory.id,
      values,
      metadata: {
        content: memory.content,
        type: memory.metadata.type,
        timestamp: memory.metadata.timestamp,
        tags: memory.metadata.tags || [],
        source: memory.metadata.source,
        relationships: memory.metadata.relationships || [],
        attributes: memory.metadata.attributes || {},
      },
    };
  }

  /**
   * Convert VectorData back to ContextEntry format
   * Reconstructs the context structure from metadata
   */
  async vectorToMemory(vector: VectorData): Promise<ContextEntry> {
    if (!vector.metadata) {
      throw new Error('Vector metadata is required for conversion');
    }

    return {
      id: vector.id,
      content: vector.metadata.content,
      vector: vector.values,
      metadata: {
        type: vector.metadata.type,
        timestamp: vector.metadata.timestamp,
        tags: vector.metadata.tags || [],
        source: vector.metadata.source,
        relationships: vector.metadata.relationships || [],
        attributes: vector.metadata.attributes || {},
      },
    };
  }

  /**
   * Validate the conversion between formats
   * Ensures all required data is preserved
   */
  async validate(memory: ContextEntry, vector: VectorData): Promise<boolean> {
    if (!vector.metadata) return false;

    // Check essential fields
    const essentialChecks = [
      vector.id === memory.id,
      vector.metadata.content === memory.content,
      vector.metadata.type === memory.metadata.type,
      vector.metadata.timestamp === memory.metadata.timestamp,
    ];

    if (!essentialChecks.every(Boolean)) return false;

    // Check vector values
    if (!vector.values || vector.values.length !== 1536) return false;

    // Validate metadata preservation
    const metadataChecks = [
      JSON.stringify(vector.metadata.tags) === JSON.stringify(memory.metadata.tags || []),
      vector.metadata.source === memory.metadata.source,
      JSON.stringify(vector.metadata.relationships) === JSON.stringify(memory.metadata.relationships || []),
      JSON.stringify(vector.metadata.attributes) === JSON.stringify(memory.metadata.attributes || {}),
    ];

    return metadataChecks.every(Boolean);
  }
}
